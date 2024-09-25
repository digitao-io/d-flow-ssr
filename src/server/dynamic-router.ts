import express from "express";
import { Router } from "express";
import { App } from "vue";
import { renderToString } from "vue/server-renderer";
import { DataResolver } from "../data-resolver/data-resolver";
import { Page, ResolvedPageDetails } from "../models/page";
import { Configuration } from "./configuration";

interface RenderResult {
  language: string;
  title: string;
  head: string;
  content: string;
};

export class DynamicRouter<CONFIG extends Configuration> {
  private vueApp: App;
  private dataResolver: DataResolver<CONFIG>;
  private htmlTemplate: string;
  private config: CONFIG;

  public router: Router;

  public constructor(
    vueApp: App,
    dataResolver: DataResolver<CONFIG>,
    htmlTemplate: string,
    config: CONFIG,
  ) {
    this.vueApp = vueApp;
    this.dataResolver = dataResolver;
    this.htmlTemplate = htmlTemplate;
    this.config = config;

    this.router = express.Router();
  }

  public buildRoutes(pages: Page[]) {
    this.router = express.Router();

    for (const page of pages) {
      const { urlPattern, details } = page;

      this.router.get(urlPattern, async (req, res) => {
        try {
          const resolvedPageDetails = await this.dataResolver.resolve({
            appConfig: this.config,
            pageUrlPath: req.path,
            pageUrlParams: req.params,
            pageUrlQueries: req.query as Record<string, string | string[]>,
          }, details);

          const renderResult = await this.render(resolvedPageDetails);

          const html = this.htmlTemplate
            .replace("$$PAGE_LANGUAGE$$", renderResult.language)
            .replace("$$PAGE_TITLE$$", renderResult.title)
            .replace("$$PAGE_HEAD$$", renderResult.head)
            .replace("$$PAGE_CONTENT$$", renderResult.content);

          res.status(200);
          res.contentType("text/html");
          res.send(html);
          res.end();
        }
        catch (e) {
          console.log(e);
          res.status(500);
          res.json({
            status: "FAILED",
            error: "INTERNAL_ERROR",
            message: "Internal error occurs",
          });
          res.end();
        }
      });
    }
  }

  private async render(pageDetails: ResolvedPageDetails): Promise<RenderResult> {
    const ctx = { pageDetails };
    const content = await renderToString(this.vueApp, ctx);

    return {
      language: pageDetails.language,
      title: pageDetails.title,
      head: `<script>window.context = ${JSON.stringify(ctx)}</script>`,
      content,
    };
  }
}
