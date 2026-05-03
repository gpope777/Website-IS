// astro.config.mjs
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://innovationaltms.com",
  output: "server",
  adapter: vercel({ webAnalytics: { enabled: true } }),
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "es",
        locales: { es: "es-PR", en: "en-US" },
      },
      filter: (page) => !page.includes("/api/"),
    }),
  ],
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en"],
    routing: { prefixDefaultLocale: false },
  },
  image: { service: { entrypoint: "astro/assets/services/sharp" } },
});
