import { ConfigValue, isValueResolved, PageDetails, ResolvedComponentDetails, ResolvedPageDetails, ResolvedValue, ValueResolvingInfo } from "../models/page";
import { DataCacheOption, DataResolvingCache } from "./data-resolving-cache";
import { Configuration } from "../app/configuration";

export interface DataResolvingContext<CONFIG extends Configuration> {
  appConfig: CONFIG;
  pageUrlPath: string;
  pageUrlParams: Record<string, string>;
  pageUrlQueries: Record<string, string | string[]>;
};

export interface DataResolverConfig<CONFIG extends Configuration> {
  prefix: string[];
  cacheOption?: DataCacheOption;
  resolve(
    context: DataResolvingContext<CONFIG>,
    sourcePath: string[],
  ): Promise<ResolvedValue> | ResolvedValue;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DataResolverConfigLookup<CONFIG extends Configuration>
  extends Record<string, DataResolverConfig<CONFIG> | DataResolverConfigLookup<CONFIG>> {}

function isDataResolverConfig<CONFIG extends Configuration>(
  v: DataResolverConfig<CONFIG> | DataResolverConfigLookup<CONFIG>,
): v is DataResolverConfig<CONFIG> {
  const keys = Object.keys(v);
  return keys.includes("prefix") && keys.includes("resolve");
}

export class DataResolver<CONFIG extends Configuration> {
  private resolverConfigs: DataResolverConfigLookup<CONFIG>;
  private cache: DataResolvingCache;

  public constructor() {
    this.resolverConfigs = {};
    this.cache = new DataResolvingCache();
  }

  public clearCache() {
    this.cache.clearAllCachedValues();
  }

  public withResolver(resolverConfig: DataResolverConfig<CONFIG>): this {
    let currentLookup: DataResolverConfigLookup<CONFIG> = this.resolverConfigs;
    for (let i = 0; i < resolverConfig.prefix.length - 1; i++) {
      const lookupKey = resolverConfig.prefix[i];

      if (!currentLookup[lookupKey]) {
        currentLookup[lookupKey] = {};
      }

      currentLookup = currentLookup[lookupKey] as DataResolverConfigLookup<CONFIG>;

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
    resolvingContext: DataResolvingContext<CONFIG>,
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
    resolvingContext: DataResolvingContext<CONFIG>,
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
    resolvingContext: DataResolvingContext<CONFIG>,
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

    let currentLookup: DataResolverConfig<CONFIG> | DataResolverConfigLookup<CONFIG> = this.resolverConfigs;
    for (const lookupKey of resolvedSource) {
      currentLookup = (currentLookup as DataResolverConfigLookup<CONFIG>)[lookupKey];
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

    const resolverConfig = currentLookup as DataResolverConfig<CONFIG>;

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
