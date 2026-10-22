// Turns legal/*.md into lib/legal/generated-texts.ts, so the legal texts are
// plain strings to every page, route and browser bundle. Runs before
// `npm run build` and `npm run dev`; the .md files are the source.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "legal");
const texts = Object.fromEntries(
  readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => [f.replace(/\.md$/, ""), readFileSync(join(dir, f), "utf8")]),
);
const out = [
  "// Generated from legal/*.md by scripts/legal-texts.mjs. Do not edit; edit the .md file.",
  `export const LEGAL_TEXTS = ${JSON.stringify(texts, null, 2)} as const;`,
  "",
].join("\n");
writeFileSync(join(process.cwd(), "lib/legal/generated-texts.ts"), out);
console.log(`legal texts: ${Object.keys(texts).join(", ")}`);
