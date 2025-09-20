// web/lib/markdown.ts
import createDOMPurify from "isomorphic-dompurify";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const windowLike =
  typeof window === "undefined" ? undefined : (window as unknown as typeof globalThis);

const DOMPurify = createDOMPurify(windowLike);

export async function mdToHtml(md: string): Promise<string> {
  const source = typeof md === "string" ? md : "";

  try {
    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(source);
    
    const html = String(file);
    
    // Sanitize with proper HTML profile for safety
    return DOMPurify.sanitize(html, { 
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'u', 'i', 'b',
        'ul', 'ol', 'li',
        'a', 'img',
        'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id']
    });
  } catch (error) {
    console.error('Markdown processing failed:', error);
    // Return sanitized fallback
    return DOMPurify.sanitize(source);
  }
}
