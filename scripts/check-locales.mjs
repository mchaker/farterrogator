// Fails if any locale file's key set differs from en.json (see AGENTS.md).
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../i18n/locales/', import.meta.url);
const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const load = (file) => new Set(keys(JSON.parse(readFileSync(new URL(file, dir), 'utf8'))));

const en = load('en.json');
let failed = false;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const other = load(file);
  const missing = [...en].filter((k) => !other.has(k));
  const extra = [...other].filter((k) => !en.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${file}: missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`);
  }
}
if (failed) process.exit(1);
console.log(`Locale key parity OK (${en.size} keys).`);
