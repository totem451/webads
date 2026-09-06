import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, AUTHOR_NAME } from '../consts';

export interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  /** Ruta absoluta desde la raíz, ej. "/blog/mi-post" */
  path: string;
  type?: 'website' | 'article';
}

export function resolveSeo({ title, description, image, path, type = 'website' }: SeoProps) {
  const resolvedTitle = title ? `${title} — ${SITE_TITLE}` : SITE_TITLE;
  const resolvedDescription = description ?? SITE_DESCRIPTION;
  const canonicalUrl = new URL(path, SITE_URL).toString();
  const resolvedImage = image ? new URL(image, SITE_URL).toString() : new URL('/og-default.png', SITE_URL).toString();

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    canonicalUrl,
    image: resolvedImage,
    type
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbListSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString()
    }))
  };
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  path: string;
  pubDate: Date;
  updatedDate?: Date;
  image?: string;
}

export function articleSchema({ title, description, path, pubDate, updatedDate, image }: ArticleSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    mainEntityOfPage: new URL(path, SITE_URL).toString(),
    image: image ? new URL(image, SITE_URL).toString() : new URL('/og-default.png', SITE_URL).toString(),
    datePublished: pubDate.toISOString(),
    dateModified: (updatedDate ?? pubDate).toISOString(),
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME
    }
  };
}
