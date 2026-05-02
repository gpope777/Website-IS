import es from "@/content/i18n/es.json";
import en from "@/content/i18n/en.json";

export type Lang = "es" | "en";

const dictionaries: Record<Lang, Record<string, string>> = { es, en };

export function t(key: string, lang: Lang): string {
  const value = dictionaries[lang][key];
  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key "${key}" for lang "${lang}"`);
    }
    return key;
  }
  return value;
}

export function getLangFromUrl(url: URL): Lang {
  return url.pathname.startsWith("/en") ? "en" : "es";
}

export interface RouteMapping {
  es: string;
  en: string;
}

const ROUTE_MAP: RouteMapping[] = [
  { es: "/", en: "/en/" },
  { es: "/servicios", en: "/en/services" },
  { es: "/sobre-nosotros", en: "/en/about" },
  { es: "/contacto", en: "/en/contact" },
];

export function translateRoute(currentPath: string, targetLang: Lang): string {
  if (currentPath.startsWith("/la-gran-pregunta")) return currentPath;
  const match = ROUTE_MAP.find((r) => r.es === currentPath || r.en === currentPath);
  if (!match) return targetLang === "en" ? "/en/" : "/";
  return targetLang === "es" ? match.es : match.en;
}
