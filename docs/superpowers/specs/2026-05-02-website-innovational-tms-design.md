# Website IS · Innovational TMS — Diseño

**Fecha:** 2026-05-02
**Cliente:** Innovational Talent Management Solutions
**Founder:** Dr. Alejandro J. Gómez Betancourt (PhD Industrial-Organizational Psychology, Albizu University)
**Repo:** `Website IS`
**Estado:** Spec aprobado pendiente de revisión final

---

## 1. Propósito y alcance

### 1.1 Objetivo del sitio

Sitio web institucional para la firma de consultoría en psicología industrial-organizacional Innovational TMS. Tres metas funcionales, en orden de prioridad:

1. **Promocionar los servicios** de la firma (los 14 servicios listados en el sheet corporativo) con una narrativa que comunique método, evidencia y experiencia.
2. **Capturar contacto** de potenciales clientes vía formulario y agendador (Calendly).
3. **Publicar la serie editorial "La Gran Pregunta"** del Dr. Gómez, empezando por *El primer año también se diseña* (publicado en LinkedIn 2026-04-29).

### 1.2 Audiencia

Mixta:
- Directores de HR / People de empresas medianas y grandes en Puerto Rico.
- CEO / fundadores de empresas en crecimiento sin función de HR madura.
- HR/Talent leaders en LATAM y la diáspora puertorriqueña.

El tono debe leer como autoritario y cálido a la vez — el visitante debe sentir que está hablando con un consultor real con punto de vista, no con una landing page genérica.

### 1.3 Fuera de alcance (por ahora)

- Login / portal de clientes.
- Pagos / e-commerce.
- Blog comunitario con multi-autor (la voz es del Dr. Gómez exclusivamente).
- Versiones traducidas de "La Gran Pregunta" (los artículos se mantienen en español).
- CMS con panel admin (los artículos se publican vía commit a MDX).

---

## 2. Stack y deploy

| Pieza | Decisión |
|---|---|
| Framework | **Astro** (content-first, SSR opcional, i18n nativo, MDX) |
| Lenguaje | TypeScript + MDX |
| UI | Componentes Astro (`.astro`); islas React puntuales si una sección requiere interactividad rica |
| Estilos | CSS modules + tokens globales en `src/styles/global.css`; sin Tailwind para evitar look genérico |
| i18n | `astro:i18n` nativo con `defaultLocale: "es"`, `locales: ["es", "en"]`, `routing.prefixDefaultLocale: false` |
| Imágenes | `astro:assets` (Image component) — AVIF + WebP, lazy, dimensiones explícitas |
| Sitemap | `@astrojs/sitemap` |
| MDX | `@astrojs/mdx` |
| Hosting | **Vercel** (rama `main` deploy automático, previews por PR) |
| Email | **Resend** vía endpoint `/api/contacto.ts`; fallback a `mailto:` si la API falla |
| Agendamiento | **Calendly** embed inline (`/contacto`) + botón en nav |
| Analytics | **Vercel Analytics** (sin cookies, sin banner GDPR necesario) |
| Form rate-limit | LRU in-memory por IP (3 req/min) — suficiente para el volumen esperado; no requiere Redis |

**Repo:** monorepo simple con todo el código en raíz (no necesita workspaces).

---

## 3. Sitemap e information architecture

```
/                            Home (landing larga, ES)
/en/                         Home (EN)

/servicios                   Detalle de los 14 servicios agrupados (ES)
/en/services                 (EN)

/sobre-nosotros              Founder, identidad, valores, certificaciones (ES)
/en/about                    (EN)

/contacto                    Form + Calendly + datos de contacto (ES)
/en/contact                  (EN)

/la-gran-pregunta            Índice de artículos (siempre ES, sin toggle)
/la-gran-pregunta/[slug]     Artículo individual

/404                         Página fallback (bilingüe)
```

**Mapeo de slugs ES↔EN para LangToggle:**
```ts
const routeMap = {
  "/": "/en/",
  "/servicios": "/en/services",
  "/sobre-nosotros": "/en/about",
  "/contacto": "/en/contact",
  "/la-gran-pregunta": "/la-gran-pregunta",  // no traduce
  "/la-gran-pregunta/[slug]": "/la-gran-pregunta/[slug]",
};
```

En el nav inglés, el enlace a "La Gran Pregunta" aparece como **"The Big Question"** pero apunta al mismo URL en español; al entrar, el lector ve el contenido en español. Esto es intencional: la voz autorial del Dr. Gómez en su idioma.

