import express from "express";
import Handlebars from "handlebars";
import { Router } from "express";
import { renderToString } from "vue/server-renderer";
import { DataResolver } from "../data-resolver/data-resolver";
import { Page, ResolvedPageDetails } from "../models/page";
import { Configuration } from "./configuration";
import { VueAppProvider } from "./ssr-server";

interface RenderResult {
  language: string;
  title: string;
  head: string;
  content: string;
};

interface TemplateParams {
  language: Handlebars.SafeString;
  title: Handlebars.SafeString;
  head: Handlebars.SafeString;
  content: Handlebars.SafeString;
}

export class DynamicRouter<CONFIG extends Configuration> {
  private buildVueApp: VueAppProvider;
  private dataResolver: DataResolver<CONFIG>;
  private htmlTemplate: HandlebarsTemplateDelegate<TemplateParams>;
  private config: CONFIG;

  public router: Router;

  public constructor(
    buildVueApp: VueAppProvider,
    dataResolver: DataResolver<CONFIG>,
    htmlTemplate: string,
    config: CONFIG,
  ) {
    this.buildVueApp = buildVueApp;
    this.dataResolver = dataResolver;
    this.htmlTemplate = Handlebars.compile(htmlTemplate);
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

          const html = this.htmlTemplate({
            language: new Handlebars.SafeString(renderResult.language),
            title: new Handlebars.SafeString(renderResult.title),
            head: new Handlebars.SafeString(renderResult.head),
            content: new Handlebars.SafeString(renderResult.content),
          });

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
    const content = await renderToString(this.buildVueApp(), ctx);

    return {
      language: pageDetails.language,
      title: pageDetails.title,
      head: `<script>window.context = ${JSON.stringify(ctx)}</script>`,
      content,
    };
  }
}
