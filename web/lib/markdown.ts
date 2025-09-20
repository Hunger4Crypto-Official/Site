import DOMPurify from "isomorphic-dompurify";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import DOMPurify from "isomorphic-dompurify";

export async function mdToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
 codex/suggest-improvements-for-web-portion
  const html = String(file);
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const rendered = String(file);
  return DOMPurify.sanitize(rendered);
 main
}