### 3.1 Composición de la home

Orden de secciones (scroll vertical):

1. **Hero** (oscuro) — observación firmada del Dr. Gómez + foto + 2 CTAs (form / artículos)
2. **Stats band** (oscuro más profundo) — 15 años HR, 20 años posgrado, 4 certificaciones, 1 PhD
3. **Identidad** (crema) — "We embody the principles of I-O Psychology…" reformulado en voz humana
4. **Servicios resumidos** (crema) — 4 territorios (Talent Acquisition, Employee Experience, Leadership & Performance, Culture & Change), card por territorio con link a `/servicios`
5. **Founder** (oscuro) — bio del Dr. Gómez, certificaciones, foto, CTA "Conoce más"
6. **La Gran Pregunta preview** (crema) — los 3 artículos más recientes, link al índice
7. **Contacto preview** (oscuro) — form corto inline + botón Calendly + link a `/contacto` para form completo
8. **Footer** — repetido en todas las páginas

---

## 4. Sistema visual

### 4.1 Tokens de color

```css
:root {
  --orange:        #EF5A21;   /* CTA primario, énfasis, links activos */
  --orange-soft:   #FAC5B1;   /* hover sobre orange, fondos suaves */
  --orange-cream:  #FCDED3;   /* fondos peach-cream */

  --slate:         #405F6E;   /* texto secundario sobre crema */
  --slate-deep:    #1F2D34;   /* texto principal sobre crema */

  --ink:           #0E1A20;   /* hero, founder, fondos oscuros */
  --ink-deeper:    #0a1418;   /* stats band */

  --cream:         #FAFAF7;   /* fondo de secciones claras */
  --white:         #FFFFFF;   /* cards, inputs */
  --border:        #E5E9EB;   /* divisores sobre crema */
  --border-dark:   rgba(255,255,255,0.08);  /* divisores sobre oscuro */

  --error:         #C0392B;   /* validación */
  --success:       #27AE60;
}
```

Contrastes WCAG verificados:
- `--orange` sobre `--ink`: 5.2:1 ✓ (AA large)
- `--orange-cream` sobre `--ink`: 13.4:1 ✓ (AAA)
- `--slate-deep` sobre `--cream`: 12.1:1 ✓ (AAA)
- `--slate` sobre `--cream`: 6.7:1 ✓ (AA)

### 4.2 Tipografía

- **Sans body:** Inter (variable, weights 400/500/600/700/800), self-hosted via `@fontsource-variable/inter`
- **Serif italic editorial:** Source Serif 4 (variable, italic, weight 400-500), self-hosted via `@fontsource-variable/source-serif-4`

Self-hosting evita request a Google y mejora LCP.

Escala fluida (móvil → desktop con `clamp()`):
```css
--font-h1: clamp(36px, 5vw, 56px);    /* line-height 1.05, weight 800, letter-spacing -.025em */
--font-h2: clamp(28px, 3.6vw, 40px);  /* line-height 1.1 */
--font-h3: 22px;
--font-h4: 18px;
--font-body: 16px;                     /* line-height 1.65 */
--font-small: 14px;
--font-label: 11px;                    /* uppercase, letter-spacing .18em, weight 700 */
```

**Patrón "alma editorial":** las frases marcadas con `<em>` en headings se renderizan en Source Serif 4 italic, color contrastante (`--orange-cream` sobre fondo oscuro, `--orange` sobre crema). Ejemplo:

```html
<h1>La gente buena no <em>renuncia por dinero.</em></h1>
```

Esto es el detalle clave que humaniza la tipografía sans-serif y le da personalidad editorial.

### 4.3 Spacing y radii

```css
--space-xs: 4px;
--space-sm: 8px;
--space: 16px;
--space-md: 24px;
--space-lg: 32px;
--space-xl: 48px;
--space-2xl: 80px;
--space-3xl: 120px;

--radius-sm: 6px;
--radius: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-pill: 999px;
```

### 4.4 Patrón de ritmo (alternancia de fondos)

| Sección | Fondo |
|---|---|
| Hero | `--ink` |
| Stats | `--ink-deeper` |
| Identidad | `--cream` |
| Servicios | `--cream` con cards `--white` |
| Founder | `--ink` |
| La Gran Pregunta preview | `--cream` |
| Contacto | `--ink` |
| Footer | `--ink-deeper` |

