#!/usr/bin/env node
/**
 * QA de contenido — se ejecuta manualmente (`npm run qa`), NO forma parte
 * del build de Astro. Valida los posts en src/content/posts antes de
 * publicarlos (quitar draft: true).
 *
 * Comprueba:
 *  1. Longitud mínima de palabras.
 *  2. Al menos un post con hasFirstHandData:true por cada N posts publicados
 *     (orden cronológico), N = FIRST_HAND_DATA_RATIO.
 *  3. Enlaces internos (/blog/... y /tags/...) que apuntan a slugs o tags
 *     inexistentes.
 *  4. Marcadores "TODO:" o "[DATO PENDIENTE]" sin resolver en posts
 *     publicados (draft: false).
 *
 * Exit code 0 = todo OK. Exit code 1 = hay al menos un error bloqueante en
 * un post publicado (draft: false). Los problemas en drafts se listan como
 * advertencias y no bloquean el script.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

const POSTS_DIR = join(process.cwd(), 'src/content/posts');
const MIN_WORD_COUNT = 600;
// Debe coincidir con FIRST_HAND_DATA_RATIO en src/consts.ts
const FIRST_HAND_DATA_RATIO = 5;
const UNRESOLVED_MARKERS = ['TODO:', '[DATO PENDIENTE]'];

function findContentFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findContentFiles(fullPath));
    } else if (/\.mdx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function slugFromPath(filePath) {
  return relative(POSTS_DIR, filePath)
    .replace(/\.mdx?$/, '')
    .split(/[\\/]/)
    .join('/');
}

/** Cuenta palabras del cuerpo, ignorando bloques de código y sintaxis markdown básica. */
function countWords(body) {
  const withoutCodeBlocks = body.replace(/```[\s\S]*?```/g, ' ');
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, ' ');
  const withoutMarkdownSyntax = withoutInlineCode
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imágenes
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // enlaces -> texto
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/[*_>#-]/g, ' ');
  const words = withoutMarkdownSyntax.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function findInternalLinks(body) {
  const links = [];
  const linkRegex = /\[[^\]]*\]\((\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = linkRegex.exec(body))) {
    links.push(match[1]);
  }
  return links;
}

function findUnresolvedMarkers(body) {
  return UNRESOLVED_MARKERS.filter((marker) => body.includes(marker));
}

function main() {
  let files;
  try {
    files = findContentFiles(POSTS_DIR);
  } catch (err) {
    console.error(`No se pudo leer ${POSTS_DIR}: ${err.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No hay posts en src/content/posts todavía. Nada que validar.');
    process.exit(0);
  }

  const posts = files.map((filePath) => {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return {
      filePath,
      slug: slugFromPath(filePath),
      data,
      body: content,
      wordCount: countWords(content)
    };
  });

  const knownSlugs = new Set(posts.map((p) => p.slug));
  const knownTags = new Set(posts.flatMap((p) => p.data.tags ?? []));

  const errors = [];
  const warnings = [];

  for (const post of posts) {
    const label = relative(process.cwd(), post.filePath);
    const isDraft = post.data.draft !== false; // por defecto true si no está definido
    const bucket = isDraft ? warnings : errors;

    // 1. Longitud mínima
    if (post.wordCount < MIN_WORD_COUNT) {
      bucket.push(`${label}: ${post.wordCount} palabras (mínimo ${MIN_WORD_COUNT}).`);
    }

    // 3. Enlaces internos rotos
    for (const link of findInternalLinks(post.body)) {
      const [rawPath] = link.split(/[?#]/);
      const cleanPath = rawPath.replace(/\/$/, '');

      if (cleanPath.startsWith('/blog/')) {
        const targetSlug = cleanPath.replace('/blog/', '');
        if (!knownSlugs.has(targetSlug)) {
          bucket.push(`${label}: enlace interno roto "${link}" (no existe el post "${targetSlug}").`);
        }
      } else if (cleanPath.startsWith('/tags/')) {
        const targetTag = cleanPath.replace('/tags/', '');
        if (!knownTags.has(targetTag)) {
          bucket.push(`${label}: enlace interno roto "${link}" (no existe el tag "${targetTag}").`);
        }
      }
    }

    // 4. Marcadores sin resolver — solo bloquea si el post ya no es draft
    const markers = findUnresolvedMarkers(post.body);
    if (markers.length > 0) {
      const msg = `${label}: contiene marcador(es) sin resolver: ${markers.join(', ')}.`;
      if (isDraft) {
        warnings.push(msg);
      } else {
        errors.push(`${msg} No se puede publicar (draft: false) con marcadores pendientes.`);
      }
    }
  }

  // 2. Cuota de hasFirstHandData entre posts publicados, en orden cronológico
  const published = posts
    .filter((p) => p.data.draft === false && p.data.pubDate)
    .sort((a, b) => new Date(a.data.pubDate) - new Date(b.data.pubDate));

  for (let i = 0; i < published.length; i += FIRST_HAND_DATA_RATIO) {
    const chunk = published.slice(i, i + FIRST_HAND_DATA_RATIO);
    const hasRealData = chunk.some((p) => p.data.hasFirstHandData === true);
    if (!hasRealData) {
      const labels = chunk.map((p) => relative(process.cwd(), p.filePath)).join(', ');
      errors.push(
        `Ninguno de estos ${chunk.length} posts publicados tiene hasFirstHandData:true: ${labels}.`
      );
    }
  }

  console.log(`\nQA de contenido — ${posts.length} posts analizados (${published.length} publicados)\n`);

  if (warnings.length > 0) {
    console.log(`⚠ Advertencias (${warnings.length}) — no bloquean, pero revisar antes de publicar:`);
    for (const w of warnings) console.log(`  - ${w}`);
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`✖ Errores (${errors.length}) en posts publicados:`);
    for (const e of errors) console.log(`  - ${e}`);
    console.log('');
    process.exit(1);
  }

  console.log('✔ Todo correcto en los posts publicados.');
  process.exit(0);
}

main();
