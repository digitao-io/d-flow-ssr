import { ResolvedValue } from "../models/page";

export type DataCacheOption =
  | DataCacheTimeScopedOption
  | DataCacheRequestScopedOption;

export interface DataCacheTimeScopedOption {
  type: "TIME";
  timeToLive: number;
}

export interface DataCacheRequestScopedOption {
  type: "REQUEST";
}

export type DataCacheResult =
  | { hit: true; value: ResolvedValue }
  | { hit: false };

type DataCacheEntry =
  & { value: ResolvedValue }
  & (
    | DataCacheTimeEntry
    | DataCacheRequestEntry
  );

interface DataCacheTimeEntry {
  type: "TIME";
  expireAt: number;
}

interface DataCacheRequestEntry {
  type: "REQUEST";
}

export class DataResolvingCache {
  private cachedValue: Map<string, DataCacheEntry>;

  public constructor() {
    this.cachedValue = new Map();
  }

  public clearAllCachedValues() {
    this.cachedValue.clear();
  }

  public clearRequestTypedCachedValues() {
    for (const [key, entry] of this.cachedValue.entries()) {
      if (entry.type === "REQUEST") {
        this.cachedValue.delete(key);
      }
    }
  }

  public addCachedValue(
    dataPath: string[],
    value: ResolvedValue,
    cacheOption: DataCacheOption,
  ) {
    const cacheKey = dataPath.join("/");

    switch (cacheOption.type) {
      case "TIME":
        this.cachedValue.set(cacheKey, {
          type: "TIME",
          expireAt: this.getCurrentTimeInSecs() + cacheOption.timeToLive,
          value,
        });
        break;
      case "REQUEST":
        this.cachedValue.set(cacheKey, {
          type: "REQUEST",
          value,
        });
        break;
    }
  }

  public getCachedValue(
    dataPath: string[],
  ): DataCacheResult {
    const cacheKey = dataPath.join("/");
    const cacheEntry = this.cachedValue.get(cacheKey);

    if (!cacheEntry) {
      return { hit: false };
    }

    switch (cacheEntry.type) {
      case "TIME":
        if (this.getCurrentTimeInSecs() < cacheEntry.expireAt) {
          return { hit: true, value: cacheEntry.value };
        }
        else {
          this.cachedValue.delete(cacheKey);
          return { hit: false };
        }
      case "REQUEST":
        return { hit: true, value: cacheEntry.value };
      default:
        return { hit: false };
    }
  }

  private getCurrentTimeInSecs() {
    return Math.floor(Date.now() / 1000);
  }
}
