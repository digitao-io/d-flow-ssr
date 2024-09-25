import { ConfigValue, isValueResolved, PageDetails, ResolvedComponentDetails, ResolvedPageDetails, ResolvedValue, ValueResolvingInfo } from "../models/page";
import { DataCacheOption, DataResolvingCache } from "./data-resolving-cache";

export interface DataResolvingContext {
  apiBaseUrl: string;
  pageBaseUrl: string;
  pageUrlPath: string;
  pageUrlParams: Record<string, string>;
  pageUrlQueries: Record<string, string | string[]>;
};

export interface DataResolverConfig {
  prefix: string[];
  cacheOption?: DataCacheOption;
  resolve(
    context: DataResolvingContext,
    sourcePath: string[],
  ): Promise<ResolvedValue> | ResolvedValue;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DataResolverConfigLookup
  extends Record<string, DataResolverConfig | DataResolverConfigLookup> {}

function isDataResolverConfig(
  v: DataResolverConfig | DataResolverConfigLookup,
): v is DataResolverConfig {
  const keys = Object.keys(v);
  return keys.includes("prefix") && keys.includes("resolve");
}

export class DataResolver {
  private resolverConfigs: DataResolverConfigLookup;
  private cache: DataResolvingCache;

  public constructor() {
    this.resolverConfigs = {};
    this.cache = new DataResolvingCache();
  }

  public withResolver(resolverConfig: DataResolverConfig): this {
    let currentLookup: DataResolverConfigLookup = this.resolverConfigs;
    for (let i = 0; i < resolverConfig.prefix.length - 1; i++) {
      const lookupKey = resolverConfig.prefix[i];

      if (!currentLookup[lookupKey]) {
        currentLookup[lookupKey] = {};
      }

      currentLookup = currentLookup[lookupKey] as DataResolverConfigLookup;

      if (isDataResolverConfig(currentLookup)) {
        throw new Error(
          `Cannot register resolver ${resolverConfig.prefix.join("/")}, `
          + `because the resolver ${resolverConfig.prefix.slice(0, i + 1).join("/")} already exists`,
        );
      }
    }

    currentLookup[resolverConfig.prefix[resolverConfig.prefix.length - 1]] = resolverConfig;

    return this;
  }

  public async resolve(
    resolvingContext: DataResolvingContext,
    pageDetails: PageDetails,
  ): Promise<ResolvedPageDetails> {
    const resolvedTopLevelFields = await this.resolveRecord(
      resolvingContext,
      {
        language: pageDetails.language,
        title: pageDetails.title,
      },
    );

    const resolvedConfig = await this.resolveRecord(resolvingContext, pageDetails.config);

    const resolvedSlots = {} as Record<string, ResolvedComponentDetails[]>;
    for (const [slotName, componentDetailsArray] of Object.entries(pageDetails.slots)) {
      const resolvedComponentDetailsArray: ResolvedComponentDetails[] = [];

      for (const componentDetails of componentDetailsArray) {
        const resolvedComponentDetails = {
          component: componentDetails.component,
          config: await this.resolveRecord(resolvingContext, componentDetails.config),
        };

        resolvedComponentDetailsArray.push(resolvedComponentDetails);
      }

      resolvedSlots[slotName] = resolvedComponentDetailsArray;
    }

    this.cache.clearRequestTypedCachedValues();

    return {
      template: pageDetails.template,
      language: resolvedTopLevelFields.language as string,
      title: resolvedTopLevelFields.title as string,
      config: resolvedConfig,
      slots: resolvedSlots,
    };
  }

  private async resolveRecord(
    resolvingContext: DataResolvingContext,
    record: Record<string, ConfigValue>,
  ): Promise<Record<keyof typeof record, ResolvedValue>> {
    const result = {} as Record<keyof typeof record, ResolvedValue>;
    for (const [key, value] of Object.entries(record)) {
      if (isValueResolved(value)) {
        result[key] = value;
      }
      else {
        result[key] = await this.resolveValueUsingResolver(resolvingContext, value);
      }
    }

    return result;
  }

  private async resolveValueUsingResolver(
    resolvingContext: DataResolvingContext,
    resolvingInfo: ValueResolvingInfo,
  ): Promise<ResolvedValue> {
    const resolvedSource = [] as string[];
    for (const source of resolvingInfo.$source) {
      if (isValueResolved(source)) {
        resolvedSource.push(source as string);
      }
      else {
        resolvedSource.push((await this.resolveValueUsingResolver(resolvingContext, source)) as string);
      }
    }

    let currentLookup: DataResolverConfig | DataResolverConfigLookup = this.resolverConfigs;
    for (const lookupKey of resolvedSource) {
      currentLookup = (currentLookup as DataResolverConfigLookup)[lookupKey];
      if (!currentLookup) {
        throw Error(`Cannot find resolver for source ${resolvingInfo.$source.join("/")}`);
      }
      if (isDataResolverConfig(currentLookup)) {
        break;
      }
    }

    if (!isDataResolverConfig(currentLookup)) {
      throw Error(`Cannot find resolver for source ${resolvingInfo.$source.join("/")}`);
    }

    const resolverConfig = currentLookup as DataResolverConfig;

    let resolvedValue: ResolvedValue;

    const cacheResult = this.cache.getCachedValue(resolvedSource);
    if (cacheResult.hit) {
      resolvedValue = cacheResult.value;
    }
    else {
      try {
        resolvedValue = await resolverConfig.resolve(resolvingContext, resolvedSource);
        if (resolverConfig.cacheOption) {
          this.cache.addCachedValue(resolvedSource, resolvedValue, resolverConfig.cacheOption);
        }
      }
      catch (err) {
        console.log(err);
        resolvedValue = null;
      }
    }

    if (resolvingInfo.field) {
      const fieldKeys = resolvingInfo.field.split(".");
      for (const fieldKey of fieldKeys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolvedValue = resolvedValue && ((resolvedValue as any)[fieldKey] ?? null);
      }
    }

    return resolvedValue;
  }
}
