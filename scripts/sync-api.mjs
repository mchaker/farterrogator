// Copies localtagger's API contract into api/openapi.json.
//   pnpm sync-api                       # from localtagger main
//   LOCALTAGGER_REF=v2.1.0 pnpm sync-api  # from a release tag
// Then `pnpm gen-api` (run by sync-api) regenerates api/schema.generated.ts.
import { writeFile } from 'node:fs/promises';

const ref = process.env.LOCALTAGGER_REF || 'main';
const url = `https://raw.githubusercontent.com/mchaker/localtagger/${ref}/openapi.json`;

const response = await fetch(url);
if (!response.ok) {
  console.error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const spec = await response.json();
await writeFile(new URL('../api/openapi.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n');
console.log(`api/openapi.json <- localtagger ${ref} (API version ${spec.info?.version})`);
