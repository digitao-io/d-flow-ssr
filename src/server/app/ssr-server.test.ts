import supertest from "supertest";
import { Configuration } from "./configuration";
import { createVueApp } from "../../vue/vue-app";
import { DataResolver } from "../data-resolver/data-resolver";
import { SsrServer } from "./ssr-server";

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
