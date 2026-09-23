// Copy app/ to _site/ and stamp the service worker with a version and the
// list of files to precache. No dependencies.
//
//   node scripts/build.mjs            version = short git SHA or a timestamp
//   BUILD_VERSION=abc node scripts/build.mjs

import { cp, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const src = join(root, 'app');
const out = join(root, '_site');

function version() {
  if (process.env.BUILD_VERSION) return process.env.BUILD_VERSION;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const v = version();
await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });

const files = (await walk(out))
  .map((f) => relative(out, f).split(sep).join('/'))
  .filter((f) => f !== 'sw.js')
  .sort();

const swPath = join(out, 'sw.js');
let sw = await readFile(swPath, 'utf8');
if (!sw.includes('/* __PRECACHE__ */') || !sw.includes("'__BUILD__'")) {
  throw new Error('sw.js is missing its build placeholders');
}
sw = sw
  .replace('/* __PRECACHE__ */', files.map((f) => JSON.stringify('./' + f)).join(',\n  '))
  .replace("const VERSION = '__BUILD__';", `const VERSION = ${JSON.stringify(v)};`);
await writeFile(swPath, sw);

const verPath = join(out, 'js', 'version.js');
await writeFile(verPath, (await readFile(verPath, 'utf8')).replace("'__BUILD__'", JSON.stringify(v)));

// GitHub Pages: don't run Jekyll over the output.
await writeFile(join(out, '.nojekyll'), '');

let bytes = 0;
for (const f of files) bytes += (await stat(join(out, f))).size;
console.log(`Built _site/ version ${v}: ${files.length} files, ${(bytes / 1024).toFixed(0)} KB`);
