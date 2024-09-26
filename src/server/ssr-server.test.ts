import supertest from "supertest";
import { App, Component, createSSRApp, defineComponent, h, useSSRContext, VNode } from "vue";
import { SsrServer } from "./ssr-server";
import { Configuration } from "./configuration";
import { DataResolver } from "../data-resolver/data-resolver";
import { ResolvedPageDetails } from "../models/page";

export function createVueApp(components: Record<string, Component>): App {
  return createSSRApp(defineComponent({
    setup() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = useSSRContext() ?? (window as any).context;

      const pageDetails = ctx.pageDetails as ResolvedPageDetails;

      function render(slots: Record<string, () => VNode[]>): VNode {
        return h(
          components[pageDetails.template],
          { config: pageDetails.config },
          slots,
        );
      };

      function renderSlots(): Record<string, () => VNode[]> {
        const result = {} as Record<string, () => VNode[]>;
        for (const [slotName, slotComponents] of Object.entries(pageDetails.slots)) {
          result[slotName] = () => slotComponents.map((component) => {
            return h(
              components[component.component],
              { config: component.config },
            );
          });
        }

        return result;
      };

      return () => render(renderSlots());
    },
  }));
}

async function initializeSsrServer() {
  const vueApp = createVueApp({
    "default-template": {
      props: {
        config: { type: Object, required: true },
      },
      template: `
        <main>
          <h1>Hello world!</h1>
          <p>message: {{ config.message }}</p>
          <slot name="main" />
          <slot name="sidebar" />
        </main>
      `,
    },
    "paragraph-component": {
      props: {
        config: { type: Object, required: true },
      },
      template: "<p>{{ config.message }}</p>",
    },
  });

  const dataResolver = new DataResolver<Configuration>();
  dataResolver
    .withResolver({
      prefix: ["context", "urlquery"],
      resolve: (context, sourcePath) => context.pageUrlQueries[sourcePath[2]],
    })
    .withResolver({
      prefix: ["context", "urlparam"],
      resolve: (context, sourcePath) => context.pageUrlParams[sourcePath[2]],
    });

  const server = new SsrServer<Configuration>();
  server.initialize({
    vueApp,
    dataResolver,
    fetchPages: () => Promise.resolve([
      {
        key: "home",
        title: "Home",
        description: "The home page of the website",
        urlPattern: "/",
        details: {
          template: "default-template",
          title: "Home",
          language: "en",
          config: { message: "Hello world!" },
          slots: {
            main: [],
            sidebar: [],
          },
        },
      },
      {
        key: "page",
        title: "Page",
        description: "Just a simple test page",
        urlPattern: "/test/:key",
        details: {
          template: "default-template",
          title: "Test",
          language: "en",
          config: { message: "Hello world!" },
          slots: {
            main: [
              {
                component: "paragraph-component",
                config: {
                  message: { $source: ["context", "urlparam", "key"] },
                },
              },
            ],
            sidebar: [
              {
                component: "paragraph-component",
                config: {
                  message: { $source: ["context", "urlquery", "message"] },
                },
              },
            ],
          },
        },
      },
    ]),
    configPath: "./config.test.json",
  });

  return server;
}

describe("SsrServer", () => {
  let server: SsrServer<Configuration>;

  beforeEach(async () => {
    server = await initializeSsrServer();
  });

  it("should work", async () => {
    const result = await supertest(server.express)
      .get("/");

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(result.text).toMatchSnapshot();
  });

  it("should be able to fetch standard context", async () => {
    const result = await supertest(server.express)
      .get("/test/foo")
      .query({ message: "test" });

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(result.text).toMatchSnapshot();
  });

  it("should handle static files", async () => {
    const result = await supertest(server.express)
      .get("/main.test.css");

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("text/css");
    expect(result.text).toMatchSnapshot();
  });
});
