import fs from "node:fs";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "web", "content", "mega_article");
const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));

for (const f of files) {
  const p = path.join(CONTENT_DIR, f);
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const fileSlug = f.replace(/\.json$/, "");
  if (!raw.slug) {
    raw.slug = fileSlug;
    fs.writeFileSync(p, JSON.stringify(raw, null, 2) + "\n");
    console.log(`added slug to ${f}: ${raw.slug}`);
  } else {
    console.log(`kept slug for ${f}: ${raw.slug}`);
  }
}
