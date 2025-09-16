import { remark } from 'remark';
import html from 'remark-html';

export async function mdToHtml(md: string) {
  const file = await remark().use(html, { sanitize: false }).process(md || '');
  return String(file);
}
