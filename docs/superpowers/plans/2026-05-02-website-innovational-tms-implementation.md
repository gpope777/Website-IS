# Website IS · Innovational TMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Innovational TMS marketing website per spec — bilingual ES/EN landing + dedicated pages for services, about, contact, and the "La Gran Pregunta" article series, deployable to Vercel.

**Architecture:** Astro static site with island hydration only where needed (form, lang toggle, Calendly). Content lives in MDX collections. i18n via Astro's native router, with one Spanish-only article namespace. Form submits to a server endpoint that uses Resend.

**Tech Stack:** Astro 5+, TypeScript (strict), MDX, Vitest, Resend, Vercel, `@fontsource-variable/inter`, `@fontsource-variable/source-serif-4`, Zod.

**Spec reference:** `docs/superpowers/specs/2026-05-02-website-innovational-tms-design.md`.

**Project root:** `C:\Users\gabri\OneDrive\Desktop\Folder del plan\Website IS\` (already initialized as git repo with spec committed).

**Phasing:** Tasks are grouped into phases. Phase 1-3 produce a deployable Spanish-only MVP. Phase 4-5 add English. Phase 6-7 polish for production.

---

## Phase 1 — Foundations

### Task 1: Scaffold Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro` (placeholder)

- [ ] **Step 1.1: Run Astro create**

```bash
cd "C:/Users/gabri/OneDrive/Desktop/Folder del plan/Website IS"
npm create astro@latest -- . --template minimal --typescript strict --install --no-git --skip-houston --yes
```

Expected: Astro scaffolds the project in current directory. Existing `.gitignore`, `docs/`, `brand-assets/` are preserved (Astro template only adds new files).

- [ ] **Step 1.2: Add project dependencies**

```bash
npm install @astrojs/mdx @astrojs/sitemap @astrojs/vercel zod resend @fontsource-variable/inter @fontsource-variable/source-serif-4
npm install -D vitest @astrojs/check typescript @types/node
```

- [ ] **Step 1.3: Replace `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
  site: "https://innovationaltms.com",
  output: "hybrid",
  adapter: vercel({ webAnalytics: { enabled: true } }),
  integrations: [mdx(), sitemap()],
  i18n: {
    defaultLocale: "es",
    locales: ["es", "en"],
    routing: { prefixDefaultLocale: false },
  },
  image: { service: { entrypoint: "astro/assets/services/sharp" } },
});
```

- [ ] **Step 1.4: Update `tsconfig.json` strict mode**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", ".vercel", "node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"]
    }
  }
}
```

- [ ] **Step 1.5: Replace placeholder home with hello-world**

`src/pages/index.astro`:
```astro
---
---
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Innovational TMS</title>
  </head>
  <body>
    <h1>Innovational TMS · scaffolding OK</h1>
  </body>
</html>
```

- [ ] **Step 1.6: Verify dev server runs**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:4321/`, page shows "Innovational TMS · scaffolding OK". Stop server with Ctrl+C.

- [ ] **Step 1.7: Verify build succeeds**

```bash
npm run build
```

Expected: Build completes without errors, `dist/` directory created with `index.html`.

- [ ] **Step 1.8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src public .gitignore
git commit -m "chore: scaffold Astro project with i18n, MDX, Vercel adapter"
```

---

### Task 2: Global design tokens and base styles

**Files:**
- Create: `src/styles/global.css`, `src/styles/typography.css`, `src/styles/reset.css`

- [ ] **Step 2.1: Create CSS reset**

`src/styles/reset.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html, body { height: 100%; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; color: inherit; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
button { background: none; border: 0; cursor: pointer; padding: 0; }
a { color: inherit; text-decoration: none; }
ul, ol { padding: 0; list-style: none; }
:focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; }
```

- [ ] **Step 2.2: Create design tokens**

`src/styles/global.css`:
```css
@import "@fontsource-variable/inter";
@import "@fontsource-variable/source-serif-4/wght-italic.css";
@import "./reset.css";
@import "./typography.css";

:root {
  /* Color tokens */
  --orange: #EF5A21;
  --orange-soft: #FAC5B1;
  --orange-cream: #FCDED3;
  --slate: #405F6E;
  --slate-deep: #1F2D34;
  --ink: #0E1A20;
  --ink-deeper: #0a1418;
  --cream: #FAFAF7;
  --white: #FFFFFF;
  --border: #E5E9EB;
  --border-dark: rgba(255, 255, 255, 0.08);
  --error: #C0392B;
  --success: #27AE60;

  /* Typography */
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-serif: "Source Serif 4 Variable", Georgia, serif;
  --font-h1: clamp(36px, 5vw, 56px);
  --font-h2: clamp(28px, 3.6vw, 40px);
  --font-h3: 22px;
  --font-h4: 18px;
  --font-body: 16px;
  --font-small: 14px;
  --font-label: 11px;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space: 16px;
  --space-md: 24px;
  --space-lg: 32px;
  --space-xl: 48px;
  --space-2xl: 80px;
  --space-3xl: 120px;

  /* Radii */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(15, 26, 32, 0.06);
  --shadow: 0 12px 30px rgba(15, 26, 32, 0.08);
  --shadow-lg: 0 30px 80px rgba(15, 26, 32, 0.18);

  /* Layout */
  --container: 1180px;
  --container-tight: 720px;
}

body {
  font-family: var(--font-sans);
  font-size: var(--font-body);
  line-height: 1.65;
  color: var(--slate-deep);
  background: var(--cream);
}

