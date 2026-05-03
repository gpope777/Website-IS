# Website IS — Innovational TMS

Marketing website for Innovational Talent Management Solutions, a consulting firm in Industrial-Organizational Psychology led by Dr. Alejandro J. Gómez Betancourt.

## Stack

- **Astro 6** with TypeScript (strict)
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
├── content.config.ts        # Astro 6 collection schemas
├── components/
│   ├── layout/              # Nav, Footer, LangToggle
│   ├── sections/            # Hero, Stats, Services, Founder, Contact
│   ├── seo/                 # JsonLd
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
│   └── api/contacto.ts      # form endpoint (SSR)
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

## Architecture decisions worth knowing

- **Astro 6** — uses the new content layer (`src/content.config.ts` with `glob()` loader, `entry.id` for slugs)
- **Output mode** — `output: "server"` with `export const prerender = true` on every static page; only `/api/contacto` is SSR
- **i18n** — routes `/` for Spanish, `/en/...` for English. Article series at `/la-gran-pregunta` is Spanish-only.
- **Form** — Resend with honeypot + IP rate-limit (3/min, in-memory). Falls back to mailto on error.
- **Calendly** — lazy-loaded JS; embed only initializes when in viewport (inline) or on click (button).