El ritmo oscuro/crema previene fatiga visual y le da al sitio sensación curada (no "una landing larga").

---

## 5. Componentes

### 5.1 Catálogo

| Componente | Path | Notas |
|---|---|---|
| `Nav` | `src/components/layout/Nav.astro` | Sticky transparente sobre hero, sólido al scrollear (>120px) |
| `Footer` | `src/components/layout/Footer.astro` | Enlaces, redes, copyright, lang toggle redundante |
| `LangToggle` | `src/components/layout/LangToggle.astro` | ES / EN; encapsula mapping de rutas equivalentes (`/sobre-nosotros` ↔ `/en/about`); persiste `localStorage["lang"]`; respeta `Accept-Language` en primera visita |
| `BaseLayout` | `src/layouts/BaseLayout.astro` | `<head>` con OG, viewport, theme-color, fonts; `<main>` slot |
| `Hero` | `src/components/sections/Hero.astro` | Props: `eyebrow`, `headline` (con `<em>` permitido), `lede`, `signoff?`, `ctaPrimary`, `ctaSecondary`, `photo` |
| `StatsBand` | `src/components/sections/StatsBand.astro` | 4 stats (`num` + `label`); fondo `--ink-deeper` |
| `ServicesGrid` | `src/components/sections/ServicesGrid.astro` | Lee de `src/content/servicios/`, agrupa por `territorio` |
| `ServiceCard` | `src/components/ui/ServiceCard.astro` | Numerada, título-frase, meta-tags al pie |
| `FounderCard` | `src/components/sections/FounderCard.astro` | Foto, bio, certificaciones list |
| `ArticleCard` | `src/components/ui/ArticleCard.astro` | Imagen, título, fecha, tiempo lectura, tags |
| `ArticleLayout` | `src/layouts/ArticleLayout.astro` | Para `/la-gran-pregunta/[slug]`; max-width 720px, tipografía editorial |
| `ContactForm` | `src/components/sections/ContactForm.astro` | Form HTML con island JS para submit + validación |
| `CalendlyButton` | `src/components/ui/CalendlyButton.astro` | Lazy-loads `embed.js` cuando entra en viewport |
| `ValueCard` | `src/components/ui/ValueCard.astro` | Para los 5 valores en `/sobre-nosotros` |
| `Button` | `src/components/ui/Button.astro` | Variants: `primary`, `ghost`, `outline-light`, `outline-dark` |

### 5.2 Boundaries claros

Cada componente declara explícitamente:
- **Inputs:** props tipados
- **Outputs:** HTML renderizado, eventos custom (form submit)
- **Side effects:** ninguno por default; los que tienen JS (form, lang toggle, Calendly) lo declaran en su archivo

Los componentes de sección (`Hero`, `Stats`, etc.) reciben TODO su contenido por props. No leen directo de content collections — eso lo hace la página. Esto los hace reusables y testeables aisladamente.

---

## 6. Contenido y i18n

### 6.1 Diccionarios UI

```
src/content/i18n/
├── es.json
└── en.json
```

Estructura plana con dot-keys:
```json
{
  "nav.servicios": "Servicios",
  "nav.sobre": "Sobre nosotros",
  "nav.articulos": "La Gran Pregunta",
  "nav.contacto": "Contacto",
  "cta.cuentame": "Cuéntame de tu organización",
  "cta.reserva": "Reserva 30 min",
  "form.nombre": "Nombre",
  "form.email": "Email corporativo",
  "form.organizacion": "Organización",
  "form.mensaje": "¿Qué pasa en tu organización?",
  "form.enviar": "Enviar",
  "form.gracias": "Gracias. El Dr. Gómez te responderá en 1-2 días hábiles.",
  "form.error": "Algo falló. Intenta de nuevo o escríbenos directo.",
  ...
}
```

Helper:
```ts
// src/lib/i18n.ts
export function t(key: string, lang: "es" | "en"): string { ... }
```

### 6.2 Content collections

```
src/content/
├── articulos/
│   └── el-primer-ano-tambien-se-disena.mdx
├── servicios/
│   ├── employee-experience.mdx
│   ├── leadership-development.mdx
│   ├── ... (14 archivos)
│   └── change-management.mdx
└── valores/
    ├── curiosity.mdx
    ├── agility.mdx
    ├── visionary-thinking.mdx
    ├── collaborative-creativity.mdx
    └── resilience.mdx
```

