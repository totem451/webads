import type { CollectionEntry } from 'astro:content';

/**
 * Posts relacionados por número de tags compartidos (desc), luego por
 * fecha de publicación más reciente. Nunca incluye el propio post ni drafts.
 */
export function getRelatedPosts(
  current: CollectionEntry<'posts'>,
  allPosts: CollectionEntry<'posts'>[],
  limit = 3
): CollectionEntry<'posts'>[] {
  const currentTags = new Set(current.data.tags);

  return allPosts
    .filter((post) => post.id !== current.id && !post.data.draft)
    .map((post) => {
      const sharedTags = post.data.tags.filter((tag) => currentTags.has(tag)).length;
      return { post, sharedTags };
    })
    .filter(({ sharedTags }) => sharedTags > 0)
    .sort((a, b) => {
      if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
      return b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf();
    })
    .slice(0, limit)
    .map(({ post }) => post);
}
