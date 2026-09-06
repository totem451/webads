import type { MarkdownHeading } from 'astro';

export interface TocItem extends MarkdownHeading {
  children: TocItem[];
}

/**
 * Convierte la lista plana de headings que devuelve `render(entry)` en un
 * árbol anidado por profundidad, ignorando h1 (el título ya lo pinta el
 * layout) y limitando a h2/h3 para que la TOC no sea demasiado ruidosa.
 */
export function buildToc(headings: MarkdownHeading[]): TocItem[] {
  const filtered = headings.filter((h) => h.depth >= 2 && h.depth <= 3);
  const root: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const heading of filtered) {
    const item: TocItem = { ...heading, children: [] };

    while (stack.length && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  }

  return root;
}
