import { DataResolvingCache } from "./data-resolving-cache";

describe("DataResolvingCache", () => {
  let dataResolvingCache: DataResolvingCache;

  beforeEach(() => {
    dataResolvingCache = new DataResolvingCache();
  });

  it("should return a cache-miss if the required value is not yet stored", () => {
    const result = dataResolvingCache.getCachedValue(["non", "existing", "value"]);

    expect(result).toEqual({ hit: false });
  });

  it("should return a cache-miss if the cache is cleared", () => {
    dataResolvingCache.addCachedValue(
      ["some", "random", "value"],
      "Hello world!",
      { type: "REQUEST" },
    );

    dataResolvingCache.clearAllCachedValues();

    const result = dataResolvingCache.getCachedValue(["some", "random", "value"]);

    expect(result).toEqual({ hit: false });
  });

  describe("with time based cache strategy", () => {
    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: ["nextTick"],
        now: new Date("2024-09-01T00:00:00.000Z"),
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return a cache-hit before the expiration time", () => {
      dataResolvingCache.addCachedValue(
        ["some", "random", "value"],
        "Hello world!",
        { type: "TIME", timeToLive: 5 },
      );

      jest.useFakeTimers({
        doNotFake: ["nextTick"],
        now: new Date("2024-09-01T00:00:04.999Z"),
      });

      const result = dataResolvingCache.getCachedValue(["some", "random", "value"]);

      expect(result).toEqual({ hit: true, value: "Hello world!" });
    });

    it("should return a cache-miss after the expiration time", () => {
      dataResolvingCache.addCachedValue(
        ["some", "random", "value"],
        "Hello world!",
        { type: "TIME", timeToLive: 5 },
      );

      jest.useFakeTimers({
        doNotFake: ["nextTick"],
        now: new Date("2024-09-01T00:00:05.000Z"),
      });

      const result = dataResolvingCache.getCachedValue(["some", "random", "value"]);

      expect(result).toEqual({ hit: false });
    });
  });

  describe("with request based cache strategy", () => {
    it("should return a cache-hit if the value has been stored", () => {
      dataResolvingCache.addCachedValue(
        ["some", "random", "value"],
        "Hello world!",
        { type: "REQUEST" },
      );

      const result = dataResolvingCache.getCachedValue(["some", "random", "value"]);

      expect(result).toEqual({ hit: true, value: "Hello world!" });
    });

    it("should remove all the entries after each request", () => {
      dataResolvingCache.addCachedValue(
        ["some", "random", "value"],
        "Hello world!",
        { type: "REQUEST" },
      );

      dataResolvingCache.clearRequestTypedCachedValues();

      const result = dataResolvingCache.getCachedValue(["some", "random", "value"]);

      expect(result).toEqual({ hit: false });
    });
  });
});
