import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import createDOMPurify from "isomorphic-dompurify";

const DOMPurify = createDOMPurify(
  typeof window === "undefined" ? undefined : (window as unknown as Window)
);

export async function mdToHtml(md: string): Promise<string> {
  const source = typeof md === "string" ? md : "";

  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(source);

  const rawHtml = String(file);
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}
