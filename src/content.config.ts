import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),

      // Marca artículos que incluyen una captura/dato real del autor (no genérico).
      // El script de QA exige una cuota mínima de estos por cada N posts publicados.
      hasFirstHandData: z.boolean().default(false),

      // Indica si el post contiene enlaces de afiliado, para activar el
      // disclosure automático (inline + enlace a /disclosure) en PostLayout.
      affiliateLinks: z.boolean().default(false),

      draft: z.boolean().default(true),

      // Imagen de portada opcional (ruta relativa al archivo del post, ej.
      // "./cover.jpg"). Astro la procesa con astro:assets (formatos modernos,
      // tamaños) y se usa también como OG image fallback del post.
      coverImage: image().optional(),
      coverImageAlt: z.string().optional()
    })
});

export const collections = { posts };