a { color: var(--orange); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 2.3: Create typography utilities**

`src/styles/typography.css`:
```css
.eyebrow {
  font-size: var(--font-label);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--orange);
  font-weight: 700;
}

.h1 {
  font-size: var(--font-h1);
  line-height: 1.05;
  letter-spacing: -0.025em;
  font-weight: 800;
  font-family: var(--font-sans);
}

.h2 {
  font-size: var(--font-h2);
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-weight: 800;
}

.h1 em, .h2 em, .h3 em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 500;
}

.lede {
  font-size: 17px;
  line-height: 1.65;
  color: var(--slate);
  max-width: 60ch;
}

.signoff {
  font-size: var(--font-small);
  color: var(--slate);
  font-style: italic;
  display: inline-block;
  margin-top: var(--space-sm);
}

.label {
  font-size: var(--font-label);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
}

.container {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-md);
}

.container-tight {
  max-width: var(--container-tight);
  margin: 0 auto;
  padding: 0 var(--space-md);
}
```

- [ ] **Step 2.4: Verify build still succeeds**

```bash
npm run build
```

Expected: Build completes. CSS files are not imported anywhere yet, so they don't ship — that's fine for now.

- [ ] **Step 2.5: Commit**

```bash
git add src/styles
git commit -m "feat(styles): add design tokens, reset, and typography utilities"
```

---

### Task 3: BaseLayout component

**Files:**
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 3.1: Implement BaseLayout**

`src/layouts/BaseLayout.astro`:
```astro
---
import "@/styles/global.css";

export interface Props {
  title: string;
  description: string;
  ogImage?: string;
  canonical?: string;
  lang?: "es" | "en";
}

const { title, description, ogImage = "/og/default.jpg", canonical, lang = "es" } = Astro.props;
const canonicalUrl = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();
---

<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0E1A20" />
    <link rel="canonical" href={canonicalUrl} />

    <title>{title}</title>
    <meta name="description" content={description} />

    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={new URL(ogImage, Astro.site).toString()} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content="Innovational TMS" />
    <meta property="og:locale" content={lang === "es" ? "es_PR" : "en_US"} />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={new URL(ogImage, Astro.site).toString()} />

    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" hreflang="es" href={new URL(Astro.url.pathname.replace(/^\/en/, ""), Astro.site).toString()} />
    <link rel="alternate" hreflang="en" href={new URL(Astro.url.pathname.startsWith("/en") ? Astro.url.pathname : `/en${Astro.url.pathname}`, Astro.site).toString()} />

    <slot name="head" />
  </head>
  <body>
    <a href="#main" class="skip-link">Saltar al contenido principal</a>
    <slot name="nav" />
    <main id="main">
      <slot />
    </main>
    <slot name="footer" />
  </body>
</html>

<style is:global>
  .skip-link {
    position: absolute;
    left: -10000px;
    top: 12px;
    background: var(--ink);
    color: var(--white);
    padding: var(--space-sm) var(--space);
    border-radius: var(--radius);
    z-index: 9999;
  }
  .skip-link:focus { left: 12px; }
</style>
```

- [ ] **Step 3.2: Use BaseLayout in placeholder home**

Replace `src/pages/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
---
<BaseLayout
  title="Innovational TMS · Consultoría en Psicología I-O"
  description="Diseñamos las decisiones que hacen o rompen una organización. Consultoría en psicología industrial-organizacional."
  lang="es"
>
  <h1 class="h1">Hola desde BaseLayout</h1>
</BaseLayout>
```

- [ ] **Step 3.3: Verify in dev**

```bash
npm run dev
```

Open `http://localhost:4321/`, view source, verify `<head>` has all meta tags including OG, hreflang. Skip-link should appear when tabbing.

- [ ] **Step 3.4: Commit**

```bash
git add src/layouts src/pages/index.astro
git commit -m "feat(layout): add BaseLayout with i18n meta, OG, hreflang, skip-link"
```

---

### Task 4: i18n dictionaries and `t()` helper

**Files:**
- Create: `src/content/i18n/es.json`, `src/content/i18n/en.json`, `src/lib/i18n.ts`, `src/lib/i18n.test.ts`

- [ ] **Step 4.1: Create Spanish dictionary**

`src/content/i18n/es.json`:
```json
{
  "nav.servicios": "Servicios",
  "nav.sobre": "Sobre nosotros",
  "nav.articulos": "La Gran Pregunta",
  "nav.contacto": "Contacto",
  "cta.cuentame": "Cuéntame de tu organización",
  "cta.reserva": "Reserva 30 min",
  "cta.lee_articulos": "Lee La Gran Pregunta",
  "cta.conoce_servicios": "Conoce los servicios",
  "form.nombre": "Nombre",
  "form.email": "Email corporativo",
  "form.organizacion": "Organización",
  "form.mensaje": "¿Qué pasa en tu organización?",
  "form.enviar": "Enviar mensaje",
  "form.enviando": "Enviando…",
  "form.gracias": "Gracias. El Dr. Gómez te responderá en 1-2 días hábiles.",
  "form.error": "Algo falló. Intenta de nuevo o escríbenos directo.",
  "form.error_email_directo": "Abrir email",
  "form.placeholder_nombre": "María Pérez",
  "form.placeholder_email": "maria@empresa.com",
  "form.placeholder_organizacion": "Empresa Ejemplo S.A.",
  "form.placeholder_mensaje": "Cuéntanos qué te trae aquí. Mientras más concreto, mejor.",
  "form.error_min_mensaje": "Por favor escribe al menos 20 caracteres.",
  "form.error_email_invalido": "Email no válido.",
  "form.error_requerido": "Este campo es requerido.",
  "footer.copy": "© 2026 Innovational TMS · Talent Management Solutions",
  "footer.tagline": "Diseñamos cómo trabaja la gente.",
  "stats.anos_hr": "años en HR y consultoría",
  "stats.anos_posgrado": "años enseñando posgrado en PR",
  "stats.certificaciones": "certificaciones internacionales",
  "stats.phd": "PhD · Albizu Puerto Rico",
  "tiempoLectura.min": "min de lectura",
  "tiempoLectura.mins": "mins de lectura",
  "articulo.por": "Por",
  "articulo.publicado": "Publicado el",
  "articulo.relacionados": "Otros artículos de la serie"
}
```

- [ ] **Step 4.2: Create English dictionary**

`src/content/i18n/en.json`:
```json
{
  "nav.servicios": "Services",
  "nav.sobre": "About",
  "nav.articulos": "The Big Question",
  "nav.contacto": "Contact",
  "cta.cuentame": "Tell me about your organization",
  "cta.reserva": "Book 30 minutes",
  "cta.lee_articulos": "Read The Big Question",
  "cta.conoce_servicios": "See what we do",
  "form.nombre": "Name",
  "form.email": "Work email",
  "form.organizacion": "Organization",
  "form.mensaje": "What's happening in your organization?",
  "form.enviar": "Send message",
  "form.enviando": "Sending…",
  "form.gracias": "Thanks. Dr. Gómez will reply within 1-2 business days.",
  "form.error": "Something failed. Try again or email us directly.",
  "form.error_email_directo": "Open email",
  "form.placeholder_nombre": "Mary Smith",
  "form.placeholder_email": "mary@company.com",
  "form.placeholder_organizacion": "Example Co.",
  "form.placeholder_mensaje": "Tell us what brings you here. The more specific, the better.",
  "form.error_min_mensaje": "Please write at least 20 characters.",
  "form.error_email_invalido": "Invalid email.",
  "form.error_requerido": "This field is required.",
  "footer.copy": "© 2026 Innovational TMS · Talent Management Solutions",
  "footer.tagline": "We design how people work.",
  "stats.anos_hr": "years in HR and consulting",
  "stats.anos_posgrado": "years teaching graduate-level in PR",
  "stats.certificaciones": "international certifications",
  "stats.phd": "PhD · Albizu Puerto Rico",
  "tiempoLectura.min": "min read",
  "tiempoLectura.mins": "min read",
  "articulo.por": "By",
  "articulo.publicado": "Published on",
  "articulo.relacionados": "More from this series"
}
```

- [ ] **Step 4.3: Create i18n helper**

`src/lib/i18n.ts`:
```ts
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
```

- [ ] **Step 4.4: Write Vitest tests**

`src/lib/i18n.test.ts`:
```ts
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
    expect(translateRoute("/", "en")).toBe("/en/");
  });

  it("maps EN services to ES services", () => {
    expect(translateRoute("/en/services", "es")).toBe("/servicios");
  });

  it("preserves La Gran Pregunta routes (Spanish-only)", () => {
    expect(translateRoute("/la-gran-pregunta/el-primer-ano", "en")).toBe("/la-gran-pregunta/el-primer-ano");
  });

  it("falls back to home for unknown routes", () => {
    expect(translateRoute("/unknown", "en")).toBe("/en/");
  });
});
```

- [ ] **Step 4.5: Configure Vitest**

Update `package.json` `scripts`:
```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro",
  "check": "astro check",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4.6: Run tests**

```bash
npm test
```

Expected: 8 passing tests across `t()`, `getLangFromUrl()`, `translateRoute()`.

- [ ] **Step 4.7: Commit**

```bash
git add src/content/i18n src/lib package.json vitest.config.ts
git commit -m "feat(i18n): add ES/EN dictionaries, t() helper, route translation"
```

---

### Task 5: Content collection schemas

**Files:**
- Create: `src/content/config.ts`

- [ ] **Step 5.1: Define collections**

`src/content/config.ts`:
```ts
import { defineCollection, z } from "astro:content";

const articulos = defineCollection({
  type: "content",
  schema: ({ image }) => z.object({
    title: z.string(),
    fecha: z.date(),
    autor: z.string().default("Dr. Alejandro J. Gómez Betancourt"),
    resumen: z.string().min(80).max(400),
    imagen: image().optional(),
    imagenAlt: z.string(),
    tiempoLectura: z.number().int().positive(),
    tags: z.array(z.string()),
    publicado: z.boolean().default(true),
  }),
});

const TERRITORIOS = ["talent-acquisition", "employee-experience", "leadership-performance", "culture-change"] as const;

const servicios = defineCollection({
  type: "content",
  schema: z.object({
    titulo_es: z.string(),
    titulo_en: z.string(),
    territorio: z.enum(TERRITORIOS),
    orden: z.number().int(),
    resumen_es: z.string(),
    resumen_en: z.string(),
    herramientas: z.array(z.string()).optional(),
    publicado: z.boolean().default(true),
  }),
});

const valores = defineCollection({
  type: "content",
  schema: z.object({
    nombre_es: z.string(),
    nombre_en: z.string(),
    orden: z.number().int(),
    descripcion_es: z.string(),
    descripcion_en: z.string(),
  }),
});

export const collections = { articulos, servicios, valores };
```

- [ ] **Step 5.2: Run astro sync**

```bash
npm run astro sync
```

Expected: `.astro/types.d.ts` regenerated. No errors.

- [ ] **Step 5.3: Verify check passes**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/content/config.ts
git commit -m "feat(content): define schemas for articulos, servicios, valores collections"
```

---

### Task 6: Seed first article — *El primer año también se diseña*

**Files:**
- Create: `src/content/articulos/el-primer-ano-tambien-se-disena.mdx`

- [ ] **Step 6.1: Write the MDX file**

`src/content/articulos/el-primer-ano-tambien-se-disena.mdx`:
```mdx
---
title: "El primer año también se diseña"
fecha: 2026-04-29
autor: "Dr. Alejandro J. Gómez Betancourt"
resumen: "Después de quince años acompañando organizaciones, hay algo que se repite: las primeras semanas de un empleado casi nunca están diseñadas. Y eso cuesta — en productividad, en retención, en contrato psicológico."
imagenAlt: "Persona de espaldas mirando un edificio corporativo en el primer día de trabajo"
tiempoLectura: 6
tags:
  - onboarding
  - experiencia del empleado
  - 6 c's
  - retención
publicado: true
---

Cuando me incorporé a una empresa de telecomunicaciones hace varios años, mi *onboarding* duró aproximadamente cuarenta minutos. Una persona de Recursos Humanos me entregó un manual, me asignó una computadora, me explicó dónde estaba la cafetera, y me dijo "bienvenido". Pasé las siguientes seis semanas tratando de descifrar cómo funcionaba la organización a fuerza de prueba y error.

Disney, en cambio, le dedica treinta días a esto. Treinta días estructurados, con propósito, con seguimiento.

¿Por qué la diferencia?

## El costo de no diseñar el primer año

La investigación es bastante clara: un onboarding estructurado hace que el empleado sea **58% más propenso a permanecer tres años o más** en la organización, y aumenta significativamente su productividad. Lo contrario también está documentado — un onboarding improvisado alarga el tiempo hasta productividad, dispara la rotación temprana, y rompe el contrato psicológico antes de que tenga oportunidad de formarse.

El contrato psicológico es esa expectativa silenciosa, mutua, sobre cómo va a ser trabajar aquí. Y se forma en los primeros noventa días, sin importar si la organización lo está diseñando activamente o no. La pregunta no es *si* se forma, sino *si tú estás participando en cómo se forma*.

## El modelo de las 6 C's

Cuando una organización me pide ayuda con su experiencia de onboarding, trabajamos sobre seis dimensiones:

- **Compliance** — Documentación, accesos, sistemas. Lo más obvio, pero lo más fácil de descuidar.
- **Clarification** — Expectativas del rol, métricas de desempeño, cómo se ve el éxito en los próximos 90 días.
- **Confidence** — Progresión gradual de tareas con feedback frecuente para que la persona se sienta capaz.
- **Connection** — Construir relaciones cruzadas entre equipos. Sin esto, el empleado se siente isla.
- **Culture** — Mostrar y modelar los valores en acción, no en presentaciones.
- **Checkback** — Seguimiento estructurado a 30, 60, 90 días, y al cierre del primer año.

La mayoría de organizaciones se concentran en *Compliance* y *Clarification* (el "papeleo y el qué hacer") y olvidan las otras cuatro. Esas otras cuatro son las que predicen retención.

## Una pregunta para ti

Si el primer año de empleo también se diseña, ¿qué cambiarías o mejorarías mañana en el onboarding de tu organización?

Esa es la pregunta de esta entrega.

—

*Esta es la primera entrega de **La Gran Pregunta**, una serie donde reviso prácticas comunes de gestión de talento desde la psicología industrial-organizacional. Si tu organización está rediseñando cómo recibe a sus nuevos empleados, [hablemos](/contacto).*
```

- [ ] **Step 6.2: Sync content**

```bash
npm run astro sync
```

Expected: No errors. Frontmatter validates against schema.

- [ ] **Step 6.3: Commit**

```bash
git add src/content/articulos
git commit -m "content: add first article 'El primer año también se diseña'"
```

---

### Task 7: Seed services and values content

**Files:**
- Create: 14 files in `src/content/servicios/` + 5 files in `src/content/valores/`

- [ ] **Step 7.1: Create the four services in territorio "talent-acquisition"**

`src/content/servicios/strategic-talent-acquisition.mdx`:
```mdx
---
titulo_es: "Adquisición estratégica de talento"
titulo_en: "Strategic Talent Acquisition"
territorio: "talent-acquisition"
orden: 1
resumen_es: "Diseño de estrategias de atracción alineadas a la dirección estratégica de la organización, no a la urgencia del mes."
resumen_en: "Designing attraction strategies aligned to the organization's strategy, not to this month's panic."
herramientas: ["Job analysis", "Workforce planning", "EVP frameworks"]
---
```

`src/content/servicios/workforce-planning.mdx`:
```mdx
---
titulo_es: "Planificación de fuerza laboral"
titulo_en: "Workforce Planning"
territorio: "talent-acquisition"
orden: 2
resumen_es: "Análisis cuantitativo y cualitativo de qué talento vas a necesitar, cuándo, y por qué — antes de tener que contratar bajo presión."
resumen_en: "Quantitative and qualitative analysis of what talent you'll need, when, and why — before you have to hire under pressure."
herramientas: ["Demand modeling", "Skills mapping"]
---
```

`src/content/servicios/talent-acquisition-advisory.mdx`:
```mdx
---
titulo_es: "Asesoría en adquisición de talento"
titulo_en: "Talent Acquisition Advisory"
territorio: "talent-acquisition"
orden: 3
resumen_es: "Acompañamiento al equipo de reclutamiento para mejorar criterios, procesos y métricas. No reemplazamos al equipo: lo elevamos."
resumen_en: "Hands-on advisory for your recruiting team — improving criteria, process, and metrics. We don't replace the team; we elevate it."
herramientas: ["Process design", "Recruiter coaching"]
---
```

`src/content/servicios/candidate-experience-design.mdx`:
```mdx
---
titulo_es: "Diseño de experiencia del candidato"
titulo_en: "Candidate Experience Design"
territorio: "talent-acquisition"
orden: 4
resumen_es: "Cada interacción del proceso de selección comunica algo sobre la organización. La diseñamos para que diga lo que tú quieres decir."
resumen_en: "Every step of your hiring process tells candidates something about the organization. We design it to say what you actually want to say."
---
```

- [ ] **Step 7.2: Continue talent-acquisition territory (3 more)**

`src/content/servicios/job-profiling-talent-segmentation.mdx`:
```mdx
---
titulo_es: "Perfilamiento y segmentación de talento"
titulo_en: "Job Profiling & Talent Segmentation"
territorio: "talent-acquisition"
orden: 5
resumen_es: "Identificación de perfiles críticos y segmentación por niveles de impacto. Sirve para diseñar diferenciadamente onboarding, desarrollo y compensación."
resumen_en: "Identifying critical profiles and segmenting by impact level — the foundation for differentiated onboarding, development, and compensation."
---
```

`src/content/servicios/job-analysis-specification.mdx`:
```mdx
---
titulo_es: "Análisis y especificación de puestos"
titulo_en: "Job Analysis and Specification"
territorio: "talent-acquisition"
orden: 6
resumen_es: "Descripciones de puesto basadas en evidencia: qué se hace, con qué herramientas, bajo qué condiciones, y qué predice desempeño."
resumen_en: "Evidence-based job descriptions: what gets done, with what tools, under what conditions, and what predicts performance."
herramientas: ["O*NET methodology", "Critical incident technique"]
---
```

`src/content/servicios/evp-employer-branding.mdx`:
```mdx
---
titulo_es: "EVP y employer branding"
titulo_en: "EVP and Employer Branding"
territorio: "talent-acquisition"
orden: 7
resumen_es: "Articular qué hace única a tu organización como lugar de trabajo. No es marketing — es honestidad estratégica."
resumen_en: "Articulating what makes your organization unique as a workplace. Not marketing — strategic honesty."
---
```

- [ ] **Step 7.3: Employee Experience services (2)**

`src/content/servicios/employee-experience-redesign.mdx`:
```mdx
---
titulo_es: "Evaluación y rediseño de la experiencia del empleado"
titulo_en: "Employee Experience Evaluation and Redesign"
territorio: "employee-experience"
orden: 1
resumen_es: "Diagnóstico de los momentos críticos del ciclo de vida del empleado — y rediseño de los que están rotos."
resumen_en: "Diagnosing the critical moments in the employee lifecycle — and redesigning the ones that are broken."
herramientas: ["Journey mapping", "Pulse surveys", "Exit interviews"]
---
```

`src/content/servicios/onboarding-experience-design.mdx`:
```mdx
---
titulo_es: "Diseño de experiencia de onboarding"
titulo_en: "Onboarding Experience Design"
territorio: "employee-experience"
orden: 2
resumen_es: "El primer año se diseña, no se improvisa. Estructuramos los seis momentos del onboarding (cumplimiento, claridad, confianza, conexión, cultura, seguimiento) sobre evidencia, no sobre intuición."
resumen_en: "The first year is designed, not improvised. We structure the six onboarding moments (compliance, clarification, confidence, connection, culture, checkback) on evidence, not intuition."
herramientas: ["6 C's framework", "30/60/90 plans", "Buddy systems"]
---
```

- [ ] **Step 7.4: Leadership & Performance services (3)**

`src/content/servicios/leadership-development.mdx`:
```mdx
---
titulo_es: "Desarrollo de liderazgo"
titulo_en: "Leadership Development Programs"
territorio: "leadership-performance"
orden: 1
resumen_es: "Programas individualizados con assessments validados (Hogan, DISC, McKinsey) y supervisión real. Nada de talleres genéricos."
resumen_en: "Individualized programs with validated assessments (Hogan, DISC, McKinsey) and real supervision. No generic workshops."
herramientas: ["Hogan Assessment", "DISC", "McKinsey Leadership"]
---
```

`src/content/servicios/effective-supervision-training.mdx`:
```mdx
---
titulo_es: "Entrenamiento en supervisión efectiva"
titulo_en: "Effective Supervision Training"
territorio: "leadership-performance"
orden: 2
resumen_es: "Programas para mandos medios — la capa que más impacta el clima y el desempeño del día a día."
resumen_en: "Training for middle management — the layer with the largest day-to-day impact on climate and performance."
---
```

`src/content/servicios/performance-management.mdx`:
```mdx
---
titulo_es: "Sistemas de gestión del desempeño"
titulo_en: "Performance Management Systems"
territorio: "leadership-performance"
orden: 3
resumen_es: "Diseño de procesos de evaluación que predicen y mejoran desempeño, no que solo lo documentan."
resumen_en: "Designing evaluation processes that predict and improve performance — not just document it."
herramientas: ["Goal setting frameworks", "Calibration sessions", "Feedback systems"]
---
```

- [ ] **Step 7.5: Culture & Change services (2)**

`src/content/servicios/culture-transformation.mdx`:
```mdx
---
titulo_es: "Transformación cultural"
titulo_en: "Organizational Culture Transformation"
territorio: "culture-change"
orden: 1
resumen_es: "La cultura se cambia con decisiones, no con frases motivacionales. Acompañamos la lenta y deliberada parte real."
resumen_en: "Culture changes through decisions, not motivational quotes. We support the slow, deliberate, real part."
herramientas: ["Culture diagnostics", "Behavioral nudges", "Leadership alignment"]
---
```

`src/content/servicios/change-management.mdx`:
```mdx
---
titulo_es: "Consultoría en gestión del cambio"
titulo_en: "Change Management Consulting"
territorio: "culture-change"
orden: 2
resumen_es: "Fusiones, reorganizaciones, crecimiento acelerado. Acompañamos los momentos donde la cultura se rompe o se consolida."
resumen_en: "Mergers, reorgs, accelerated growth. We support the moments when culture either breaks or hardens."
herramientas: ["M&A integration", "Stakeholder mapping", "Communication strategy"]
---
```

- [ ] **Step 7.6: Create the 5 values**

`src/content/valores/curiosity.mdx`:
```mdx
---
nombre_es: "Curiosidad"
nombre_en: "Curiosity"
orden: 1
descripcion_es: "Un impulso constante por explorar nuevos métodos, descubrir potencial sin explotar y cuestionar el status quo."
descripcion_en: "A relentless drive to explore new methods, uncover untapped potential, and question the status quo."
---
```

`src/content/valores/agility.mdx`:
```mdx
---
nombre_es: "Agilidad"
nombre_en: "Agility"
orden: 2
descripcion_es: "La capacidad de pivotar rápido y diseñar soluciones que se mantengan al ritmo de las necesidades cambiantes de la organización."
descripcion_en: "The ability to pivot quickly and design solutions that keep pace with evolving organizational needs."
---
```

`src/content/valores/visionary-thinking.mdx`:
```mdx
---
nombre_es: "Pensamiento visionario"
nombre_en: "Visionary Thinking"
orden: 3
descripcion_es: "Un enfoque en estrategias hacia el futuro que anticipan tendencias y promueven éxito a largo plazo."
descripcion_en: "A focus on future-forward strategies that anticipate trends and foster long-term success."
---
```

`src/content/valores/collaborative-creativity.mdx`:
```mdx
---
nombre_es: "Creatividad colaborativa"
nombre_en: "Collaborative Creativity"
orden: 4
descripcion_es: "Asociarnos con nuestros clientes para co-crear experiencias transformadoras que inspiren crecimiento."
descripcion_en: "Partnering with our clients to co-create transformative experiences that inspire growth."
---
```

`src/content/valores/resilience.mdx`:
```mdx
---
nombre_es: "Resiliencia"
nombre_en: "Resilience"
orden: 5
descripcion_es: "El coraje de abrazar los retos y convertirlos en oportunidades de innovación disruptiva."
descripcion_en: "The courage to embrace challenges and turn them into opportunities for breakthrough innovation."
---
```

- [ ] **Step 7.7: Sync content and verify**

```bash
npm run astro sync
npm run check
```

Expected: All 14 services + 5 values validated. No errors.

- [ ] **Step 7.8: Commit**

```bash
git add src/content/servicios src/content/valores
git commit -m "content: seed 14 services and 5 values"
```

---

## Phase 2 — UI primitives and section components

### Task 8: UI primitives — Button

**Files:**
- Create: `src/components/ui/Button.astro`

- [ ] **Step 8.1: Implement Button**

`src/components/ui/Button.astro`:
```astro
---
export interface Props {
  variant?: "primary" | "ghost" | "outline-light" | "outline-dark";
  size?: "md" | "lg";
  href?: string;
  type?: "button" | "submit";
  class?: string;
  disabled?: boolean;
}

const { variant = "primary", size = "md", href, type = "button", class: className, disabled } = Astro.props;
const Tag = href ? "a" : "button";
const classes = ["btn", `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(" ");
---

<Tag
  class={classes}
  href={href}
  type={!href ? type : undefined}
  disabled={!href && disabled ? true : undefined}
  aria-disabled={disabled ? "true" : undefined}
>
  <slot />
</Tag>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 600;
    border-radius: var(--radius);
    transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    cursor: pointer;
    text-decoration: none;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn[disabled], .btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; transform: none; }

  .btn--md { padding: 12px 20px; font-size: 14px; }
  .btn--lg { padding: 14px 26px; font-size: 15px; }

  .btn--primary { background: var(--orange); color: var(--white); }
  .btn--primary:hover { background: #d94f1d; }

  .btn--ghost { color: var(--white); padding-left: 4px; padding-right: 4px; text-decoration: underline; text-decoration-color: rgba(239, 90, 33, 0.6); text-underline-offset: 6px; }
  .btn--ghost:hover { text-decoration-color: var(--orange); }

  .btn--outline-light { background: transparent; color: var(--white); border: 1.5px solid rgba(255, 255, 255, 0.3); }
  .btn--outline-light:hover { border-color: var(--white); }

  .btn--outline-dark { background: transparent; color: var(--slate-deep); border: 1.5px solid var(--slate); }
  .btn--outline-dark:hover { background: var(--slate-deep); color: var(--white); }
</style>
```

- [ ] **Step 8.2: Smoke-test on home page**

Update `src/pages/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Button from "@/components/ui/Button.astro";
---
<BaseLayout title="Innovational TMS" description="Test" lang="es">
  <div class="container" style="padding: 60px 0;">
    <Button variant="primary">Cuéntame de tu organización →</Button>
    <Button variant="ghost">Lee La Gran Pregunta</Button>
    <Button variant="outline-dark" href="/servicios">Conoce los servicios</Button>
  </div>
</BaseLayout>
```

Run `npm run dev` and verify visually that all three button variants render correctly.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/ui/Button.astro src/pages/index.astro
git commit -m "feat(ui): add Button component with primary, ghost, outline variants"
```

---

### Task 9: Nav + LangToggle

**Files:**
- Create: `src/components/layout/Nav.astro`, `src/components/layout/LangToggle.astro`

- [ ] **Step 9.1: Implement LangToggle**

`src/components/layout/LangToggle.astro`:
```astro
---
import { translateRoute, type Lang } from "@/lib/i18n";

export interface Props {
  currentLang: Lang;
  currentPath: string;
  variant?: "dark" | "light";
}

const { currentLang, currentPath, variant = "dark" } = Astro.props;
const otherLang: Lang = currentLang === "es" ? "en" : "es";
const otherPath = translateRoute(currentPath, otherLang);
---

<a class={`lang-toggle lang-toggle--${variant}`} href={otherPath} aria-label={`Switch to ${otherLang.toUpperCase()}`}>
  <span class={currentLang === "es" ? "active" : ""}>ES</span>
  <span class="sep" aria-hidden="true">·</span>
  <span class={currentLang === "en" ? "active" : ""}>EN</span>
</a>

<script>
  document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    const lang = path.startsWith("/en") ? "en" : "es";
    try { localStorage.setItem("lang", lang); } catch {}
  });
</script>

<style>
  .lang-toggle {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    letter-spacing: 0.08em;
    padding: 5px 12px;
    border-radius: var(--radius-pill);
    font-weight: 600;
    text-decoration: none;
  }
  .lang-toggle--dark { border: 1px solid rgba(255, 255, 255, 0.18); color: var(--white); opacity: 0.85; }
  .lang-toggle--light { border: 1px solid var(--border); color: var(--slate-deep); }
  .lang-toggle:hover { opacity: 1; }
  .active { color: var(--orange); }
  .sep { opacity: 0.4; }
</style>
```

- [ ] **Step 9.2: Implement Nav**

`src/components/layout/Nav.astro`:
```astro
---
import LangToggle from "./LangToggle.astro";
import { t, type Lang } from "@/lib/i18n";

export interface Props {
  lang: Lang;
  currentPath: string;
  transparent?: boolean;
}

const { lang, currentPath, transparent = false } = Astro.props;
const linksEs = [
  { href: "/servicios", key: "nav.servicios" },
  { href: "/sobre-nosotros", key: "nav.sobre" },
  { href: "/la-gran-pregunta", key: "nav.articulos" },
  { href: "/contacto", key: "nav.contacto" },
];
const linksEn = [
  { href: "/en/services", key: "nav.servicios" },
  { href: "/en/about", key: "nav.sobre" },
  { href: "/la-gran-pregunta", key: "nav.articulos" },
  { href: "/en/contact", key: "nav.contacto" },
];
const links = lang === "es" ? linksEs : linksEn;
const homeHref = lang === "es" ? "/" : "/en/";
---

<nav class={`site-nav ${transparent ? "site-nav--transparent" : ""}`} data-transparent={transparent ? "true" : "false"}>
  <div class="container nav-inner">
    <a href={homeHref} class="brand" aria-label="Innovational TMS home">
      <span class="brand-mark">innovational</span>
      <span class="brand-dot">·</span>
      <span class="brand-name">TMS</span>
    </a>

    <ul class="nav-links">
      {links.map((link) => (
        <li>
          <a href={link.href} class={currentPath === link.href ? "active" : ""}>
            {t(link.key, lang)}
          </a>
        </li>
      ))}
    </ul>

    <LangToggle currentLang={lang} currentPath={currentPath} />
  </div>
</nav>

<script>
  const nav = document.querySelector(".site-nav");
  if (nav?.getAttribute("data-transparent") === "true") {
    const onScroll = () => {
      if (window.scrollY > 60) nav.classList.add("site-nav--solid");
      else nav.classList.remove("site-nav--solid");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
</script>

<style>
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--ink);
    color: var(--white);
    transition: background 0.2s ease;
  }
  .site-nav--transparent { background: transparent; }
  .site-nav--transparent.site-nav--solid { background: rgba(14, 26, 32, 0.92); backdrop-filter: blur(10px); }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; gap: 24px; }
  .brand { display: inline-flex; align-items: baseline; gap: 6px; font-weight: 700; letter-spacing: -0.02em; font-size: 16px; }
  .brand-dot { color: var(--orange); }
  .brand-name { font-weight: 600; opacity: 0.9; }
  .nav-links { display: flex; gap: 22px; flex: 1; justify-content: center; }
  .nav-links a { color: var(--white); opacity: 0.78; font-size: 14px; font-weight: 500; transition: opacity 0.15s; }
  .nav-links a:hover, .nav-links a.active { opacity: 1; color: var(--orange); }
  @media (max-width: 768px) {
    .nav-links { display: none; }
  }
</style>
```

- [ ] **Step 9.3: Smoke test in home**

Update `src/pages/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Button from "@/components/ui/Button.astro";

const lang = "es";
---
<BaseLayout title="Innovational TMS" description="Test" lang={lang}>
  <Nav slot="nav" lang={lang} currentPath={Astro.url.pathname} transparent={true} />
  <div style="background: var(--ink); color: var(--white); min-height: 70vh; padding: 80px 24px;">
    <div class="container">
      <h1 class="h1">Hero placeholder</h1>
    </div>
  </div>
  <div class="container" style="padding: 60px 0;">
    <p>Scroll para ver el efecto del nav.</p>
  </div>
</BaseLayout>
```

Run `npm run dev`, scroll down, verify nav background turns from transparent to solid blur.

- [ ] **Step 9.4: Commit**

```bash
git add src/components/layout src/pages/index.astro
git commit -m "feat(layout): add Nav with sticky transparent-on-hero behavior, LangToggle"
```

---

### Task 10: Footer

**Files:**
- Create: `src/components/layout/Footer.astro`

- [ ] **Step 10.1: Implement Footer**

`src/components/layout/Footer.astro`:
```astro
---
import LangToggle from "./LangToggle.astro";
import { t, type Lang } from "@/lib/i18n";

export interface Props {
  lang: Lang;
  currentPath: string;
}

const { lang, currentPath } = Astro.props;
const homeHref = lang === "es" ? "/" : "/en/";
const year = new Date().getFullYear();
---

<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <a href={homeHref} class="brand">innovational <span class="dot">·</span> TMS</a>
      <p class="tagline">{t("footer.tagline", lang)}</p>
    </div>

    <nav class="footer-links">
      <a href={lang === "es" ? "/servicios" : "/en/services"}>{t("nav.servicios", lang)}</a>
      <a href={lang === "es" ? "/sobre-nosotros" : "/en/about"}>{t("nav.sobre", lang)}</a>
      <a href="/la-gran-pregunta">{t("nav.articulos", lang)}</a>
      <a href={lang === "es" ? "/contacto" : "/en/contact"}>{t("nav.contacto", lang)}</a>
    </nav>

    <div class="footer-meta">
      <LangToggle currentLang={lang} currentPath={currentPath} />
      <p class="copy">© {year} Innovational TMS · Talent Management Solutions</p>
    </div>
  </div>
</footer>

<style>
  .site-footer { background: var(--ink-deeper); color: var(--white); padding: 56px 0 32px; }
  .footer-inner { display: grid; grid-template-columns: 1.5fr 2fr 1fr; gap: 32px; align-items: start; }
  @media (max-width: 768px) { .footer-inner { grid-template-columns: 1fr; gap: 24px; } }
  .brand { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
  .dot { color: var(--orange); }
  .tagline { font-family: var(--font-serif); font-style: italic; color: rgba(255, 255, 255, 0.7); margin-top: 8px; }
  .footer-links { display: flex; flex-wrap: wrap; gap: 18px; padding-top: 6px; }
  .footer-links a { color: rgba(255, 255, 255, 0.78); font-size: 14px; }
  .footer-links a:hover { color: var(--orange); }
  .footer-meta { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
  @media (max-width: 768px) { .footer-meta { align-items: flex-start; } }
  .copy { font-size: 12px; color: rgba(255, 255, 255, 0.5); }
</style>
```

- [ ] **Step 10.2: Add to home and verify**

Update `src/pages/index.astro` to include `<Footer slot="footer" lang={lang} currentPath={Astro.url.pathname} />`. Run `npm run dev`, verify footer appears at bottom.

- [ ] **Step 10.3: Commit**

```bash
git add src/components/layout/Footer.astro src/pages/index.astro
git commit -m "feat(layout): add Footer with bilingual links, lang toggle, tagline"
```

---

### Task 11: Hero section

**Files:**
- Create: `src/components/sections/Hero.astro`

- [ ] **Step 11.1: Implement Hero**

`src/components/sections/Hero.astro`:
```astro
---
import Button from "@/components/ui/Button.astro";

export interface Props {
  eyebrow: string;
  /** Headline can include `<em>` for editorial italic emphasis */
  headlineHtml: string;
  lede: string;
  signoff?: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  photoSrc?: string;
  photoAlt?: string;
  photoLabelName?: string;
  photoLabelRole?: string;
}

const {
  eyebrow,
  headlineHtml,
  lede,
  signoff,
  ctaPrimary,
  ctaSecondary,
  photoSrc,
  photoAlt = "",
  photoLabelName,
  photoLabelRole,
} = Astro.props;
---

<section class="hero">
  <div class="container hero-grid">
    <div class="hero-text">
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="h1 hero-headline" set:html={headlineHtml} />
      <p class="lede">{lede}</p>
      {signoff && <span class="signoff">— {signoff}</span>}
      <div class="cta-row">
        <Button variant="primary" size="lg" href={ctaPrimary.href}>{ctaPrimary.label}</Button>
        {ctaSecondary && <Button variant="ghost" href={ctaSecondary.href}>{ctaSecondary.label}</Button>}
      </div>
    </div>

    {photoSrc && (
      <div class="hero-photo">
        <img src={photoSrc} alt={photoAlt} loading="eager" decoding="async" width="600" height="750" />
        {(photoLabelName || photoLabelRole) && (
          <div class="hero-photo-meta">
            {photoLabelName && <div class="name">{photoLabelName}</div>}
            {photoLabelRole && <div class="role">{photoLabelRole}</div>}
          </div>
        )}
      </div>
    )}
  </div>
</section>

<style>
  .hero {
    background: var(--ink);
    color: var(--white);
    padding: 120px 0 96px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: "";
    position: absolute;
    right: -180px;
    top: -120px;
    width: 600px;
    height: 600px;
    border-radius: 999px;
    background: radial-gradient(closest-side, rgba(239, 90, 33, 0.30), transparent 70%);
    filter: blur(20px);
    pointer-events: none;
  }
  .hero::after {
    content: "";
    position: absolute;
    left: -200px;
    bottom: -200px;
    width: 480px;
    height: 480px;
    border-radius: 999px;
    background: radial-gradient(closest-side, rgba(64, 95, 110, 0.42), transparent 70%);
    filter: blur(20px);
    pointer-events: none;
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 64px;
    align-items: center;
    position: relative;
  }
  @media (max-width: 900px) { .hero-grid { grid-template-columns: 1fr; gap: 40px; } }

  .hero-headline { margin: 14px 0 0; }
  .hero-headline :global(em) { color: var(--orange-cream); }
  .lede { color: rgba(255, 255, 255, 0.82); margin-top: 20px; max-width: 560px; }
  .signoff { color: rgba(255, 255, 255, 0.7); }
  .cta-row { margin-top: 28px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }

  .hero-photo {
    aspect-ratio: 4 / 5;
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
    background: linear-gradient(140deg, var(--orange-soft) 0%, var(--orange) 50%, var(--slate-deep) 100%);
  }
  .hero-photo img { width: 100%; height: 100%; object-fit: cover; }
  .hero-photo-meta {
    position: absolute;
    bottom: 14px;
    left: 14px;
    right: 14px;
    background: rgba(14, 26, 32, 0.78);
    backdrop-filter: blur(8px);
    padding: 12px 14px;
    border-radius: var(--radius);
    font-size: 13px;
  }
  .hero-photo-meta .name { font-weight: 700; color: var(--white); }
  .hero-photo-meta .role { color: rgba(255, 255, 255, 0.85); margin-top: 2px; font-size: 12px; }
</style>
```

- [ ] **Step 11.2: Replace home placeholder with real Hero**

Update `src/pages/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import Hero from "@/components/sections/Hero.astro";
import { t } from "@/lib/i18n";

const lang = "es";
const path = Astro.url.pathname;
---
<BaseLayout
  title="Innovational TMS · Consultoría en Psicología I-O"
  description="La gente buena no renuncia por dinero. Renuncia por decisiones que se tomaron meses antes."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} transparent={true} />

  <Hero
    eyebrow="Consultoría · Psicología Industrial-Organizacional"
    headlineHtml="La gente buena no <em>renuncia por dinero.</em><br>Renuncia por decisiones que se tomaron meses antes."
    lede="Después de quince años acompañando organizaciones, hay algo que se repite: el problema casi nunca es 'falta de talento'. Es que las decisiones sobre la gente se siguen tomando por intuición. Yo ofrezco metodología, evidencia y un par de preguntas incómodas."
    signoff="Dr. Alejandro J. Gómez Betancourt"
    ctaPrimary={{ label: t("cta.cuentame", lang) + " →", href: "/contacto" }}
    ctaSecondary={{ label: t("cta.lee_articulos", lang), href: "/la-gran-pregunta" }}
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    photoLabelName="Dr. Alejandro J. Gómez Betancourt"
    photoLabelRole="PhD · Psicólogo I-O · Presidente y Senior Consultant"
  />

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>
```

- [ ] **Step 11.3: Copy founder photo into public**

```bash
cp brand-assets/dr-gomez-from-pdf.png public/dr-gomez.jpg
```

(Placeholder until HD photo is provided.)

- [ ] **Step 11.4: Verify hero in browser**

Run `npm run dev`. Open `http://localhost:4321/`. Verify:
- Dark hero with orange glow
- Headline shows "renuncia por dinero" in serif italic, orange-cream color
- Photo with metadata overlay appears on right
- Both CTAs render correctly
- On mobile (resize viewport), grid collapses to single column

- [ ] **Step 11.5: Commit**

```bash
git add src/components/sections/Hero.astro src/pages/index.astro public/dr-gomez.jpg
git commit -m "feat(sections): add Hero with editorial italic emphasis and founder photo"
```

---

### Task 12: StatsBand section

**Files:**
- Create: `src/components/sections/StatsBand.astro`

- [ ] **Step 12.1: Implement StatsBand**

`src/components/sections/StatsBand.astro`:
```astro
---
export interface Stat {
  num: string;
  label: string;
}

export interface Props {
  stats: Stat[];
}

const { stats } = Astro.props;
---

<section class="stats-band">
  <div class="container stats-grid">
    {stats.map((stat) => (
      <div class="stat">
        <div class="num">{stat.num}</div>
        <div class="lbl" set:html={stat.label} />
      </div>
    ))}
  </div>
</section>

<style>
  .stats-band { background: var(--ink-deeper); color: var(--white); padding: 36px 0; border-top: 1px solid rgba(255, 255, 255, 0.06); }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
  @media (max-width: 700px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
  .stat .num { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; color: var(--orange); line-height: 1; }
  .stat .lbl { font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 6px; line-height: 1.4; }
</style>
```

- [ ] **Step 12.2: Add to home below Hero**

In `src/pages/index.astro`, after `<Hero />`:
```astro
<StatsBand
  stats={[
    { num: "15", label: "años en HR<br>y consultoría" },
    { num: "20", label: "años enseñando<br>posgrado en PR" },
    { num: "4", label: "certificaciones<br>internacionales" },
    { num: "1", label: "PhD · Albizu<br>Puerto Rico" },
  ]}
/>
```

Add the import: `import StatsBand from "@/components/sections/StatsBand.astro";`

- [ ] **Step 12.3: Verify in browser**

Run `npm run dev`, scroll past hero, verify 4-column stats band on desktop, 2x2 on mobile.

- [ ] **Step 12.4: Commit**

```bash
git add src/components/sections/StatsBand.astro src/pages/index.astro
git commit -m "feat(sections): add StatsBand with responsive grid"
```

---

### Task 13: ServiceCard + ServicesGrid

**Files:**
- Create: `src/components/ui/ServiceCard.astro`, `src/components/sections/ServicesGrid.astro`

- [ ] **Step 13.1: Implement ServiceCard**

`src/components/ui/ServiceCard.astro`:
```astro
---
export interface Props {
  numero: string;
  territorio: string;
  titulo: string;
  resumen: string;
  herramientas?: string[];
}

const { numero, territorio, titulo, resumen, herramientas } = Astro.props;
---

<article class="service-card">
  <div class="service-num">{numero} / {territorio}</div>
  <h4>{titulo}</h4>
  <p>{resumen}</p>
  {herramientas && herramientas.length > 0 && (
    <div class="meta">{herramientas.join(" · ")}</div>
  )}
</article>

<style>
  .service-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 24px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .service-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow);
  }
  .service-num {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 14px;
    color: var(--orange);
    font-weight: 600;
  }
  .service-card h4 {
    font-size: 19px;
    margin: 8px 0 12px;
    color: var(--slate-deep);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .service-card p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--slate);
    margin: 0;
  }
  .meta {
    margin-top: 14px;
    font-size: 11px;
    color: #7A8F9A;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: 600;
  }
</style>
```

- [ ] **Step 13.2: Implement ServicesGrid**

`src/components/sections/ServicesGrid.astro`:
```astro
---
import ServiceCard from "@/components/ui/ServiceCard.astro";
import { getCollection } from "astro:content";
import type { Lang } from "@/lib/i18n";

export interface Props {
  lang: Lang;
  /** If provided, show only these territorios; if absent, show all 4 territory headers */
  variant?: "summary" | "full";
}

const { lang, variant = "summary" } = Astro.props;

const TERRITORIOS = {
  "talent-acquisition":     { es: "Talent acquisition",     en: "Talent acquisition" },
  "employee-experience":    { es: "Experiencia",            en: "Experience" },
  "leadership-performance": { es: "Liderazgo",              en: "Leadership" },
  "culture-change":         { es: "Cultura y cambio",       en: "Culture & change" },
} as const;

const all = await getCollection("servicios", (entry) => entry.data.publicado !== false);
const sorted = all.sort((a, b) => a.data.orden - b.data.orden);

// Group by territorio
const grouped = sorted.reduce<Record<string, typeof sorted>>((acc, s) => {
  acc[s.data.territorio] = acc[s.data.territorio] ?? [];
  acc[s.data.territorio]!.push(s);
  return acc;
}, {});

const territorioOrder: Array<keyof typeof TERRITORIOS> = [
  "talent-acquisition",
  "employee-experience",
  "leadership-performance",
  "culture-change",
];

// Summary mode: show 1 representative card per territorio
const summaryPicks = variant === "summary"
  ? territorioOrder.flatMap((terr) => grouped[terr]?.slice(0, 1) ?? [])
  : [];
---

{variant === "summary" ? (
  <div class="services-grid">
    {summaryPicks.map((s, i) => (
      <ServiceCard
        numero={String(i + 1).padStart(2, "0")}
        territorio={TERRITORIOS[s.data.territorio][lang]}
        titulo={lang === "es" ? s.data.titulo_es : s.data.titulo_en}
        resumen={lang === "es" ? s.data.resumen_es : s.data.resumen_en}
        herramientas={s.data.herramientas}
      />
    ))}
  </div>
) : (
  territorioOrder.map((terr) => (
    <section class="territorio">
      <h3 class="territorio-title">{TERRITORIOS[terr][lang]}</h3>
      <div class="services-grid">
        {grouped[terr]?.map((s, i) => (
          <ServiceCard
            numero={String(i + 1).padStart(2, "0")}
            territorio={TERRITORIOS[terr][lang]}
            titulo={lang === "es" ? s.data.titulo_es : s.data.titulo_en}
            resumen={lang === "es" ? s.data.resumen_es : s.data.resumen_en}
            herramientas={s.data.herramientas}
          />
        ))}
      </div>
    </section>
  ))
)}

<style>
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
  }
  .territorio { margin-bottom: 56px; }
  .territorio-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--slate-deep);
    margin-bottom: 18px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
</style>
```

- [ ] **Step 13.3: Add summary services to home**

In `src/pages/index.astro`, add a section after StatsBand:
```astro
<section style="background: var(--cream); padding: 80px 0;">
  <div class="container">
    <p class="eyebrow">Cómo trabajamos</p>
    <h2 class="h2" style="margin-top: 8px; max-width: 620px;">
      Diagnóstico antes que receta. <em>Y siempre con evidencia.</em>
    </h2>
    <p class="lede" style="margin-top: 14px; margin-bottom: 32px;">
      Cada organización tiene su propia cultura, sus propias fricciones y su propia historia.
      No traemos un paquete prearmado: empezamos por entender qué está pasando, y desde ahí diseñamos.
    </p>
    <ServicesGrid lang={lang} variant="summary" />
  </div>
</section>
```

Add import: `import ServicesGrid from "@/components/sections/ServicesGrid.astro";`

- [ ] **Step 13.4: Verify in browser**

Run `npm run dev`. Verify 4 service cards (one per territory) render below stats band, with hover lift effect, italic numbering, and meta tags.

- [ ] **Step 13.5: Commit**

```bash
git add src/components/ui/ServiceCard.astro src/components/sections/ServicesGrid.astro src/pages/index.astro
git commit -m "feat(services): add ServiceCard and ServicesGrid with summary/full variants"
```

---

### Task 14: FounderCard section

**Files:**
- Create: `src/components/sections/FounderCard.astro`

- [ ] **Step 14.1: Implement FounderCard**

`src/components/sections/FounderCard.astro`:
```astro
---
import Button from "@/components/ui/Button.astro";

export interface Props {
  photoSrc: string;
  photoAlt: string;
  nombre: string;
  rol: string;
  bio: string;
  certificaciones: string[];
  ctaLabel?: string;
  ctaHref?: string;
}

const { photoSrc, photoAlt, nombre, rol, bio, certificaciones, ctaLabel, ctaHref } = Astro.props;
---

<section class="founder">
  <div class="container founder-grid">
    <figure class="founder-photo">
      <img src={photoSrc} alt={photoAlt} loading="lazy" decoding="async" width="500" height="600" />
    </figure>
    <div class="founder-text">
      <p class="eyebrow" style="color: var(--orange-cream);">Sobre el founder</p>
      <h2 class="h2" style="margin-top: 8px;">{nombre}</h2>
      <p class="role">{rol}</p>
      <p class="bio">{bio}</p>
      {certificaciones.length > 0 && (
        <div class="certs">
          <span class="label" style="color: var(--orange-cream); display:block; margin-bottom: 8px;">Certificaciones</span>
          <ul>
            {certificaciones.map((c) => <li>{c}</li>)}
          </ul>
        </div>
      )}
      {ctaLabel && ctaHref && (
        <div style="margin-top: 28px;">
          <Button variant="outline-light" href={ctaHref}>{ctaLabel}</Button>
        </div>
      )}
    </div>
  </div>
</section>

<style>
  .founder { background: var(--ink); color: var(--white); padding: 96px 0; }
  .founder-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 64px; align-items: center; }
  @media (max-width: 900px) { .founder-grid { grid-template-columns: 1fr; gap: 32px; } }
  .founder-photo { border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 4 / 5; background: var(--slate); }
  .founder-photo img { width: 100%; height: 100%; object-fit: cover; }
  .role { font-family: var(--font-serif); font-style: italic; color: var(--orange-cream); margin-top: 6px; }
  .bio { color: rgba(255, 255, 255, 0.82); margin-top: 18px; max-width: 60ch; line-height: 1.7; }
  .certs { margin-top: 24px; }
  .certs ul { display: flex; flex-wrap: wrap; gap: 8px; }
  .certs li {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.85);
  }
</style>
```

- [ ] **Step 14.2: Add to home**

In `src/pages/index.astro`, after the services section:
```astro
<FounderCard
  photoSrc="/dr-gomez.jpg"
  photoAlt="Dr. Alejandro J. Gómez Betancourt"
  nombre="Dr. Alejandro J. Gómez Betancourt"
  rol="PhD · Psicólogo Industrial-Organizacional · Presidente y Senior Consultant"
  bio="Doctor en Psicología por la Universidad Albizu en Puerto Rico, especializado en la aplicación de método científico y principios psicológicos al ámbito laboral. Quince años liderando iniciativas de desarrollo organizacional, programas de liderazgo, gestión del desempeño, seguridad ocupacional, transformación cultural post-fusiones, y diseño organizacional. Veinte años enseñando posgrado en universidades de Puerto Rico."
  certificaciones={["McKinsey Leadership", "Hogan Assessment", "DISC", "Otras herramientas de evaluación de personalidad"]}
  ctaLabel="Conoce más sobre la firma"
  ctaHref="/sobre-nosotros"
/>
```

Add import: `import FounderCard from "@/components/sections/FounderCard.astro";`

- [ ] **Step 14.3: Verify in browser and commit**

Run `npm run dev`, verify founder section renders with dark background, photo on left, bio + certifications on right.

```bash
git add src/components/sections/FounderCard.astro src/pages/index.astro
git commit -m "feat(sections): add FounderCard with bio, role, certifications"
```

---

### Task 15: ArticleCard + ArticleLayout

**Files:**
- Create: `src/components/ui/ArticleCard.astro`, `src/layouts/ArticleLayout.astro`

- [ ] **Step 15.1: Implement ArticleCard**

`src/components/ui/ArticleCard.astro`:
```astro
---
import { t, type Lang } from "@/lib/i18n";

export interface Props {
  href: string;
  titulo: string;
  resumen: string;
  fecha: Date;
  tiempoLectura: number;
  tags?: string[];
  imagenSrc?: string;
  imagenAlt?: string;
  lang: Lang;
}

const { href, titulo, resumen, fecha, tiempoLectura, tags = [], imagenSrc, imagenAlt = "", lang } = Astro.props;
const fechaStr = fecha.toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { year: "numeric", month: "long", day: "numeric" });
const lecturaLabel = tiempoLectura === 1 ? t("tiempoLectura.min", lang) : t("tiempoLectura.mins", lang);
---

<a href={href} class="article-card">
  {imagenSrc && (
    <div class="article-image">
      <img src={imagenSrc} alt={imagenAlt} loading="lazy" decoding="async" width="600" height="400" />
    </div>
  )}
  <div class="article-body">
    {tags.length > 0 && <div class="article-tags">{tags.slice(0, 2).map((tag) => <span>{tag}</span>)}</div>}
    <h3>{titulo}</h3>
    <p>{resumen}</p>
    <div class="article-meta">
      <span>{fechaStr}</span>
      <span class="dot">·</span>
      <span>{tiempoLectura} {lecturaLabel}</span>
    </div>
  </div>
</a>

<style>
  .article-card {
    display: flex;
    flex-direction: column;
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    text-decoration: none;
    color: inherit;
  }
  .article-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
  .article-image { aspect-ratio: 16 / 10; background: var(--orange-cream); }
  .article-image img { width: 100%; height: 100%; object-fit: cover; }
  .article-body { padding: 24px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
  .article-tags { display: flex; gap: 8px; }
  .article-tags span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--orange-cream);
    color: var(--orange);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    font-weight: 600;
  }
  .article-card h3 { font-size: 21px; line-height: 1.25; color: var(--slate-deep); font-weight: 700; letter-spacing: -0.01em; }
  .article-card p { font-size: 14px; color: var(--slate); line-height: 1.6; }
  .article-meta { font-size: 12px; color: var(--slate); display: flex; gap: 8px; margin-top: auto; padding-top: 8px; }
  .dot { opacity: 0.4; }
</style>
```

- [ ] **Step 15.2: Implement ArticleLayout**

`src/layouts/ArticleLayout.astro`:
```astro
---
import BaseLayout from "./BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import { t, type Lang } from "@/lib/i18n";

export interface Props {
  title: string;
  resumen: string;
  fecha: Date;
  autor: string;
  tiempoLectura: number;
  tags: string[];
  imagenSrc?: string;
  imagenAlt?: string;
}

const { title, resumen, fecha, autor, tiempoLectura, tags, imagenSrc, imagenAlt } = Astro.props;
const lang: Lang = "es";
const path = Astro.url.pathname;
const fechaStr = fecha.toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
---

<BaseLayout title={`${title} · La Gran Pregunta`} description={resumen} lang={lang}>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <article class="article-page">
    <div class="container-tight">
      <div class="article-header">
        <a href="/la-gran-pregunta" class="back-link">← La Gran Pregunta</a>
        <div class="tags">{tags.map((tag) => <span>{tag}</span>)}</div>
        <h1 class="h1">{title}</h1>
        <p class="lede">{resumen}</p>
        <div class="meta">
          <span>{t("articulo.por", lang)} {autor}</span>
          <span class="dot">·</span>
          <span>{fechaStr}</span>
          <span class="dot">·</span>
          <span>{tiempoLectura} {t("tiempoLectura.mins", lang)}</span>
        </div>
      </div>

      {imagenSrc && (
        <figure class="article-hero">
          <img src={imagenSrc} alt={imagenAlt ?? ""} loading="eager" />
        </figure>
      )}

      <div class="article-body">
        <slot />
      </div>

      <aside class="article-cta">
        <p>¿Esta pregunta resonó con algo de tu organización?</p>
        <a href="/contacto" class="btn-primary-inline">Cuéntame de tu organización →</a>
      </aside>
    </div>
  </article>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .article-page { padding: 80px 0 96px; background: var(--cream); }
  .back-link { font-size: 13px; color: var(--orange); font-weight: 600; }
  .tags { display: flex; gap: 8px; margin-top: 24px; flex-wrap: wrap; }
  .tags span {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--orange-cream);
    color: var(--orange);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    font-weight: 600;
  }
  .article-page h1 { margin-top: 16px; }
  .article-page .lede { margin-top: 18px; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--slate); margin-top: 18px; }
  .dot { opacity: 0.4; }

  .article-hero { margin: 48px 0; border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 16 / 9; }
  .article-hero img { width: 100%; height: 100%; object-fit: cover; }

  .article-body { font-size: 18px; line-height: 1.75; color: var(--slate-deep); }
  .article-body :global(h2) { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 48px 0 16px; color: var(--slate-deep); }
  .article-body :global(h3) { font-size: 22px; font-weight: 700; margin: 32px 0 12px; color: var(--slate-deep); }
  .article-body :global(p) { margin: 0 0 20px; }
  .article-body :global(em) { font-family: var(--font-serif); font-style: italic; }
  .article-body :global(strong) { color: var(--slate-deep); font-weight: 700; }
  .article-body :global(ul), .article-body :global(ol) { margin: 0 0 20px 1.4em; list-style: disc; }
  .article-body :global(ol) { list-style: decimal; }
  .article-body :global(li) { margin-bottom: 8px; }
  .article-body :global(a) { color: var(--orange); text-decoration: underline; text-underline-offset: 4px; }

  .article-cta {
    margin-top: 64px;
    padding: 28px;
    border-radius: var(--radius-md);
    background: var(--ink);
    color: var(--white);
    text-align: center;
  }
  .article-cta p { font-family: var(--font-serif); font-style: italic; font-size: 19px; margin-bottom: 18px; }
  .btn-primary-inline {
    display: inline-block;
    background: var(--orange);
    color: var(--white);
    padding: 14px 26px;
    border-radius: var(--radius);
    font-weight: 600;
    text-decoration: none;
  }
  .btn-primary-inline:hover { background: #d94f1d; }
</style>
```

- [ ] **Step 15.3: Commit**

```bash
git add src/components/ui/ArticleCard.astro src/layouts/ArticleLayout.astro
git commit -m "feat(articulos): add ArticleCard and ArticleLayout for La Gran Pregunta"
```

---

### Task 16: ContactForm component + endpoint

**Files:**
- Create: `src/components/sections/ContactForm.astro`, `src/pages/api/contacto.ts`, `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`

- [ ] **Step 16.1: Write rate-limit unit tests first**

`src/lib/rate-limit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to 3 requests per minute from the same IP", () => {
    expect(checkRateLimit("1.1.1.1")).toBe(true);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
  });

  it("blocks the 4th request within the same minute", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    expect(checkRateLimit("1.1.1.1")).toBe(false);
  });

  it("tracks IPs independently", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    expect(checkRateLimit("2.2.2.2")).toBe(true);
  });

  it("resets after 60 seconds", () => {
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    checkRateLimit("1.1.1.1");
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("1.1.1.1")).toBe(true);
  });
});
```

Run: `npm test`. Expected: tests fail with "Cannot find module './rate-limit'".

- [ ] **Step 16.2: Implement rate limit**

`src/lib/rate-limit.ts`:
```ts
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

const buckets = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS) {
    buckets.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  buckets.set(ip, timestamps);
  return true;
}

export function resetRateLimit(): void {
  buckets.clear();
}
```

Run: `npm test`. Expected: 4 tests pass.

- [ ] **Step 16.3: Implement API endpoint**

`src/pages/api/contacto.ts`:
```ts
import type { APIRoute } from "astro";
import { z } from "zod";
import { Resend } from "resend";
import { checkRateLimit } from "@/lib/rate-limit";

export const prerender = false;

const ContactSchema = z.object({
  nombre: z.string().min(2).max(80),
  email: z.string().email(),
  organizacion: z.string().min(2).max(120),
  mensaje: z.string().min(20).max(2000),
  _website: z.string().max(0),
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? "unknown";

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limit" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ ok: false, error: "validation", details: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Honeypot triggered → silent success
  if ((parsed.data as { _website?: string })._website) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CONTACT_EMAIL;
  const from = import.meta.env.RESEND_FROM ?? "noreply@innovationaltms.com";

  // If env vars aren't set (preview / local), log and return success to avoid blocking dev
  if (!apiKey || !to) {
    console.info("[contacto] env vars missing, would have sent:", parsed.data);
    return new Response(JSON.stringify({ ok: true, dev: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const resend = new Resend(apiKey);
  const html = `
    <h2>Nuevo mensaje desde innovationaltms.com</h2>
    <p><strong>Nombre:</strong> ${escape(parsed.data.nombre)}</p>
    <p><strong>Email:</strong> ${escape(parsed.data.email)}</p>
    <p><strong>Organización:</strong> ${escape(parsed.data.organizacion)}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${escape(parsed.data.mensaje).replace(/\n/g, "<br>")}</p>
  `;

  try {
    await resend.emails.send({
      from: `Innovational TMS <${from}>`,
      to,
      replyTo: parsed.data.email,
      subject: `Nuevo mensaje de ${parsed.data.nombre} (${parsed.data.organizacion})`,
      html,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[contacto] Resend error:", e);
    return new Response(JSON.stringify({ ok: false, error: "send_failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
```

- [ ] **Step 16.4: Implement ContactForm component**

`src/components/sections/ContactForm.astro`:
```astro
---
import { t, type Lang } from "@/lib/i18n";

export interface Props {
  lang: Lang;
  variant?: "compact" | "full";
}

const { lang, variant = "full" } = Astro.props;
---

<form class={`contact-form contact-form--${variant}`} novalidate>
  <input type="text" name="_website" tabindex="-1" autocomplete="off" aria-hidden="true" class="honeypot" />

  <div class="field">
    <label for="cf-nombre">{t("form.nombre", lang)}</label>
    <input id="cf-nombre" name="nombre" type="text" required minlength="2" maxlength="80" placeholder={t("form.placeholder_nombre", lang)} />
    <span class="error" data-error-for="nombre" role="alert" aria-live="polite"></span>
  </div>

  <div class="field">
    <label for="cf-email">{t("form.email", lang)}</label>
    <input id="cf-email" name="email" type="email" required placeholder={t("form.placeholder_email", lang)} />
    <span class="error" data-error-for="email" role="alert" aria-live="polite"></span>
  </div>

  <div class="field">
    <label for="cf-org">{t("form.organizacion", lang)}</label>
    <input id="cf-org" name="organizacion" type="text" required minlength="2" maxlength="120" placeholder={t("form.placeholder_organizacion", lang)} />
    <span class="error" data-error-for="organizacion" role="alert" aria-live="polite"></span>
  </div>

  <div class="field">
    <label for="cf-msg">{t("form.mensaje", lang)}</label>
    <textarea id="cf-msg" name="mensaje" required minlength="20" maxlength="2000" rows="5" placeholder={t("form.placeholder_mensaje", lang)}></textarea>
    <span class="error" data-error-for="mensaje" role="alert" aria-live="polite"></span>
  </div>

  <button type="submit" class="submit">
    <span class="submit-label">{t("form.enviar", lang)}</span>
    <span class="submit-loading">{t("form.enviando", lang)}</span>
  </button>

  <div class="form-result" role="status" aria-live="polite"></div>
</form>

<script define:vars={{ lang, errMsgs: { reqd: t("form.error_requerido", lang), email: t("form.error_email_invalido", lang), msg: t("form.error_min_mensaje", lang), gracias: t("form.gracias", lang), error: t("form.error", lang), abrir: t("form.error_email_directo", lang) } }}>
  document.querySelectorAll(".contact-form").forEach((form) => {
    const errors = form.querySelectorAll("[data-error-for]");
    const result = form.querySelector(".form-result");
    const submit = form.querySelector(".submit");

    function setError(name, msg) {
      const el = form.querySelector(`[data-error-for="${name}"]`);
      if (el) el.textContent = msg ?? "";
    }

    function clearErrors() { errors.forEach((e) => (e.textContent = "")); if (result) result.innerHTML = ""; }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();

      const data = Object.fromEntries(new FormData(form));
      let ok = true;
      if (!data.nombre || String(data.nombre).length < 2) { setError("nombre", errMsgs.reqd); ok = false; }
      if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email))) { setError("email", errMsgs.email); ok = false; }
      if (!data.organizacion || String(data.organizacion).length < 2) { setError("organizacion", errMsgs.reqd); ok = false; }
      if (!data.mensaje || String(data.mensaje).length < 20) { setError("mensaje", errMsgs.msg); ok = false; }
      if (!ok) return;

      submit.classList.add("is-loading");
      submit.disabled = true;
      try {
        const res = await fetch("/api/contacto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.ok) {
          form.reset();
          if (result) result.innerHTML = `<div class="result-success">${errMsgs.gracias}</div>`;
        } else {
          throw new Error("send_failed");
        }
      } catch (err) {
        const mailto = `mailto:?subject=${encodeURIComponent("Mensaje desde innovationaltms.com")}&body=${encodeURIComponent(`${data.nombre} (${data.organizacion}, ${data.email})\n\n${data.mensaje}`)}`;
        if (result) result.innerHTML = `<div class="result-error">${errMsgs.error} <a href="${mailto}">${errMsgs.abrir}</a></div>`;
      } finally {
        submit.classList.remove("is-loading");
        submit.disabled = false;
      }
    });
  });
</script>

<style>
  .contact-form { display: flex; flex-direction: column; gap: 18px; }
  .honeypot { position: absolute; left: -10000px; opacity: 0; pointer-events: none; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label { font-size: 13px; font-weight: 600; color: var(--slate); letter-spacing: 0.02em; }
  input, textarea {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    font-size: 15px;
    color: var(--slate-deep);
    font-family: inherit;
    transition: border-color 0.15s;
  }
  input:focus, textarea:focus { border-color: var(--orange); outline: none; box-shadow: 0 0 0 3px rgba(239, 90, 33, 0.15); }
  textarea { resize: vertical; min-height: 120px; }
  .error { font-size: 12px; color: var(--error); min-height: 1.2em; }
  .submit {
    background: var(--orange);
    color: var(--white);
    padding: 14px 22px;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 15px;
    align-self: flex-start;
    margin-top: 6px;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    border: 0;
  }
  .submit:hover { background: #d94f1d; transform: translateY(-1px); }
  .submit:disabled { opacity: 0.7; cursor: wait; transform: none; }
  .submit-loading { display: none; }
  .submit.is-loading .submit-label { display: none; }
  .submit.is-loading .submit-loading { display: inline; }

  .form-result { font-size: 14px; }
  .result-success { background: rgba(39, 174, 96, 0.1); color: var(--success); padding: 12px 16px; border-radius: var(--radius); }
  .result-error { background: rgba(192, 57, 43, 0.1); color: var(--error); padding: 12px 16px; border-radius: var(--radius); }
  .result-error a { color: var(--error); font-weight: 600; text-decoration: underline; margin-left: 6px; }
</style>
```

- [ ] **Step 16.5: Run all tests**

```bash
npm test
```

Expected: 12 tests pass (8 i18n + 4 rate limit).

- [ ] **Step 16.6: Commit**

```bash
git add src/components/sections/ContactForm.astro src/pages/api src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat(contacto): add ContactForm with Zod validation, honeypot, rate-limit, Resend"
```

---

### Task 17: CalendlyButton

**Files:**
- Create: `src/components/ui/CalendlyButton.astro`

- [ ] **Step 17.1: Implement CalendlyButton with lazy load**

`src/components/ui/CalendlyButton.astro`:
```astro
---
export interface Props {
  url?: string;
  label: string;
  variant?: "primary" | "outline-light" | "outline-dark";
  inline?: boolean;
}

const calendlyUrl = import.meta.env.PUBLIC_CALENDLY_URL ?? Astro.props.url ?? "https://calendly.com/innovational-tms/30min";
const { label, variant = "primary", inline = false } = Astro.props;
const id = `cal-${Math.random().toString(36).slice(2, 8)}`;
---

{inline ? (
  <div class="calendly-inline" data-url={calendlyUrl} id={id}></div>
) : (
  <button class={`btn btn--${variant} btn--lg`} data-calendly={calendlyUrl} type="button">{label}</button>
)}

<script>
  function loadCalendly(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).Calendly) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://assets.calendly.com/assets/external/widget.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }

  // Lazy-init inline embeds when they enter viewport
  document.querySelectorAll<HTMLElement>(".calendly-inline").forEach((el) => {
    const url = el.dataset.url!;
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        await loadCalendly();
        (window as any).Calendly?.initInlineWidget({ url, parentElement: el });
      }
    }, { rootMargin: "200px" });
    observer.observe(el);
  });

  // Click-to-open popup buttons
  document.querySelectorAll<HTMLElement>("[data-calendly]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await loadCalendly();
      (window as any).Calendly?.initPopupWidget({ url: btn.dataset.calendly });
    });
  });
</script>

<style>
  .calendly-inline { min-height: 700px; width: 100%; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; border-radius: var(--radius); padding: 14px 26px; font-size: 15px; cursor: pointer; transition: transform 0.15s, background 0.15s; }
  .btn--primary { background: var(--orange); color: var(--white); }
  .btn--primary:hover { background: #d94f1d; transform: translateY(-1px); }
  .btn--outline-light { background: transparent; color: var(--white); border: 1.5px solid rgba(255, 255, 255, 0.3); }
  .btn--outline-light:hover { border-color: var(--white); }
  .btn--outline-dark { background: transparent; color: var(--slate-deep); border: 1.5px solid var(--slate); }
  .btn--outline-dark:hover { background: var(--slate-deep); color: var(--white); }
</style>
```

- [ ] **Step 17.2: Commit**

```bash
git add src/components/ui/CalendlyButton.astro
git commit -m "feat(ui): add CalendlyButton with lazy-loaded embed and popup variants"
```

---

## Phase 3 — Page assembly (Spanish)

### Task 18: Home page (Spanish, complete)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 18.1: Build full home composition**

Replace `src/pages/index.astro` with the complete page:

```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import Hero from "@/components/sections/Hero.astro";
import StatsBand from "@/components/sections/StatsBand.astro";
import ServicesGrid from "@/components/sections/ServicesGrid.astro";
import FounderCard from "@/components/sections/FounderCard.astro";
import ArticleCard from "@/components/ui/ArticleCard.astro";
import ContactForm from "@/components/sections/ContactForm.astro";
import CalendlyButton from "@/components/ui/CalendlyButton.astro";
import Button from "@/components/ui/Button.astro";
import { getCollection } from "astro:content";
import { t } from "@/lib/i18n";

const lang = "es";
const path = Astro.url.pathname;

const articulos = (await getCollection("articulos", (e) => e.data.publicado !== false))
  .sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime())
  .slice(0, 3);
---

<BaseLayout
  title="Innovational TMS · Consultoría en Psicología I-O"
  description="La gente buena no renuncia por dinero. Renuncia por decisiones que se tomaron meses antes. Consultoría en psicología industrial-organizacional con quince años de experiencia."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} transparent={true} />

  <Hero
    eyebrow="Consultoría · Psicología Industrial-Organizacional"
    headlineHtml="La gente buena no <em>renuncia por dinero.</em><br>Renuncia por decisiones que se tomaron meses antes."
    lede="Después de quince años acompañando organizaciones, hay algo que se repite: el problema casi nunca es 'falta de talento'. Es que las decisiones sobre la gente se siguen tomando por intuición. Yo ofrezco metodología, evidencia y un par de preguntas incómodas."
    signoff="Dr. Alejandro J. Gómez Betancourt"
    ctaPrimary={{ label: t("cta.cuentame", lang) + " →", href: "/contacto" }}
    ctaSecondary={{ label: t("cta.lee_articulos", lang), href: "/la-gran-pregunta" }}
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    photoLabelName="Dr. Alejandro J. Gómez Betancourt"
    photoLabelRole="PhD · Psicólogo I-O · Presidente y Senior Consultant"
  />

  <StatsBand
    stats={[
      { num: "15", label: t("stats.anos_hr", lang) },
      { num: "20", label: t("stats.anos_posgrado", lang) },
      { num: "4", label: t("stats.certificaciones", lang) },
      { num: "1", label: t("stats.phd", lang) },
    ]}
  />

  <section class="services-summary">
    <div class="container">
      <p class="eyebrow">Cómo trabajamos</p>
      <h2 class="h2">Diagnóstico antes que receta. <em>Y siempre con evidencia.</em></h2>
      <p class="lede" style="margin-top:14px;margin-bottom:32px;">
        Cada organización tiene su propia cultura, sus propias fricciones y su propia historia.
        No traemos un paquete prearmado: empezamos por entender qué está pasando, y desde ahí diseñamos.
      </p>
      <ServicesGrid lang={lang} variant="summary" />
      <div style="margin-top:32px;">
        <Button variant="outline-dark" href="/servicios">Ver los 14 servicios →</Button>
      </div>
    </div>
  </section>

  <FounderCard
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    nombre="Dr. Alejandro J. Gómez Betancourt"
    rol="PhD · Psicólogo Industrial-Organizacional · Presidente y Senior Consultant"
    bio="Doctor en Psicología por la Universidad Albizu en Puerto Rico, especializado en la aplicación de método científico y principios psicológicos al ámbito laboral. Quince años liderando iniciativas de desarrollo organizacional, programas de liderazgo, gestión del desempeño, transformación cultural post-fusiones, y diseño organizacional. Veinte años enseñando posgrado en universidades de Puerto Rico."
    certificaciones={["McKinsey Leadership", "Hogan Assessment", "DISC", "Otras herramientas de evaluación"]}
    ctaLabel="Conoce más sobre la firma"
    ctaHref="/sobre-nosotros"
  />

  <section class="articles-preview">
    <div class="container">
      <p class="eyebrow">La Gran Pregunta</p>
      <h2 class="h2">Una serie de <em>preguntas incómodas</em><br>para líderes que no se conforman.</h2>
      <div class="articles-grid">
        {articulos.map((a) => (
          <ArticleCard
            href={`/la-gran-pregunta/${a.slug}`}
            titulo={a.data.title}
            resumen={a.data.resumen}
            fecha={a.data.fecha}
            tiempoLectura={a.data.tiempoLectura}
            tags={a.data.tags}
            lang={lang}
          />
        ))}
      </div>
      <div style="margin-top:32px;">
        <Button variant="outline-dark" href="/la-gran-pregunta">Ver todos los artículos →</Button>
      </div>
    </div>
  </section>

  <section class="contact-preview">
    <div class="container contact-grid">
      <div>
        <p class="eyebrow" style="color:var(--orange-cream);">Hablemos</p>
        <h2 class="h2" style="color:var(--white);">Cuéntame qué pasa en tu organización.</h2>
        <p class="lede" style="color:rgba(255,255,255,.78);max-width:480px;">
          Si lo que necesitas es una conversación rápida, agenda 30 minutos.
          Si prefieres escribir, llena el formulario.
        </p>
        <div style="margin-top:24px;">
          <CalendlyButton label="Reserva 30 minutos →" variant="outline-light" />
        </div>
      </div>
      <div class="form-wrap">
        <ContactForm lang={lang} variant="compact" />
      </div>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .services-summary { background: var(--cream); padding: 96px 0; }
  .articles-preview { background: var(--cream); padding: 96px 0; border-top: 1px solid var(--border); }
  .articles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 32px; }
  .contact-preview { background: var(--ink); padding: 96px 0; }
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
  @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; gap: 32px; } }
  .form-wrap { background: var(--cream); padding: 32px; border-radius: var(--radius-md); }
</style>
```

- [ ] **Step 18.2: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:4321/`, scroll through entire page. Verify:
- Hero with editorial italics renders dark
- Stats band below
- Services summary with 4 cards + "Ver los 14 servicios" button
- Founder section dark
- Articles preview with first article visible
- Contact preview dark with form on right
- Footer at bottom
- Nav goes from transparent to solid on scroll

- [ ] **Step 18.3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(home): assemble full Spanish home with all sections"
```

---

### Task 19: /servicios page (Spanish)

**Files:**
- Create: `src/pages/servicios.astro`

- [ ] **Step 19.1: Build /servicios**

`src/pages/servicios.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import ServicesGrid from "@/components/sections/ServicesGrid.astro";
import Button from "@/components/ui/Button.astro";

const lang = "es";
const path = Astro.url.pathname;
---

<BaseLayout
  title="Servicios · Innovational TMS"
  description="Catorce servicios agrupados en cuatro territorios: Talent Acquisition, Experiencia del Empleado, Liderazgo, y Cultura & Cambio."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">Servicios</p>
      <h1 class="h1">Catorce servicios.<br><em>Cuatro territorios.</em><br>Una sola filosofía: evidencia.</h1>
      <p class="lede">
        No vendemos paquetes. Cada engagement empieza por entender qué está pasando en tu
        organización y termina con algo medible y específico.
      </p>
    </div>
  </header>

  <main class="services-page">
    <div class="container">
      <ServicesGrid lang={lang} variant="full" />
    </div>
  </main>

  <section class="cta-block">
    <div class="container" style="text-align:center;">
      <h2 class="h2">¿Cuál es el tema en tu organización?</h2>
      <p class="lede" style="margin: 16px auto 28px;">Cuéntame en una frase y respondo en uno o dos días hábiles.</p>
      <Button variant="primary" size="lg" href="/contacto">Cuéntame de tu organización →</Button>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 56px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; }
  .services-page { background: var(--cream); padding: 64px 0 96px; }
  .cta-block { background: var(--cream); padding: 80px 0 120px; border-top: 1px solid var(--border); }
</style>
```

- [ ] **Step 19.2: Verify in browser**

Open `/servicios`, scroll through. Verify all 14 services render grouped by 4 territories.

- [ ] **Step 19.3: Commit**

```bash
git add src/pages/servicios.astro
git commit -m "feat(servicios): add Spanish services page with full grid by territory"
```

---

### Task 20: /sobre-nosotros page (Spanish)

**Files:**
- Create: `src/pages/sobre-nosotros.astro`, `src/components/ui/ValueCard.astro`

- [ ] **Step 20.1: Implement ValueCard**

`src/components/ui/ValueCard.astro`:
```astro
---
export interface Props {
  numero: string;
  nombre: string;
  descripcion: string;
}

const { numero, nombre, descripcion } = Astro.props;
---

<article class="value-card">
  <div class="value-num">{numero}</div>
  <h4>{nombre}</h4>
  <p>{descripcion}</p>
</article>

<style>
  .value-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 28px;
    position: relative;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .value-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
  .value-num {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 22px;
    color: var(--orange);
    font-weight: 600;
  }
  .value-card h4 {
    font-size: 22px;
    margin: 8px 0 12px;
    color: var(--slate-deep);
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .value-card p { color: var(--slate); line-height: 1.65; font-size: 15px; }
</style>
```

- [ ] **Step 20.2: Build /sobre-nosotros**

`src/pages/sobre-nosotros.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import FounderCard from "@/components/sections/FounderCard.astro";
import ValueCard from "@/components/ui/ValueCard.astro";
import Button from "@/components/ui/Button.astro";
import { getCollection } from "astro:content";

const lang = "es";
const path = Astro.url.pathname;

const valores = (await getCollection("valores")).sort((a, b) => a.data.orden - b.data.orden);
---

<BaseLayout
  title="Sobre nosotros · Innovational TMS"
  description="Una firma de consultoría liderada por el Dr. Alejandro J. Gómez Betancourt, PhD en Psicología Industrial-Organizacional."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">Sobre nosotros</p>
      <h1 class="h1">Una firma <em>boutique de psicología I-O</em><br>con base en Puerto Rico.</h1>
      <p class="lede">
        Trabajamos con líderes que entienden que las decisiones sobre las personas son las decisiones más
        estratégicas que toma una organización — y que esas decisiones merecen método, no improvisación.
      </p>
    </div>
  </header>

  <FounderCard
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    nombre="Dr. Alejandro J. Gómez Betancourt"
    rol="PhD · Psicólogo Industrial-Organizacional · Presidente y Senior Consultant"
    bio="Doctor en Psicología por la Universidad Albizu en Puerto Rico, especializado en la aplicación de método científico y principios psicológicos al ámbito laboral. Quince años liderando iniciativas de desarrollo organizacional, programas de liderazgo, gestión del desempeño, seguridad ocupacional, transformación cultural post-fusiones, y diseño organizacional. Veinte años enseñando posgrado en universidades de Puerto Rico, donde también supervisa académicamente disertaciones doctorales. Mantiene certificaciones internacionales en assessments de personalidad y liderazgo."
    certificaciones={["McKinsey Leadership", "Hogan Assessment", "DISC"]}
  />

  <section class="identity">
    <div class="container">
      <div class="identity-grid">
        <div>
          <p class="eyebrow">Identidad</p>
          <h2 class="h2">Empatía, rigor analítico, <em>liderazgo transformacional.</em></h2>
        </div>
        <div>
          <p class="lede">
            Nuestra identidad refleja los principios de la psicología industrial-organizacional —
            pero también algo personal: la convicción de que las personas no son recursos para administrar,
            sino la decisión más estratégica que toma una organización cada día.
          </p>
          <p class="lede" style="margin-top:14px;">
            Combinamos investigación científica de frontera con experiencia práctica para revolucionar las
            prácticas de gestión de talento. Nuestro enfoque es rigurosamente científico, basado en datos,
            y siempre — siempre — basado en evidencia.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="values-section">
    <div class="container">
      <p class="eyebrow">Personalidad</p>
      <h2 class="h2">Cinco palabras<br><em>que describen cómo trabajamos.</em></h2>
      <div class="values-grid">
        {valores.map((v) => (
          <ValueCard
            numero={String(v.data.orden).padStart(2, "0")}
            nombre={v.data.nombre_es}
            descripcion={v.data.descripcion_es}
          />
        ))}
      </div>
    </div>
  </section>

  <section class="cta-block">
    <div class="container" style="text-align:center;">
      <h2 class="h2">¿Conversamos?</h2>
      <p class="lede" style="margin: 16px auto 28px;">Treinta minutos suelen alcanzar para entender si podemos ayudar.</p>
      <Button variant="primary" size="lg" href="/contacto">Reserva 30 minutos →</Button>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 64px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; }
  .identity { background: var(--cream); padding: 96px 0; }
  .identity-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; }
  @media (max-width: 768px) { .identity-grid { grid-template-columns: 1fr; gap: 24px; } }
  .values-section { background: var(--cream); padding: 80px 0; border-top: 1px solid var(--border); }
  .values-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 40px; }
  .cta-block { background: var(--cream); padding: 80px 0 120px; border-top: 1px solid var(--border); }
</style>
```

- [ ] **Step 20.3: Verify and commit**

Open `/sobre-nosotros`, verify FounderCard, identity section, 5 value cards, CTA all render correctly.

```bash
git add src/pages/sobre-nosotros.astro src/components/ui/ValueCard.astro
git commit -m "feat(sobre-nosotros): add Spanish about page with founder, identity, 5 values"
```

---

### Task 21: /la-gran-pregunta index page

**Files:**
- Create: `src/pages/la-gran-pregunta/index.astro`

- [ ] **Step 21.1: Build articles index**

`src/pages/la-gran-pregunta/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import ArticleCard from "@/components/ui/ArticleCard.astro";
import { getCollection } from "astro:content";

const lang = "es";
const path = Astro.url.pathname;

const articulos = (await getCollection("articulos", (e) => e.data.publicado !== false))
  .sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
---

<BaseLayout
  title="La Gran Pregunta · Innovational TMS"
  description="Una serie de preguntas incómodas para líderes que no se conforman. Por el Dr. Alejandro J. Gómez Betancourt."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">La Gran Pregunta</p>
      <h1 class="h1">Una serie de <em>preguntas incómodas</em><br>para líderes que no se conforman.</h1>
      <p class="lede">
        Cada entrega revisa una práctica común de gestión de talento desde la psicología industrial-organizacional —
        y termina con una pregunta para que la lleves a tu próxima reunión.
      </p>
    </div>
  </header>

  <main class="articles-list">
    <div class="container">
      <div class="articles-grid">
        {articulos.map((a) => (
          <ArticleCard
            href={`/la-gran-pregunta/${a.slug}`}
            titulo={a.data.title}
            resumen={a.data.resumen}
            fecha={a.data.fecha}
            tiempoLectura={a.data.tiempoLectura}
            tags={a.data.tags}
            lang={lang}
          />
        ))}
      </div>
    </div>
  </main>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 64px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; }
  .articles-list { background: var(--cream); padding: 64px 0 120px; }
  .articles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
</style>
```

- [ ] **Step 21.2: Verify and commit**

Open `/la-gran-pregunta`, verify the article appears.

```bash
git add src/pages/la-gran-pregunta
git commit -m "feat(articulos): add La Gran Pregunta index listing"
```

---

### Task 22: Article detail page (dynamic route)

**Files:**
- Create: `src/pages/la-gran-pregunta/[slug].astro`

- [ ] **Step 22.1: Build dynamic article page**

`src/pages/la-gran-pregunta/[slug].astro`:
```astro
---
import ArticleLayout from "@/layouts/ArticleLayout.astro";
import { getCollection, type CollectionEntry } from "astro:content";

export async function getStaticPaths() {
  const articulos = await getCollection("articulos", (e) => e.data.publicado !== false);
  return articulos.map((entry) => ({
    params: { slug: entry.slug },
    props: { entry },
  }));
}

interface Props {
  entry: CollectionEntry<"articulos">;
}

const { entry } = Astro.props;
const { Content } = await entry.render();
---

<ArticleLayout
  title={entry.data.title}
  resumen={entry.data.resumen}
  fecha={entry.data.fecha}
  autor={entry.data.autor}
  tiempoLectura={entry.data.tiempoLectura}
  tags={entry.data.tags}
  imagenAlt={entry.data.imagenAlt}
>
  <Content />
</ArticleLayout>
```

- [ ] **Step 22.2: Verify**

Open `http://localhost:4321/la-gran-pregunta/el-primer-ano-tambien-se-disena`. Verify:
- Title, lede, tags, meta render correctly
- Article body has proper typography (h2/h3, italic em, lists)
- Final CTA card renders
- Navigation works back to index

- [ ] **Step 22.3: Commit**

```bash
git add src/pages/la-gran-pregunta
git commit -m "feat(articulos): add dynamic article route with MDX rendering"
```

---

### Task 23: /contacto page

**Files:**
- Create: `src/pages/contacto.astro`

- [ ] **Step 23.1: Build /contacto**

`src/pages/contacto.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import ContactForm from "@/components/sections/ContactForm.astro";
import CalendlyButton from "@/components/ui/CalendlyButton.astro";

const lang = "es";
const path = Astro.url.pathname;
---

<BaseLayout
  title="Contacto · Innovational TMS"
  description="Cuéntame qué pasa en tu organización. O reserva 30 minutos directo en mi calendario."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">Contacto</p>
      <h1 class="h1">¿Cuál es la <em>pregunta</em><br>que te trajo aquí?</h1>
      <p class="lede">
        Si quieres una conversación rápida, agenda 30 minutos directo en mi calendario.
        Si prefieres escribir primero, llena el formulario.
      </p>
    </div>
  </header>

  <section class="contact-page">
    <div class="container contact-grid">
      <div class="form-side">
        <h2 class="h2" style="font-size:24px;">Escríbenos</h2>
        <p class="lede" style="margin-bottom:24px;">
          Mientras más concreto sea tu mensaje, más útil será mi respuesta.
        </p>
        <ContactForm lang={lang} />
      </div>

      <aside class="calendar-side">
        <h2 class="h2" style="font-size:24px;">O agenda 30 minutos</h2>
        <p class="lede" style="margin-bottom:24px;">
          Treinta minutos suelen alcanzar para entender si puedo ayudar.
        </p>
        <CalendlyButton inline={true} label="Reserva 30 minutos" />
      </aside>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 64px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; max-width: 540px; }
  .contact-page { background: var(--cream); padding: 80px 0 120px; }
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; }
  @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; gap: 40px; } }
  .form-side h2, .calendar-side h2 { color: var(--slate-deep); margin-bottom: 8px; }
</style>
```

- [ ] **Step 23.2: Test the form end-to-end**

```bash
npm run dev
```

Open `/contacto`, fill out the form with valid data, submit. Should show "Gracias..." message (in dev mode, env vars are missing so endpoint logs and returns success).

Now test validation: clear the form, click submit. Each field should show "Este campo es requerido."

Test the honeypot: in dev tools, set the hidden `_website` input value to "spam", submit. Should still show success message (silent drop).

- [ ] **Step 23.3: Commit**

```bash
git add src/pages/contacto.astro
git commit -m "feat(contacto): add Spanish contact page with form and Calendly inline"
```

---

### Task 24: 404 page

**Files:**
- Create: `src/pages/404.astro`

- [ ] **Step 24.1: Build 404**

`src/pages/404.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import Button from "@/components/ui/Button.astro";

const lang = "es";
const path = Astro.url.pathname;
---

<BaseLayout title="Página no encontrada · Innovational TMS" description="404" lang={lang}>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <main class="not-found">
    <div class="container">
      <p class="eyebrow">404</p>
      <h1 class="h1">Esta página no <em>existe.</em><br>Pero igual conviene preguntar por qué buscabas otra.</h1>
      <p class="lede" style="margin: 20px auto 32px; max-width: 500px;">
        ¿Buscabas un servicio, un artículo, o quieres conversar?
      </p>
      <div class="cta-row">
        <Button variant="primary" href="/">Volver al inicio</Button>
        <Button variant="outline-dark" href="/contacto">Cuéntame qué buscabas</Button>
      </div>
    </div>
  </main>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .not-found { background: var(--cream); padding: 120px 0; text-align: center; }
  .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
</style>
```

- [ ] **Step 24.2: Verify**

Visit `http://localhost:4321/random-nonsense`. Verify 404 page renders.

- [ ] **Step 24.3: Commit**

```bash
git add src/pages/404.astro
git commit -m "feat(404): add not-found page with home and contact CTAs"
```

---

## Phase 4 — English translations

### Task 25: Hero EN, Home EN

**Files:**
- Create: `src/pages/en/index.astro`, `src/lib/copy-en.ts`

- [ ] **Step 25.1: Build EN home**

`src/pages/en/index.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import Hero from "@/components/sections/Hero.astro";
import StatsBand from "@/components/sections/StatsBand.astro";
import ServicesGrid from "@/components/sections/ServicesGrid.astro";
import FounderCard from "@/components/sections/FounderCard.astro";
import ArticleCard from "@/components/ui/ArticleCard.astro";
import ContactForm from "@/components/sections/ContactForm.astro";
import CalendlyButton from "@/components/ui/CalendlyButton.astro";
import Button from "@/components/ui/Button.astro";
import { getCollection } from "astro:content";
import { t } from "@/lib/i18n";

const lang = "en";
const path = Astro.url.pathname;

const articulos = (await getCollection("articulos", (e) => e.data.publicado !== false))
  .sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime())
  .slice(0, 3);
---

<BaseLayout
  title="Innovational TMS · Industrial-Organizational Psychology Consulting"
  description="Good people don't quit because of money. They quit because of decisions made months earlier. I-O psychology consulting with 15+ years of experience."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} transparent={true} />

  <Hero
    eyebrow="Consulting · Industrial-Organizational Psychology"
    headlineHtml="Good people don't <em>quit because of money.</em><br>They quit because of decisions made months earlier."
    lede="After fifteen years working with organizations, one thing keeps showing up: the problem is rarely 'lack of talent'. It's that decisions about people are still being made on intuition. What I offer is methodology, evidence, and a couple of uncomfortable questions."
    signoff="Dr. Alejandro J. Gómez Betancourt"
    ctaPrimary={{ label: t("cta.cuentame", lang) + " →", href: "/en/contact" }}
    ctaSecondary={{ label: t("cta.lee_articulos", lang), href: "/la-gran-pregunta" }}
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    photoLabelName="Dr. Alejandro J. Gómez Betancourt"
    photoLabelRole="PhD · I-O Psychologist · President & Senior Consultant"
  />

  <StatsBand
    stats={[
      { num: "15", label: t("stats.anos_hr", lang) },
      { num: "20", label: t("stats.anos_posgrado", lang) },
      { num: "4", label: t("stats.certificaciones", lang) },
      { num: "1", label: t("stats.phd", lang) },
    ]}
  />

  <section class="services-summary">
    <div class="container">
      <p class="eyebrow">How we work</p>
      <h2 class="h2">Diagnosis before prescription. <em>Always with evidence.</em></h2>
      <p class="lede" style="margin-top:14px;margin-bottom:32px;">
        Every organization has its own culture, its own friction, and its own history.
        We don't bring a pre-packaged solution: we start by understanding what's happening, then we design.
      </p>
      <ServicesGrid lang={lang} variant="summary" />
      <div style="margin-top:32px;">
        <Button variant="outline-dark" href="/en/services">See all 14 services →</Button>
      </div>
    </div>
  </section>

  <FounderCard
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    nombre="Dr. Alejandro J. Gómez Betancourt"
    rol="PhD · Industrial-Organizational Psychologist · President & Senior Consultant"
    bio="Doctorate in Psychology from Albizu University in Puerto Rico, specialized in applying scientific method and psychological principles to the workplace. Fifteen years leading initiatives in organizational development, leadership programs, performance management, post-merger cultural transformation, and organizational design. Twenty years teaching at the graduate level at universities in Puerto Rico."
    certificaciones={["McKinsey Leadership", "Hogan Assessment", "DISC", "Other personality assessment tools"]}
    ctaLabel="Learn more about the firm"
    ctaHref="/en/about"
  />

  <section class="articles-preview">
    <div class="container">
      <p class="eyebrow">The Big Question</p>
      <h2 class="h2">A series of <em>uncomfortable questions</em><br>for leaders who don't settle. <span style="font-family:var(--font-serif);font-style:italic;font-weight:400;font-size:.6em;color:var(--slate);">(Articles in Spanish)</span></h2>
      <div class="articles-grid">
        {articulos.map((a) => (
          <ArticleCard
            href={`/la-gran-pregunta/${a.slug}`}
            titulo={a.data.title}
            resumen={a.data.resumen}
            fecha={a.data.fecha}
            tiempoLectura={a.data.tiempoLectura}
            tags={a.data.tags}
            lang={lang}
          />
        ))}
      </div>
    </div>
  </section>

  <section class="contact-preview">
    <div class="container contact-grid">
      <div>
        <p class="eyebrow" style="color:var(--orange-cream);">Let's talk</p>
        <h2 class="h2" style="color:var(--white);">Tell me what's happening in your organization.</h2>
        <p class="lede" style="color:rgba(255,255,255,.78);max-width:480px;">
          If you want a quick conversation, book 30 minutes.
          If you'd rather write, fill out the form.
        </p>
        <div style="margin-top:24px;">
          <CalendlyButton label="Book 30 minutes →" variant="outline-light" />
        </div>
      </div>
      <div class="form-wrap">
        <ContactForm lang={lang} variant="compact" />
      </div>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .services-summary { background: var(--cream); padding: 96px 0; }
  .articles-preview { background: var(--cream); padding: 96px 0; border-top: 1px solid var(--border); }
  .articles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 32px; }
  .contact-preview { background: var(--ink); padding: 96px 0; }
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
  @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; gap: 32px; } }
  .form-wrap { background: var(--cream); padding: 32px; border-radius: var(--radius-md); }
</style>
```

- [ ] **Step 25.2: Verify and commit**

Open `/en/`. Verify English version renders correctly with same layout but English copy.

```bash
git add src/pages/en/index.astro
git commit -m "feat(en): add English home page"
```

---

### Task 26: EN /services, /about, /contact

**Files:**
- Create: `src/pages/en/services.astro`, `src/pages/en/about.astro`, `src/pages/en/contact.astro`

- [ ] **Step 26.1: Build /en/services**

`src/pages/en/services.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import ServicesGrid from "@/components/sections/ServicesGrid.astro";
import Button from "@/components/ui/Button.astro";

const lang = "en";
const path = Astro.url.pathname;
---

<BaseLayout
  title="Services · Innovational TMS"
  description="Fourteen services across four territories: Talent Acquisition, Employee Experience, Leadership, and Culture & Change."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">Services</p>
      <h1 class="h1">Fourteen services.<br><em>Four territories.</em><br>One philosophy: evidence.</h1>
      <p class="lede">
        We don't sell packages. Every engagement starts by understanding what's happening in your
        organization and ends with something measurable and specific.
      </p>
    </div>
  </header>

  <main class="services-page">
    <div class="container">
      <ServicesGrid lang={lang} variant="full" />
    </div>
  </main>

  <section class="cta-block">
    <div class="container" style="text-align:center;">
      <h2 class="h2">What's the topic in your organization?</h2>
      <p class="lede" style="margin: 16px auto 28px;">Tell me in one sentence and I'll reply within one or two business days.</p>
      <Button variant="primary" size="lg" href="/en/contact">Tell me about your organization →</Button>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 56px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; }
  .services-page { background: var(--cream); padding: 64px 0 96px; }
  .cta-block { background: var(--cream); padding: 80px 0 120px; border-top: 1px solid var(--border); }
</style>
```

- [ ] **Step 26.2: Build /en/about**

`src/pages/en/about.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import FounderCard from "@/components/sections/FounderCard.astro";
import ValueCard from "@/components/ui/ValueCard.astro";
import Button from "@/components/ui/Button.astro";
import { getCollection } from "astro:content";

const lang = "en";
const path = Astro.url.pathname;

const valores = (await getCollection("valores")).sort((a, b) => a.data.orden - b.data.orden);
---

<BaseLayout
  title="About · Innovational TMS"
  description="A boutique consulting firm led by Dr. Alejandro J. Gómez Betancourt, PhD in Industrial-Organizational Psychology."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">About</p>
      <h1 class="h1">A <em>boutique I-O psychology firm</em><br>based in Puerto Rico.</h1>
      <p class="lede">
        We work with leaders who understand that decisions about people are the most strategic
        decisions an organization makes — and those decisions deserve method, not improvisation.
      </p>
    </div>
  </header>

  <FounderCard
    photoSrc="/dr-gomez.jpg"
    photoAlt="Dr. Alejandro J. Gómez Betancourt"
    nombre="Dr. Alejandro J. Gómez Betancourt"
    rol="PhD · Industrial-Organizational Psychologist · President & Senior Consultant"
    bio="Doctorate in Psychology from Albizu University in Puerto Rico, specialized in applying scientific method and psychological principles to the workplace. Fifteen years leading initiatives in organizational development, leadership programs, performance management, occupational safety, post-merger cultural transformation, and organizational design. Twenty years teaching at the graduate level at universities in Puerto Rico, where he also serves as academic supervisor and dissertation director. Holds international certifications in personality and leadership assessments."
    certificaciones={["McKinsey Leadership", "Hogan Assessment", "DISC"]}
  />

  <section class="identity">
    <div class="container">
      <div class="identity-grid">
        <div>
          <p class="eyebrow">Identity</p>
          <h2 class="h2">Empathy, analytical rigor, <em>transformational leadership.</em></h2>
        </div>
        <div>
          <p class="lede">
            Our identity reflects the principles of industrial-organizational psychology —
            but also something personal: the conviction that people aren't resources to manage,
            they are the most strategic decision an organization makes every day.
          </p>
          <p class="lede" style="margin-top:14px;">
            We combine cutting-edge scientific research with practical expertise to revolutionize talent
            management practices. Our approach is rigorously scientific, data-driven, and always —
            always — evidence-based.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="values-section">
    <div class="container">
      <p class="eyebrow">Personality</p>
      <h2 class="h2">Five words<br><em>that describe how we work.</em></h2>
      <div class="values-grid">
        {valores.map((v) => (
          <ValueCard
            numero={String(v.data.orden).padStart(2, "0")}
            nombre={v.data.nombre_en}
            descripcion={v.data.descripcion_en}
          />
        ))}
      </div>
    </div>
  </section>

  <section class="cta-block">
    <div class="container" style="text-align:center;">
      <h2 class="h2">Shall we talk?</h2>
      <p class="lede" style="margin: 16px auto 28px;">Thirty minutes is usually enough to know if I can help.</p>
      <Button variant="primary" size="lg" href="/en/contact">Book 30 minutes →</Button>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 64px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; }
  .identity { background: var(--cream); padding: 96px 0; }
  .identity-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; }
  @media (max-width: 768px) { .identity-grid { grid-template-columns: 1fr; gap: 24px; } }
  .values-section { background: var(--cream); padding: 80px 0; border-top: 1px solid var(--border); }
  .values-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 40px; }
  .cta-block { background: var(--cream); padding: 80px 0 120px; border-top: 1px solid var(--border); }
</style>
```

- [ ] **Step 26.3: Build /en/contact**

`src/pages/en/contact.astro`:
```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import Nav from "@/components/layout/Nav.astro";
import Footer from "@/components/layout/Footer.astro";
import ContactForm from "@/components/sections/ContactForm.astro";
import CalendlyButton from "@/components/ui/CalendlyButton.astro";

const lang = "en";
const path = Astro.url.pathname;
---

<BaseLayout
  title="Contact · Innovational TMS"
  description="Tell me what's happening in your organization. Or book 30 minutes directly on my calendar."
  lang={lang}
>
  <Nav slot="nav" lang={lang} currentPath={path} />

  <header class="page-header">
    <div class="container">
      <p class="eyebrow">Contact</p>
      <h1 class="h1">What's the <em>question</em><br>that brought you here?</h1>
      <p class="lede">
        If you want a quick conversation, book 30 minutes directly on my calendar.
        If you'd rather write first, fill out the form.
      </p>
    </div>
  </header>

  <section class="contact-page">
    <div class="container contact-grid">
      <div class="form-side">
        <h2 class="h2" style="font-size:24px;">Write to us</h2>
        <p class="lede" style="margin-bottom:24px;">The more specific your message, the more useful my reply.</p>
        <ContactForm lang={lang} />
      </div>

      <aside class="calendar-side">
        <h2 class="h2" style="font-size:24px;">Or book 30 minutes</h2>
        <p class="lede" style="margin-bottom:24px;">Thirty minutes is usually enough to know if I can help.</p>
        <CalendlyButton inline={true} label="Book 30 minutes" />
      </aside>
    </div>
  </section>

  <Footer slot="footer" lang={lang} currentPath={path} />
</BaseLayout>

<style>
  .page-header { background: var(--ink); color: var(--white); padding: 96px 0 64px; }
  .page-header .lede { color: rgba(255,255,255,.78); margin-top: 20px; max-width: 540px; }
  .contact-page { background: var(--cream); padding: 80px 0 120px; }
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; }
  @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; gap: 40px; } }
  .form-side h2, .calendar-side h2 { color: var(--slate-deep); margin-bottom: 8px; }
</style>
```

- [ ] **Step 26.4: Verify and commit**

Open all three EN pages, click around, verify lang toggle works between ES/EN versions of equivalent pages.

```bash
git add src/pages/en
git commit -m "feat(en): add English /services, /about, /contact pages"
```

---

## Phase 5 — SEO, OG images, structured data, sitemap, polish

### Task 27: Structured data (JSON-LD)

**Files:**
- Create: `src/components/seo/JsonLd.astro`
- Modify: `src/layouts/BaseLayout.astro`, `src/layouts/ArticleLayout.astro`

- [ ] **Step 27.1: Implement JsonLd component**

`src/components/seo/JsonLd.astro`:
```astro
---
export interface Props {
  data: object;
}
const { data } = Astro.props;
---
<script type="application/ld+json" is:inline set:html={JSON.stringify(data)} />
```

- [ ] **Step 27.2: Add Organization + Person to BaseLayout**

In `src/layouts/BaseLayout.astro`, before `</head>`, add:

```astro
import JsonLd from "@/components/seo/JsonLd.astro";

// ... in component body:
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Innovational TMS",
  description: "Industrial-Organizational Psychology consulting firm.",
  url: Astro.site?.toString(),
  founder: {
    "@type": "Person",
    name: "Dr. Alejandro J. Gómez Betancourt",
    jobTitle: "President & Senior Consultant",
    alumniOf: { "@type": "EducationalOrganization", name: "Albizu University, Puerto Rico" },
  },
  address: { "@type": "PostalAddress", addressCountry: "PR" },
};
```

Add `<JsonLd data={orgSchema} />` inside `<slot name="head" />` block.

- [ ] **Step 27.3: Add Article schema to ArticleLayout**

In `src/layouts/ArticleLayout.astro`, add:
```ts
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description: resumen,
  datePublished: fecha.toISOString(),
  author: {
    "@type": "Person",
    name: autor,
  },
  publisher: {
    "@type": "Organization",
    name: "Innovational TMS",
  },
};
```

Place `<JsonLd data={articleSchema} slot="head" />` inside `<BaseLayout>`.

- [ ] **Step 27.4: Verify and commit**

```bash
npm run build
```

Inspect built HTML in `dist/` for JSON-LD `<script>` tags.

```bash
git add src/components/seo src/layouts
git commit -m "feat(seo): add JSON-LD Organization, Person, Article structured data"
```

---

### Task 28: OG images

**Files:**
- Create: `public/og/default.jpg`, `public/og/articulo-el-primer-ano.jpg`

- [ ] **Step 28.1: Generate default OG image**

Use the canvas-design skill to produce a 1200x630 OG image:
- Background: `#0E1A20` (`--ink`)
- Logo lockup top-left
- Center: tagline "Diseñamos cómo trabaja la gente."
- Subtitle: "innovational TMS · Talent Management Solutions"
- Decorative orange glow bottom-right

Save as `public/og/default.jpg` (JPG for smaller file, optimized to <100KB).

Procedure:
1. Open the canvas-design skill.
2. Specify a 1200×630 deck with the constraints above.
3. Export as PNG, then convert to JPG with `sharp` or any image tool.

- [ ] **Step 28.2: Generate article OG image**

Same template, but with the article title overlaid in 56px Inter Bold.

Save as `public/og/articulo-el-primer-ano.jpg`.

- [ ] **Step 28.3: Reference in article frontmatter**

Update `src/content/articulos/el-primer-ano-tambien-se-disena.mdx` to add `imagen: ../../../public/og/articulo-el-primer-ano.jpg` in frontmatter (Astro Image will optimize). Adjust schema if needed to support optional cover image.

- [ ] **Step 28.4: Commit**

```bash
git add public/og src/content/articulos
git commit -m "feat(seo): add default and per-article OG images for social sharing"
```

---

### Task 29: Favicon and logo public assets

**Files:**
- Create: `public/favicon.svg`, `public/logo.png`, `public/dr-gomez.jpg`

- [ ] **Step 29.1: Create favicon**

The "o-target" of the Innovational logo (orange ring with crosshair) is the perfect favicon. Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="20" fill="#EF5A21" />
  <circle cx="24" cy="24" r="10" fill="none" stroke="#FAFAF7" stroke-width="3" />
  <line x1="24" y1="4" x2="24" y2="44" stroke="#FAFAF7" stroke-width="2" />
  <line x1="4" y1="24" x2="44" y2="24" stroke="#FAFAF7" stroke-width="2" />
</svg>
```

- [ ] **Step 29.2: Place logo from PDF**

```bash
cp brand-assets/logo-from-pdf.png public/logo.png
```

(Placeholder until cliente provides SVG.)

- [ ] **Step 29.3: Verify favicon loads**

Run `npm run dev`, check tab icon shows orange circle crosshair.

- [ ] **Step 29.4: Commit**

```bash
git add public/favicon.svg public/logo.png public/dr-gomez.jpg
git commit -m "feat(assets): add favicon SVG, logo placeholder, founder photo placeholder"
```

---

### Task 30: Robots.txt and sitemap polish

**Files:**
- Create: `public/robots.txt`
- Modify: `astro.config.mjs` (sitemap config)

- [ ] **Step 30.1: Create robots.txt**

`public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://innovationaltms.com/sitemap-index.xml
```

- [ ] **Step 30.2: Configure sitemap with i18n**

Update `astro.config.mjs` integrations:
```js
import sitemap from "@astrojs/sitemap";

// ...
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
```

- [ ] **Step 30.3: Verify build produces sitemap**

```bash
npm run build
ls dist/
```

Expected: `dist/sitemap-index.xml`, `dist/sitemap-0.xml` exist.

- [ ] **Step 30.4: Commit**

```bash
git add public/robots.txt astro.config.mjs
git commit -m "feat(seo): add robots.txt and configure i18n sitemap"
```

---

## Phase 6 — CI, deploy, docs

### Task 31: GitHub Actions for CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 31.1: Create CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
```

- [ ] **Step 31.2: Commit**

```bash
git add .github/workflows
git commit -m "ci: add type-check, tests, build workflow"
```

---

### Task 32: Lighthouse CI workflow

**Files:**
- Create: `.github/workflows/lighthouse.yml`, `lighthouserc.json`

- [ ] **Step 32.1: Create Lighthouse config**

`lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "url": [
        "http://localhost/",
        "http://localhost/servicios",
        "http://localhost/sobre-nosotros",
        "http://localhost/contacto",
        "http://localhost/la-gran-pregunta",
        "http://localhost/la-gran-pregunta/el-primer-ano-tambien-se-disena"
      ]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

- [ ] **Step 32.2: Create workflow**

`.github/workflows/lighthouse.yml`:
```yaml
name: Lighthouse

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx -p @lhci/cli@0.13 lhci autorun --config=./lighthouserc.json
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

- [ ] **Step 32.3: Commit**

```bash
git add lighthouserc.json .github/workflows/lighthouse.yml
git commit -m "ci: add Lighthouse CI to enforce perf >=90 and a11y >=95"
```

---

### Task 33: Pa11y CI workflow

**Files:**
- Create: `.github/workflows/pa11y.yml`, `.pa11yci.json`

- [ ] **Step 33.1: Pa11y config**

`.pa11yci.json`:
```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 30000,
    "wait": 500
  },
  "urls": [
    "http://localhost:4321/",
    "http://localhost:4321/servicios",
    "http://localhost:4321/sobre-nosotros",
    "http://localhost:4321/contacto",
    "http://localhost:4321/la-gran-pregunta",
    "http://localhost:4321/la-gran-pregunta/el-primer-ano-tambien-se-disena"
  ]
}
```

- [ ] **Step 33.2: Workflow**

`.github/workflows/pa11y.yml`:
```yaml
name: Pa11y

on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx -p http-server@14 http-server dist -p 4321 &
      - run: sleep 4
      - run: npx pa11y-ci --config .pa11yci.json
```

- [ ] **Step 33.3: Commit**

```bash
git add .pa11yci.json .github/workflows/pa11y.yml
git commit -m "ci: add Pa11y CI for WCAG 2 AA compliance"
```

---

### Task 34: Vercel config and env example

**Files:**
- Create: `vercel.json`, `.env.example`

- [ ] **Step 34.1: Vercel config**

`vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "trailingSlash": false,
  "redirects": [
    { "source": "/blog", "destination": "/la-gran-pregunta", "permanent": true },
    { "source": "/articles", "destination": "/la-gran-pregunta", "permanent": true }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ]
}
```

- [ ] **Step 34.2: Env example**

`.env.example`:
```bash
# Resend — email transactional API
# Get key at https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx

# Where contact form messages get delivered
CONTACT_EMAIL=hola@innovationaltms.com

# From-address for outgoing email (must verify domain at Resend first)
RESEND_FROM=noreply@innovationaltms.com

# Calendly URL exposed to client (PUBLIC_ prefix is required by Astro)
PUBLIC_CALENDLY_URL=https://calendly.com/innovational-tms/30min
```

- [ ] **Step 34.3: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore(deploy): add Vercel config and env example"
```

---

### Task 35: README and handoff docs

**Files:**
- Create: `README.md`

- [ ] **Step 35.1: Write README**

`README.md`:
```markdown
# Website IS — Innovational TMS

Marketing website for Innovational Talent Management Solutions, a consulting firm in Industrial-Organizational Psychology led by Dr. Alejandro J. Gómez Betancourt.

## Stack

- **Astro 5** with TypeScript (strict)
- **MDX** for articles and services content
- **Vercel** hosting
- **Resend** for transactional email
- **Calendly** for booking
- Bilingual (ES/EN) with native Astro i18n

## Local development

```bash
npm install
cp .env.example .env.local   # fill values
npm run dev                  # http://localhost:4321
```

## Project structure

```
src/
├── content/
│   ├── articulos/           # MDX — La Gran Pregunta articles
│   ├── servicios/           # 14 services
│   ├── valores/             # 5 values
│   └── i18n/                # ES/EN UI dictionaries
├── components/
│   ├── layout/              # Nav, Footer, LangToggle
│   ├── sections/            # Hero, Stats, Services, Founder, Contact
│   └── ui/                  # Button, ServiceCard, ArticleCard, ValueCard
├── layouts/                 # BaseLayout, ArticleLayout
├── lib/                     # i18n, rate-limit
├── pages/
│   ├── index.astro          # ES home
│   ├── servicios.astro
│   ├── sobre-nosotros.astro
│   ├── contacto.astro
│   ├── 404.astro
│   ├── la-gran-pregunta/    # ES-only article hub
│   ├── en/                  # English mirror pages
│   └── api/contacto.ts      # form endpoint
└── styles/                  # global tokens, reset, typography
```

## Adding a new article

1. Create `src/content/articulos/<slug>.mdx`:

```yaml
---
title: "Article title"
fecha: 2026-MM-DD
resumen: "80-400 chars summary."
imagenAlt: "Alt text"
tiempoLectura: 6
tags: ["tag1", "tag2"]
publicado: true
---

Article body in markdown / MDX.
```

2. Commit and push to `main` — Vercel auto-deploys.

## Adding a service

Create `src/content/servicios/<slug>.mdx` with frontmatter (see existing files for shape). It will appear automatically in `/servicios` and home summary if it's the first service in its `territorio`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Vercel + local | Sending contact form emails |
| `CONTACT_EMAIL` | Vercel + local | Destination inbox |
| `RESEND_FROM` | Vercel + local | From-address (domain must be verified at Resend) |
| `PUBLIC_CALENDLY_URL` | Vercel + local | Calendly URL (note `PUBLIC_` prefix exposes to client) |

Without `RESEND_API_KEY` or `CONTACT_EMAIL`, the contact form logs to console and returns success — useful for local dev.

## Tests

- `npm run check` — TypeScript + Astro content schema validation
- `npm test` — Vitest unit tests (i18n helper, rate-limit)
- `npm run build` — Production build sanity check

CI also runs Lighthouse and Pa11y on every PR (see `.github/workflows/`).

## Deploy

Push to `main` triggers Vercel deploy. Preview deploys are automatic for PRs. Required env vars must be set in Vercel project settings before first prod deploy.

## Brand assets

`brand-assets/` contains placeholder PNGs extracted from the corporate sheet. Replace with HD versions:
- `logo-from-pdf.png` → `public/logo.svg` (preferred SVG)
- `dr-gomez-from-pdf.png` → `public/dr-gomez.jpg` (HD professional photo)

## Spec and plan

- Design: `docs/superpowers/specs/2026-05-02-website-innovational-tms-design.md`
- Plan: `docs/superpowers/plans/2026-05-02-website-innovational-tms-implementation.md`
```

- [ ] **Step 35.2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, content workflow, and deploy guide"
```

---

### Task 36: Final verification and production checklist

**Files:**
- (Verification only)

- [ ] **Step 36.1: Run full check**

```bash
npm run check
npm test
npm run build
```

Expected: all green.

- [ ] **Step 36.2: Manual page audit**

Open `npm run preview` (`http://localhost:4321/`) and click through every page in both languages:

- `/` — Spanish home
- `/servicios`
- `/sobre-nosotros`
- `/contacto` — fill form, submit (should succeed in dev mode)
- `/la-gran-pregunta`
- `/la-gran-pregunta/el-primer-ano-tambien-se-disena`
- `/404` (visit `/random-junk`)
- `/en/` — English home
- `/en/services`
- `/en/about`
- `/en/contact`

For each: verify nav, footer, lang toggle round-trip works, no broken images.

- [ ] **Step 36.3: Pre-deploy checklist**

Open `dist/` after build and check:
- [ ] `dist/sitemap-index.xml` exists
- [ ] `dist/robots.txt` exists
- [ ] `dist/og/default.jpg` exists
- [ ] `dist/favicon.svg` exists
- [ ] No `TBD` strings in copy (run `grep -ri "TBD" dist/ || true` — only env example should match if it stays in dist)

- [ ] **Step 36.4: Commit final state**

```bash
git status
# (should be clean)
git log --oneline | head -25
```

The repo is ready for Vercel deploy. The deploy itself is a one-time manual action by the project owner: connect the GitHub repo to Vercel, paste env vars, hit deploy.

---

## Self-Review (writing-plans)

After writing, review against spec:

**Spec coverage:**
- §1 Purpose / scope → covered by overall plan structure
- §2 Stack → Task 1 (scaffold)
- §3 Sitemap → Tasks 18-26 (all pages)
- §4 Visual system → Task 2 (tokens), tasks 8-17 (components apply tokens)
- §5 Components catalog → Tasks 8-17 cover all 16 components
- §6 i18n → Task 4 (helper, dicts), Tasks 25-26 (EN pages)
- §7 Form → Task 16
- §8 SEO/perf/a11y → Tasks 27, 30, 32, 33
- §9 Assets → Tasks 11, 28, 29
- §10 Testing → Tasks 31, 32, 33, 36
- §11 Skills to use → flagged in tasks 11 (frontend-design implicit), 28 (canvas-design)
- §12 Risks → mitigated in code (env-var fallbacks in task 16, lazy Calendly in task 17, graceful 404 in task 24)
- §13 Initial content → Tasks 6, 7, 11 (hero text), 18 (home assembly)

All sections of the spec map to at least one task.

**Placeholder scan:** Searched the plan — no "TBD", "implement later", "fill in details", or "similar to Task N" instructions. The TBDs that exist (CONTACT_EMAIL, PUBLIC_CALENDLY_URL, domain) are explicit env vars resolved at deploy, not in code.

**Type consistency:** `Lang` type is `"es" | "en"` everywhere. `t(key, lang)` signature consistent. Component prop interfaces (`Props`) consistent in naming. Content collection schemas match what page files read (`titulo_es`, `titulo_en`, `territorio`, `orden`, etc.).

Plan is internally consistent and complete.
