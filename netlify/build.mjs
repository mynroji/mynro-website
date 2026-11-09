import {cp, mkdir, readdir} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('public-build/', root);
const excluded = new Set(['netlify', 'netlify.toml', 'public-build', 'README.md', 'node_modules']);
await mkdir(output, {recursive:true});
for (const item of await readdir(root)) {
  if (item.startsWith('.') || excluded.has(item)) continue;
  await cp(new URL(encodeURIComponent(item), root), new URL(encodeURIComponent(item), output), {recursive:true});
}
