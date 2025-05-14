import fs from "node:fs";
import express from "express";
import { Express } from "express";
import sirv from "sirv";
import helmet from "helmet";
import compression from "compression";
import { App } from "vue";
import { DataResolver } from "../data-resolver/data-resolver";
import { DynamicRouter } from "./dynamic-router";
import { Configuration, readConfiguration } from "./configuration";
import { Page } from "../models/page";

export interface SsrServerConfig<CONFIG extends Configuration> {
  buildVueApp: VueAppProvider;
  dataResolver: DataResolver<CONFIG>;
  fetchPages: PagesProvider<CONFIG>;
  configPath: string;
}

export type VueAppProvider = () => App;
export type PagesProvider<CONFIG> = (config: CONFIG) => Promise<Page[]>;

export class SsrServer<CONFIG extends Configuration> {
  private dynamicRouter: DynamicRouter<CONFIG>;
  private dataResolver: DataResolver<CONFIG>;
  private fetchPages: PagesProvider<CONFIG>;
  private htmlTemplate: string;
  private config: CONFIG;

  public express: Express;

  public constructor() {
    this.dynamicRouter = null as unknown as DynamicRouter<CONFIG>;
    this.dataResolver = null as unknown as DataResolver<CONFIG>;
    this.fetchPages = null as unknown as PagesProvider<CONFIG>;
    this.htmlTemplate = null as unknown as string;
    this.config = null as unknown as CONFIG;

    this.express = null as unknown as Express;
  }

  public async initialize(config: SsrServerConfig<CONFIG>) {
    this.config = readConfiguration(config.configPath);
    this.htmlTemplate = fs.readFileSync(this.config.htmlTemplatePath, "utf8");

    this.dynamicRouter = new DynamicRouter(
      config.buildVueApp,
      config.dataResolver,
      this.htmlTemplate,
      this.config,
    );
    this.dataResolver = config.dataResolver;
    this.fetchPages = config.fetchPages;

    const pages = await this.fetchPages(this.config);
    this.dynamicRouter.buildRoutes(pages);

    this.express = express();

    this.express.use(helmet({
      contentSecurityPolicy: {
        directives: this.config.contentSecurityPolicy,
      },
    }));

    this.express.use(compression());

    this.express.use("/", sirv(this.config.staticPath, { extensions: [] }));

    this.express.post("/maintenance/cache/clear", (_, res) => {
      this.dataResolver.clearCache();

      res.status(200);
      res.json({ status: "OK" });
      res.end();
    });

    this.express.post("/maintenance/page/fetch", async (_, res) => {
      const pages = await this.fetchPages(this.config);
      this.dynamicRouter.buildRoutes(pages);

      res.status(200);
      res.json({ status: "OK" });
      res.end();
    });

    this.express.use("/", (req, res, next) => {
      this.dynamicRouter.router(req, res, next);
    });
  }

  public run() {
    this.express.listen(this.config.port, () => {
      console.log(`Server started at port ${this.config.port}`);
    });
  }
}
