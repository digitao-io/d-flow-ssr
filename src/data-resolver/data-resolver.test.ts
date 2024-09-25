import { DataResolver, DataResolverConfig } from "./data-resolver";

describe("DataResolver", () => {
  let dataResolver: DataResolver;

  let httpDataResolver: DataResolverConfig["resolve"];
  let contextUrlparamsResolver: DataResolverConfig["resolve"];

  beforeEach(() => {
    dataResolver = new DataResolver();

    httpDataResolver = jest.fn(async (_, sourcePath) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ keys: [sourcePath[2]] });
        }, 50);
      });
    });
    contextUrlparamsResolver = jest.fn((context, sourcePath) => {
      return context.pageUrlParams[sourcePath[2]];
    });

    dataResolver
      .withResolver({
        prefix: ["http", "data"],
        resolve: httpDataResolver,
        cacheOption: {
          type: "TIME",
          timeToLive: 5,
        },
      })
      .withResolver({
        prefix: ["context", "urlparams"],
        resolve: contextUrlparamsResolver,
        cacheOption: {
          type: "REQUEST",
        },
      });
  });

  it("should throw error if resolver is re-registered", () => {
    expect(() => {
      dataResolver.withResolver({
        prefix: ["context", "urlparams", "key"],
        resolve: () => true,
      });
    }).toThrow(new Error(
      "Cannot register resolver context/urlparams/key, "
      + "because the resolver context/urlparams already exists",
    ));
  });

  it("should throw error if resolver is not registered", async () => {
    await expect(async () => {
      await dataResolver.resolve(
        {
          apiBaseUrl: "https://example.org",
          pageBaseUrl: "https://example.org",
          pageUrlPath: "/key/example-key",
          pageUrlParams: { key: "example-key" },
          pageUrlQueries: {},
        },
        {
          template: "exmample-template",
          language: "en",
          title: {
            $source: ["non", "existing", "resolver"],
          },
          config: {},
          slots: {},
        },
      );
    }).rejects.toThrow(new Error("Cannot find resolver for source non/existing/resolver"));
  });

  it("should resolve language and title", async () => {
    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { lang: "en", title: "Hello World!" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: { $source: ["context", "urlparams", "lang"] },
        title: { $source: ["context", "urlparams", "title"] },
        config: {},
        slots: {},
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: "en",
      title: "Hello World!",
      config: {},
      slots: {},
    });
  });

  it("should resolve config", async () => {
    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { foo: "Hello", bar: "Goodbye" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: "en",
        title: "Hello World!",
        config: {
          foo: { $source: ["context", "urlparams", "foo"] },
          bar: { $source: ["context", "urlparams", "bar"] },
        },
        slots: {},
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: "en",
      title: "Hello World!",
      config: {
        foo: "Hello",
        bar: "Goodbye",
      },
      slots: {},
    });
  });

  it("should resolve slots", async () => {
    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { foo: "Hello", bar: "Goodbye" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: "en",
        title: "Hello World!",
        config: {},
        slots: {
          main: [
            {
              component: "main-menu",
              config: {
                foo: { $source: ["context", "urlparams", "foo"] },
              },
            },
          ],
          sidebar: [
            {
              component: "author-information",
              config: {
                bar: { $source: ["context", "urlparams", "bar"] },
              },
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: "en",
      title: "Hello World!",
      config: {},
      slots: {
        main: [
          {
            component: "main-menu",
            config: { foo: "Hello" },
          },
        ],
        sidebar: [
          {
            component: "author-information",
            config: { bar: "Goodbye" },
          },
        ],
      },
    });
  });

  it("should resolve source recursively", async () => {
    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { foo: "Hello", bar: "Goodbye" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: "en",
        title: "Hello World!",
        config: {
          foo: {
            $source: [
              "context",
              "urlparams",
              {
                $source: ["http", "data", "foo"],
                field: "keys.0",
              },
            ],
          },
          bar: {
            $source: [
              "context",
              "urlparams",
              {
                $source: ["http", "data", "bar"],
                field: "keys.0",
              },
            ],
          },
        },
        slots: {},
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: "en",
      title: "Hello World!",
      config: {
        foo: "Hello",
        bar: "Goodbye",
      },
      slots: {},
    });
  });

  it("should continue resolving if there is runtime resolving error", async () => {
    jest.spyOn(console, "log").mockReturnValue(undefined);

    dataResolver.withResolver({
      prefix: ["error"],
      resolve: async () => Promise.reject("Runtime error"),
    });

    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { foo: "Hello", bar: "Goodbye" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: { $source: ["error"] },
        title: "Hello World!",
        config: {
          foo: { $source: ["context", "urlparams", "foo"] },
          bar: { $source: ["context", "urlparams", "bar"] },
        },
        slots: {},
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: null,
      title: "Hello World!",
      config: {
        foo: "Hello",
        bar: "Goodbye",
      },
      slots: {},
    });
    expect(console.log).toHaveBeenCalledWith("Runtime error");
  });

  it("should only call resolver once if the value is cached", async () => {
    const result = await dataResolver.resolve(
      {
        apiBaseUrl: "https://example.org",
        pageBaseUrl: "https://example.org",
        pageUrlPath: "/key/example-key",
        pageUrlParams: { foo: "Hello" },
        pageUrlQueries: {},
      },
      {
        template: "exmample-template",
        language: { $source: ["context", "urlparams", "foo"] },
        title: { $source: ["context", "urlparams", "foo"] },
        config: {
          foo: { $source: ["http", "data", "Hello"], field: "keys.0" },
          bar: { $source: ["http", "data", "Hello"], field: "keys.0" },
        },
        slots: {},
      },
    );

    expect(result).toEqual({
      template: "exmample-template",
      language: "Hello",
      title: "Hello",
      config: {
        foo: "Hello",
        bar: "Hello",
      },
      slots: {},
    });

    expect(httpDataResolver).toHaveBeenCalledTimes(1);
    expect(contextUrlparamsResolver).toHaveBeenCalledTimes(1);
  });
});