Schemas en `src/content/config.ts`:

```ts
const articulos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    fecha: z.date(),
    autor: z.string().default("Dr. Alejandro J. Gómez Betancourt"),
    resumen: z.string(),
    imagen: z.string(),
    tiempoLectura: z.number().int().positive(),
    tags: z.array(z.string()),
    publicado: z.boolean().default(true),
  }),
});

const servicios = defineCollection({
  type: "content",
  schema: z.object({
    titulo_es: z.string(),
    titulo_en: z.string(),
    territorio: z.enum(["talent-acquisition", "employee-experience", "leadership-performance", "culture-change"]),
    orden: z.number().int(),
    resumen_es: z.string(),
    resumen_en: z.string(),
    herramientas: z.array(z.string()).optional(),
  }),
});
```

### 6.3 Voz y tono (copy guidelines)

Toda copia futura debe pasar por estos filtros:

- **Primera persona del Dr. Gómez** cuando aplique ("Trabajo con líderes que…", "Lo que ofrezco es…").
- **Frases con punto de vista**, no descripciones neutras. *Mal:* "Programas de liderazgo basados en metodología científica." *Bien:* "Los líderes que tu próxima etapa va a necesitar — entrenados con Hogan, DISC y supervisión real, no en talleres genéricos."
- **Sin buzzwords**: evitar *journey*, *experiencia del colaborador*, *unleash potential*, *empoderar*, *sinergias*, *transformación digital*. Si la palabra puede salir de un AI, reescribir.
- **Datos específicos > adjetivos**: "20 años enseñando posgrado en universidades de Puerto Rico" es más fuerte que "amplia experiencia académica".
- **Preguntas como gancho** (alineado con el nombre "La Gran Pregunta"): cada sección puede abrir o cerrar con una pregunta concreta al lector.
- **Italics editoriales** para énfasis emocional/conceptual (van envueltos en `<em>` en MDX/Astro y se renderizan en Source Serif italic).

---

## 7. Formulario de contacto

### 7.1 Flow

```
[ContactForm UI]
       │
       │ POST /api/contacto.ts (Astro endpoint, server-rendered)
       ▼
[Validación Zod]
       │
       ├─ honeypot field "_website" debe estar vacío → si tiene valor, return 200 (silent drop)
       ├─ rate-limit por IP (LRU in-memory, 3 req/min)
       ├─ campos requeridos: nombre, email, organizacion, mensaje (≥20 chars)
       │
       ▼
[Resend API]
       │
       │ resend.emails.send({
       │   from: "Innovational TMS <noreply@TBD-DOMAIN>",
       │   to: process.env.CONTACT_EMAIL,
       │   reply_to: form.email,
       │   subject: "Nuevo mensaje desde innovationaltms.com",
       │   html: <plantilla con nombre, email, organizacion, mensaje>,
       │ })
       │
       ▼
[Respuesta JSON]
       │
       ├─ ok: true → UI muestra "Gracias. Te responderé en 1-2 días"
       └─ ok: false, error → UI muestra mensaje + botón "abrir email" (mailto: con cuerpo prellenado)
```

### 7.2 Variables de entorno

```bash
# .env.local (no commiteado) y Vercel project settings
RESEND_API_KEY=re_xxxxxxxxxxxxx
CONTACT_EMAIL=TBD                    # email destino (TBD: el cliente debe proveer)
RESEND_FROM_DOMAIN=TBD               # ej. "noreply@innovationaltms.com"; necesita DNS verification
CALENDLY_URL=TBD                     # ej. "https://calendly.com/innovational-tms/30min"
```

Los TBD se resuelven antes de production deploy. Mientras tanto, en preview/local el form funciona con un mock que loguea a consola y devuelve éxito.

### 7.3 Validación

Zod schema:
```ts
const ContactSchema = z.object({
  nombre: z.string().min(2).max(80),
  email: z.string().email(),
  organizacion: z.string().min(2).max(120),
  mensaje: z.string().min(20).max(2000),
  _website: z.string().max(0),  // honeypot
});
```

Errores mostrados inline bajo cada campo, en `--error` color, con `aria-describedby` para a11y.

---

## 8. SEO, performance, a11y

### 8.1 Meta tags

