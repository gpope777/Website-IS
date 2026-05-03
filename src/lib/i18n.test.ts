import { describe, it, expect } from "vitest";
import { t, getLangFromUrl, translateRoute } from "./i18n";

describe("t()", () => {
  it("returns ES translation", () => {
    expect(t("nav.servicios", "es")).toBe("Servicios");
  });

  it("returns EN translation", () => {
    expect(t("nav.servicios", "en")).toBe("Services");
  });

  it("returns the key itself when missing", () => {
    expect(t("does.not.exist", "es")).toBe("does.not.exist");
  });
});

describe("getLangFromUrl()", () => {
  it("detects ES from root URL", () => {
    expect(getLangFromUrl(new URL("https://x.com/"))).toBe("es");
  });

  it("detects EN from /en URL", () => {
    expect(getLangFromUrl(new URL("https://x.com/en/services"))).toBe("en");
  });
});

describe("translateRoute()", () => {
  it("maps ES home to EN home", () => {
    expect(translateRoute("/", "en")).toBe("/en");
  });

  it("maps EN services to ES services", () => {
    expect(translateRoute("/en/services", "es")).toBe("/servicios");
  });

  it("preserves La Gran Pregunta routes (Spanish-only)", () => {
    expect(translateRoute("/la-gran-pregunta/el-primer-ano", "en")).toBe("/la-gran-pregunta/el-primer-ano");
  });

  it("falls back to home for unknown routes", () => {
    expect(translateRoute("/unknown", "en")).toBe("/en");
  });
});
