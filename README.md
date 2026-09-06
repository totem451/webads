# Flutter Monetizado — blog de nicho

Blog sobre monetización y arquitectura de apps Flutter para developers indie/solo (RevenueCat,
Firebase, Cloud Functions, Clean/feature-first, paywalls, pricing). Contenido escrito/curado por un
humano, asistido por IA, con revisión obligatoria antes de publicar.

**Stack:** Astro (SSG) · Content Collections (Zod) · Tailwind CSS v4 · MDX · Cloudflare (Workers +
static assets, sucesor de "Cloudflare Pages") · GitHub.

## Empezar

```sh
npm install
npm run dev       # http://localhost:4321
```

```sh
npm run build     # genera ./dist (sitio 100% estático)
npm run preview   # sirve ./dist localmente para verificar el build
```

## Estructura del proyecto

```
src/
  content.config.ts       # schema Zod de la colección "posts"
  content/posts/          # posts en .md/.mdx
  consts.ts                # título, descripción, autor, redes, etc. del sitio
  layouts/
    BaseLayout.astro       # <head>, meta/OG/Twitter, JSON-LD, header/footer
    PostLayout.astro       # layout de artículo: TOC, badges, related posts
  components/              # AffiliateCallout, RealDataBadge, PostCard, TOC, etc.
  lib/
    seo.ts                  # resolución de meta tags + JSON-LD (Article/BreadcrumbList)
    toc.ts                  # construye el árbol de TOC desde los headings del MDX
    related.ts              # posts relacionados por tags compartidos
  pages/
    index.astro             # home
    blog/[...page].astro    # listado paginado (también sirve /blog)
    blog/[slug].astro       # post individual
    tags/[tag].astro         # listado por tag
    about.astro, disclosure.astro, privacy.astro, 404.astro
    rss.xml.js               # feed RSS
scripts/
  qa-content.mjs            # QA de contenido, fuera del build (ver abajo)
  generate-draft.mjs        # genera un borrador con Claude, usado por el workflow de GitHub Actions
.github/workflows/
  generate-draft.yml        # pipeline de generación de contenido asistido por IA (ver abajo)
```

## Escribir un post

Crea un archivo en `src/content/posts/mi-post.mdx` con este frontmatter:

```yaml
---
title: 'Título del post'
description: 'Descripción corta para listados, OG y meta description.'
pubDate: 2026-09-06
updatedDate: 2026-09-10 # opcional
tags: ['revenuecat', 'firebase']
hasFirstHandData: true # ¿incluye un dato/captura real tuyo, no genérico?
affiliateLinks: true # ¿tiene enlaces de afiliado? activa el disclosure inline
draft: true # pon false solo cuando esté revisado y listo para publicar
coverImage: './cover.jpg' # opcional, ruta relativa al propio post
coverImageAlt: 'Texto alternativo de la portada'
---
```

Componentes disponibles dentro del `.mdx` (impórtalos igual que en los posts de ejemplo):

- `<RealDataBadge label="..." />` — badge visual para marcar secciones con datos de primera mano.
- `<AffiliateCallout title="..." href="...">texto</AffiliateCallout>` — recomendación de afiliado
  con disclosure inline y enlace a `/disclosure`.
- Bloques de código con fences normales (` ```dart `, ` ```yaml `, ` ```kotlin `, ` ```swift `, etc.)
  se resaltan automáticamente con Shiki, con tema claro/oscuro sincronizado al toggle del sitio.

Hay 4 posts de ejemplo en `src/content/posts/` que ejercitan todo lo anterior — úsalos como
plantilla y bórralos cuando tengas contenido real propio.

## QA de contenido (antes de publicar)

```sh
npm run qa
```

Recorre todos los posts y valida (ver `scripts/qa-content.mjs`):

1. Longitud mínima de palabras (`MIN_WORD_COUNT`, por defecto 600).
2. Al menos un post con `hasFirstHandData: true` por cada `FIRST_HAND_DATA_RATIO` posts publicados
   (por defecto 5 — debe coincidir con la constante del mismo nombre en `src/consts.ts`).
3. Enlaces internos rotos (`/blog/...`, `/tags/...`) que apunten a slugs o tags inexistentes.
4. Marcadores `TODO:` o `[DATO PENDIENTE]` sin resolver en posts ya publicados (`draft: false`).

Los problemas en posts con `draft: true` se listan como advertencias (no bloquean). El script sale
con código 1 si hay errores en posts publicados — pensado para engancharlo a un hook de pre-commit
o a CI en el futuro, pero de momento se ejecuta manualmente.

## Pipeline de generación de contenido asistido por IA

Un workflow de GitHub Actions (`.github/workflows/generate-draft.yml`) genera un borrador de post
con Claude a partir de un tema, y abre una Pull Request. **Nunca escribe en `main` directamente y
nunca publica nada** — el resultado siempre lleva `draft: true`, sin excepción, y la PR trae un
checklist de revisión humana obligatoria.

### Configuración (una sola vez)