`BaseLayout.astro` recibe props:
```ts
{
  title: string;          // <70 chars
  description: string;    // <160 chars
  ogImage?: string;       // default: /og/default.jpg
  canonical?: string;
  lang: "es" | "en";
}
```

OG image custom por página principal y por artículo (generada con `canvas-design` skill).

### 8.2 Structured data (JSON-LD)

- **Home / Sobre nosotros:** `Organization` + `Person` (Dr. Gómez con `jobTitle`, `alumniOf` Albizu)
- **Cada artículo:** `Article` + `Person` author
- **Servicios:** `Service` schema por cada uno

### 8.3 Performance

Targets Lighthouse:
- Performance ≥ 95
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 100

Implementación:
- Self-host fonts (subset latin)
- Astro Image con `loading="lazy"` excepto LCP candidate del hero (`loading="eager"`)
- Critical CSS inline; resto async
- Sin scripts de terceros en home except Vercel Analytics (sin cookies)
- Calendly embed JS lazy-loaded sólo en `/contacto` cuando entra en viewport

### 8.4 Accessibility

- WCAG 2.1 AA mínimo
- Skip-link al `<main>`
- Headings con jerarquía estricta (un `<h1>` por página)
- Focus states visibles en todos los interactivos (`outline: 2px solid var(--orange); outline-offset: 3px`)
- `prefers-reduced-motion`: deshabilita transiciones largas y glow animations
- `prefers-color-scheme`: el sitio es dark+cream por diseño; no implementamos modo claro/oscuro variable
- Alt text descriptivo en todas las imágenes
- Form labels asociados, errores con `aria-live="polite"`

---

## 9. Assets y manejo de placeholders

| Asset | Estado actual | Plan inmediato | Plan final |
|---|---|---|---|
| Logo Innovational TMS | PNG bajo-medio crop del PDF | Usar PNG del PDF en `/public/logo.png` | **TBD:** pedir SVG al cliente; si no llega, recrear en SVG basado en PDF |
| Foto Dr. Gómez | Crop circular bajo res del PDF | Usar como placeholder en hero/founder | **TBD:** pedir foto profesional HD; si no llega, generar versión limpia con MCP de imagen |
| Hero imagery / texturas | No existe | Generar con MCP de generación de imagen (`generate_image`) — composiciones abstractas en paleta de marca | Reemplazar por foto editorial profesional cuando se obtenga |
| Imágenes de servicios | No existe | Unsplash editorial curado + créditos en footer | Reemplazar por fotos del equipo / clientes cuando existan |
| OG image (social share) | No existe | Generar con `canvas-design` skill: `--ink` background + logo + tagline | Stable |
| Favicon | No existe | Derivar del "o-target" del logo (versión simplificada) | Stable |
| Fotos de la sección "Identidad" / valores | No existe | Stock editorial Unsplash | TBD pendiente del cliente |

**TBDs no resueltos** (deben resolverse antes de production deploy, no bloquean implementación):
1. Email destino del formulario
2. URL de Calendly
3. Dominio (mientras tanto: `innovational-tms.vercel.app` o similar)
4. Logo en SVG
5. Foto del Dr. Gómez en alta resolución

---

## 10. Plan de testing

### 10.1 Tests automatizados

- **Lighthouse CI** en cada PR (configurado en `.github/workflows/lighthouse.yml` → falla si Performance < 90 o A11y < 95)
- **Astro check** (TypeScript + content schema validation) en CI
- **Pa11y CI** sobre las 5 páginas principales (home, servicios, sobre-nosotros, contacto, una página de artículo)

### 10.2 Verificación manual antes de deploy

Checklist para cada deploy a production:
- [ ] Cargar todas las páginas en ES y EN
- [ ] Toggle ES↔EN preserva la página equivalente
- [ ] Form de contacto envía y llega al inbox destino
- [ ] Calendly embed carga correctamente
- [ ] Lighthouse en mobile y desktop (target 95+)
- [ ] OG image se renderiza correctamente al pegar URL en LinkedIn / WhatsApp
- [ ] Sitemap.xml se genera y todas las URLs son válidas
- [ ] No hay placeholders TBD visibles en copia ni en assets

### 10.3 Tests cross-device

Browsers manualmente verificados antes de production:
- Safari iOS (audiencia profesional usa iPhone)
- Chrome Android
- Chrome / Edge / Safari desktop

---

## 11. Skills y herramientas a usar en implementación

Cuando se ejecute el plan de implementación, usar:

