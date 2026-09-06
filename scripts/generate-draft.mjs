#!/usr/bin/env node
/**
 * Genera un borrador de post asistido por IA a partir de un topic, usando la
 * API de Claude (Anthropic). Se invoca desde
 * .github/workflows/generate-draft.yml, pero también puede correrse en local:
 *
 *   ANTHROPIC_API_KEY=sk-... TOPIC="Por qué migré de GetX a Riverpod" \
 *   TAGS="flutter,arquitectura" node scripts/generate-draft.mjs
 *
 * El resultado SIEMPRE se escribe con `draft: true`, sin excepción — este
 * script nunca decide publicar nada. Un humano tiene que revisar el
 * contenido, sustituir los marcadores `[DATO PENDIENTE]`/`TODO:` que el
 * modelo inserta a propósito donde no puede inventar datos reales, y solo
 * entonces quitar `draft: true` (momento en el que `npm run qa` empieza a
 * exigir que esos marcadores ya no existan).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src/content/posts');

const MODEL = process.env.MODEL || 'claude-opus-5';
const TOPIC = process.env.TOPIC;
const TAGS = (process.env.TAGS || '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const HAS_FIRST_HAND_DATA = process.env.HAS_FIRST_HAND_DATA === 'true';
const AFFILIATE_LINKS = process.env.AFFILIATE_LINKS === 'true';

if (!TOPIC) {
  console.error('Falta la variable de entorno TOPIC (el tema/ángulo del post a generar).');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Falta la variable de entorno ANTHROPIC_API_KEY.');
  process.exit(1);
}

function slugify(input) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas combinantes tras NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(baseSlug) {
  let slug = baseSlug;
  let n = 2;
  while (existsSync(join(POSTS_DIR, `${slug}.mdx`))) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return slug;
}

// Post real del propio blog usado como referencia de voz/formato (few-shot).
// No se publica, solo orienta el estilo del modelo.
const STYLE_REFERENCE = readFileSync(
  join(POSTS_DIR, 'revenuecat-cloud-functions-entitlements.mdx'),
  'utf-8'
);

const today = new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = `Eres el redactor asistente de "Flutter Monetizado", un blog de nicho sobre
monetización y arquitectura de apps Flutter para developers indie/solo (RevenueCat, Firebase,
Cloud Functions, arquitectura Clean/feature-first, paywalls, pricing).

Voz del blog: developer Flutter senior, escribe desde experiencia real en producción, directo,
técnico, sin relleno genérico de "blog de IA". Cada artículo suena como si lo hubiera escrito
alguien que de verdad mantiene apps con usuarios reales, no un resumen de documentación.

REGLA MÁS IMPORTANTE: nunca inventes datos concretos que deberían venir de una experiencia real
(cifras de conversión, porcentajes, tiempos, costes, capturas de pantalla, resultados de
experimentos). Cuando el artículo necesitaría un dato así para ser creíble, en su lugar escribe
literalmente el marcador \`[DATO PENDIENTE: <qué falta exactamente>]\` describiendo qué dato real
falta ahí. Cuando algo requiere verificación o decisión humana antes de publicar (una fecha, un
enlace, una cifra de precio actual, una comprobación técnica), escribe literalmente
\`TODO: <qué hay que revisar>\`. Un script de QA automático busca exactamente estos dos marcadores
antes de permitir publicar, así que deben aparecer tal cual, sin traducir ni parafrasear.

Formato de salida — responde ÚNICAMENTE con el contenido de un archivo .mdx, sin explicaciones
antes ni después, sin envolver la respuesta en \`\`\` de markdown. Estructura exacta:

1. Frontmatter YAML entre líneas \`---\`, con exactamente estos campos:
   - title: string
   - description: string (1-2 frases)
   - pubDate: ${today}
   - tags: array de strings en kebab-case
   - hasFirstHandData: ${HAS_FIRST_HAND_DATA}
   - affiliateLinks: ${AFFILIATE_LINKS}
   - draft: true
2. Si vas a usar los componentes de badge/callout, imports justo debajo del frontmatter:
   \`import RealDataBadge from '../../components/RealDataBadge.astro';\`
   \`import AffiliateCallout from '../../components/AffiliateCallout.astro';\`
   (solo importa los que realmente uses en el cuerpo).
3. Cuerpo en MDX, 900-1300 palabras, con:
   - Varios \`## \` headings (2-4) que sirvan de tabla de contenidos.
   - Al menos un bloque de código relevante (\`\`\`dart, \`\`\`yaml, \`\`\`kotlin o \`\`\`swift según
     el tema).
   - \`<RealDataBadge label="..." />\` en los puntos donde el post afirma algo basado en datos
     reales (combínalo con \`[DATO PENDIENTE: ...]\` si esa cifra concreta no la tienes).
   - Si affiliateLinks es true, exactamente un \`<AffiliateCallout title="..." href="...">texto</AffiliateCallout>\`
     recomendando una herramienta relevante y real del ecosistema (RevenueCat, Firebase, etc.),
     con la URL real del producto.

Aquí tienes un post real del blog como referencia de tono, estructura y nivel técnico (NO lo copies,
es solo para que calibres el estilo):

---INICIO REFERENCIA---
${STYLE_REFERENCE}
---FIN REFERENCIA---`;

const userTagsHint = TAGS.length > 0 ? `Tags sugeridos (ajústalos/complétalos si hace falta): ${TAGS.join(', ')}.` : '';

const USER_PROMPT = `Escribe un borrador de post nuevo sobre este tema:

"${TOPIC}"

${userTagsHint}`.trim();

async function main() {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT }]
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    console.error('La respuesta del modelo no contiene ningún bloque de texto.');
    process.exit(1);
  }

  const raw = textBlock.text.trim();
  const parsed = matter(raw);

  // gray-matter parsea fechas YAML como objetos Date; los volvemos a un
  // string plano YYYY-MM-DD para no serializar timestamps ISO completos.
  const rawPubDate = parsed.data.pubDate ?? today;
  const pubDate = rawPubDate instanceof Date ? rawPubDate.toISOString().slice(0, 10) : String(rawPubDate).slice(0, 10);

  // El script, no el modelo, decide estos campos — nunca nos fiamos de lo
  // que haya escrito el modelo para draft/tags/flags.
  const data = {
    ...parsed.data,
    tags: TAGS.length > 0 ? TAGS : parsed.data.tags ?? [],
    hasFirstHandData: HAS_FIRST_HAND_DATA,
    affiliateLinks: AFFILIATE_LINKS,
    draft: true,
    pubDate
  };

  if (!data.title) {
    console.error('El modelo no generó un "title" en el frontmatter. Abortando.');
    process.exit(1);
  }

  const baseSlug = slugify(data.title);
  const slug = uniqueSlug(baseSlug);
  const filePath = join(POSTS_DIR, `${slug}.mdx`);

  const fileContent = matter.stringify(parsed.content.trim() + '\n', data);

  mkdirSync(POSTS_DIR, { recursive: true });
  writeFileSync(filePath, fileContent, 'utf-8');

  console.log(`Borrador escrito en src/content/posts/${slug}.mdx`);

  // Salidas para el workflow de GitHub Actions (crear la PR).
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `slug=${slug}\npath=src/content/posts/${slug}.mdx\ntitle=${data.title}\n`,
      { flag: 'a' }
    );
  }
}

main().catch((err) => {
  console.error('Error generando el borrador:', err);
  process.exit(1);
});