1. Consigue una API key de Anthropic (console.anthropic.com).
2. Añádela como secret del repo:
   ```sh
   gh secret set ANTHROPIC_API_KEY --repo totem451/webads
   ```
   (o desde GitHub: Settings → Secrets and variables → Actions → New repository secret).

### Uso

Desde la pestaña **Actions** del repo → "Generar borrador de post (IA)" → **Run workflow**, o por
CLI:

```sh
gh workflow run generate-draft.yml \
  --repo totem451/webads \
  -f topic="Por qué migré de GetX a Riverpod en una app con 50k usuarios" \
  -f tags="flutter,arquitectura" \
  -f has_first_hand_data=true \
  -f affiliate_links=false
```

El workflow:

1. Llama a Claude (`scripts/generate-draft.mjs`) con un prompt que fija la voz del blog y, sobre
   todo, **prohíbe inventar datos concretos**: donde el post necesitaría una cifra o resultado real,
   el modelo debe escribir el marcador `[DATO PENDIENTE: ...]` en su lugar (mismo marcador que ya
   busca `npm run qa`), y `TODO:` donde haga falta verificación humana.
2. Fuerza `draft: true` en el frontmatter pase lo que pase (el script ignora cualquier intento del
   modelo de ponerlo en `false`).
3. Corre `npm run qa` en modo informativo (no bloquea la PR — los posts en draft solo generan
   advertencias).
4. Abre una PR con el archivo nuevo en `src/content/posts/`, etiquetada `content-draft` y
   `needs-human-review`, con un checklist de qué revisar antes de quitar `draft: true`.

También puedes correr el generador en local (por ejemplo para iterar el prompt):

```sh
ANTHROPIC_API_KEY=sk-... TOPIC="..." TAGS="flutter" npm run generate-draft
```

## Sistema de diseño

- **Paleta:** técnica oscura (zinc/slate) con acento índigo/azul (`accent-*` en
  `src/styles/global.css`), más un acento cálido puntual (`spark-*`) para badges de dato real.
- **Tipografía:** Inter Variable (cuerpo/UI) + JetBrains Mono Variable (títulos, código) —
  self-hosted vía `@fontsource-variable`, sin llamadas a Google Fonts.
- **Dark mode:** toggle manual (botón en el header) que respeta `prefers-color-scheme` por defecto
  y persiste la elección en `localStorage`. Lógica en `ThemeToggle.astro` + `global.css`.
- Los tokens de color están en variables CSS semánticas (`--bg`, `--text`, `--border`, etc.) y
  utilidades Tailwind v4 (`bg-surface`, `text-fg`, `text-fg-muted`, `border-subtle`) en vez de
  repetir `dark:` en cada componente.

## SEO / técnico

- Sitemap XML automático vía `@astrojs/sitemap` (excluye posts en `draft: true` porque nunca se
  generan sus rutas).
- RSS en `/rss.xml` vía `@astrojs/rss`.
- `robots.txt` en `public/robots.txt`.
- Meta tags + OpenGraph + Twitter cards con fallback desde frontmatter (`src/lib/seo.ts`).
- JSON-LD `Article` en cada post y `BreadcrumbList` en todas las páginas.
- Imágenes optimizadas con `astro:assets` (el campo `coverImage` usa el helper `image()` de content
  collections; las imágenes locales dentro del cuerpo del MDX se optimizan automáticamente).

## Pendiente antes de lanzar (buscar `TODO` en el repo)

- [ ] `astro.config.mjs`: cambiar `site` por el dominio definitivo.
- [ ] `src/consts.ts`: `SITE_URL`, `AUTHOR_NAME`, `SOCIAL_LINKS`.
- [ ] `public/robots.txt`: cambiar `example.com` por el dominio definitivo.
- [ ] `src/layouts/BaseLayout.astro`: meta `google-site-verification` con el código real de Search
      Console.
- [ ] `public/og-default.png`: es un placeholder generado (color sólido). Sustituir por una imagen
      OG real de 1200×630.
- [ ] `/about`, `/disclosure`, `/privacy`: revisar y completar los `TODO:` inline (historia real,
      fechas de revisión, datos de contacto). La página de privacidad debería pasar por asesoría
      legal antes de publicar si vas a monetizar con AdSense/afiliados.
- [ ] Borrar o reescribir los 4 posts de ejemplo en `src/content/posts/`.
- [ ] Si vas a usar el pipeline de generación con IA: añadir el secret `ANTHROPIC_API_KEY` al repo
      (ver sección "Pipeline de generación de contenido asistido por IA").

## Deploy en Cloudflare

`astro add cloudflare` configuró `wrangler.jsonc` con el modelo actual de Cloudflare (Workers +
static assets, que sustituye a "Cloudflare Pages" como target de despliegue recomendado, aunque el
resultado — sitio estático servido desde el edge — es equivalente):

```sh
npm run build
npx wrangler deploy
```

Alternativa sin tocar la terminal: conecta el repositorio de GitHub desde el dashboard de
Cloudflare (Workers & Pages → Create → conectar repo), con build command `npm run build` y
directorio de salida `dist` — Cloudflare hará build y deploy automático en cada push.