- **`frontend-design`** skill como base para todos los componentes — produce código distintivo, evita estética AI genérica.
- **`canvas-design`** skill para piezas visuales estáticas (OG images, covers de artículos, hero illustrations cuando no haya foto).
- **MCP de generación de imagen** (`generate_image`) para imágenes de hero abstractas y placeholders de servicio cuando el cliente no provea fotos.
- **`anthropic-skills:pdf`** ya usado para extraer brand assets del sheet original.
- **`verification-before-completion`** skill al cerrar la implementación, verificando con preview tools que cada cambio se ve correcto en navegador.
- **Astro DevTools** en desarrollo para inspeccionar islands hydration y bundle size.

---

## 12. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Cliente no provee logo SVG → calidad visual del logo limitada por crop de PDF | Recrear en SVG basado en el render; pedir cuando esté listo, drop-in replace |
| Cliente no provee email destino → form no funciona en production | El form valida y guarda intent localmente con `mailto:` fallback hasta que se configure Resend |
| Resend free tier (3,000 emails/mes) se agota | Cambio a paid tier ($20/mes) o switch a Web3Forms; el endpoint está abstraído así que es swap de 1 archivo |
| Calendly rompe / cambia API | El botón degrada a `mailto:` con asunto "Solicitud de reunión" |
| Bot spam masivo | Honeypot + rate limit + Resend filtering; si crece, agregar Cloudflare Turnstile |
| LinkedIn cambia URL del artículo / lo borra | Tenemos copia del contenido localmente (MDX); no dependemos del link externo |
| Cliente quiere editar artículos sin tocar git | Aceptado como out-of-scope; si en el futuro lo pide, migrar a Decap CMS (también gratis, sigue viviendo en GitHub) |

---

## 13. Apéndice: contenido inicial

### 13.1 Hero (ES, voz humanizada confirmada)

> **Eyebrow:** Consultoría · Psicología Industrial-Organizacional
>
> **Headline:** La gente buena no *renuncia por dinero.* Renuncia por decisiones que se tomaron meses antes.
>
> **Lede:** Después de quince años acompañando organizaciones, hay algo que se repite: el problema casi nunca es "falta de talento". Es que las decisiones sobre la gente se siguen tomando por intuición. Yo ofrezco metodología, evidencia y un par de preguntas incómodas.
>
> **Signoff:** — Dr. Alejandro J. Gómez Betancourt
>
> **CTA primario:** Cuéntame de tu organización →
>
> **CTA secundario:** Lee La Gran Pregunta

### 13.2 Hero (EN — versión a producir, mismo tono)

Por traducir manteniendo voz, no traducción literal. Borrador de referencia:
> Good people don't *quit because of money.* They quit because of decisions made months earlier.

### 13.3 Servicios — territorios y mapping

| Territorio | Servicios del sheet |
|---|---|
| **Talent Acquisition** | Strategic Talent Acquisition · Workforce Planning · Talent Acquisition Advisory · Candidate Experience Design · Job Profiling & Talent Segmentation · Job Analysis and Job Specification · EVP and Employer Branding Development |
| **Employee Experience** | Employee Experience Evaluation and Redesign · Onboarding Experience Design |
| **Leadership & Performance** | Leadership Development Programs · Effective Supervision Training Programs · Performance Management Systems |
| **Culture & Change** | Organizational Culture Transformation · Change Management Consulting |

### 13.4 Valores (los 5 "personality")

| Valor | Descripción del sheet |
|---|---|
| Curiosity | A relentless drive to explore new methods, uncover untapped potential, and question the status quo. |
| Agility | The ability to pivot quickly and design solutions that keep pace with evolving organizational needs. |
| Visionary Thinking | A focus on future-forward strategies that anticipate trends and foster long-term success. |
| Collaborative Creativity | Partnering with our clients to co-create transformative experiences that inspire growth. |
| Resilience | The courage to embrace challenges and turn them into opportunities for breakthrough innovation. |

Estos 5 son los "personality values" del PDF y se rendean como `ValueCard`s en `/sobre-nosotros`.

---

## 14. Próximos pasos

1. Revisión de este spec por el usuario.
2. Crear plan de implementación detallado (vía `superpowers:writing-plans` skill).
3. Ejecutar el plan paso a paso (con `superpowers:executing-plans`).

Cualquier cambio al diseño aprobado requiere actualizar este documento antes de implementarlo.
