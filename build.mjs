// build.mjs — pack install.mjs + every payload file (global/, skills/, templates/) into
// dist/claude-goat.mjs: one self-contained portable file. Drop it anywhere and run
// `node claude-goat.mjs` (or `./claude-goat.mjs` — it's executable) from a project's root.
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist", "claude-goat.mjs");

const files = {};
async function collect(dir) {
  for (const d of await readdir(join(here, dir), { withFileTypes: true, recursive: true })) {
    if (!d.isFile()) continue;
    const abs = join(d.parentPath, d.name);
    const buf = await readFile(abs);
    if (buf.includes(0)) {
      console.error(`✗ ${abs} looks binary — the packer only embeds text files`);
      process.exit(1);
    }
    // keys always use forward slashes, whatever the build platform
    files[relative(here, abs).split(sep).join("/")] = buf.toString("utf8");
  }
}
await collect("global");
await collect("skills");
await collect("templates");

const payload = gzipSync(JSON.stringify(files), { level: 9 }).toString("base64");

const marker = "const EMBEDDED = null; // ← build.mjs replaces this line with the packed payload";
const source = await readFile(join(here, "install.mjs"), "utf8");
if (!source.includes(marker)) {
  console.error("✗ marker line not found in install.mjs — did it get edited away?");
  process.exit(1);
}
const packed =
  "#!/usr/bin/env node\n" +
  source.replace(marker, `const EMBEDDED = ${JSON.stringify(payload)};`);

await mkdir(join(here, "dist"), { recursive: true });
await writeFile(out, packed);
await chmod(out, 0o755);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✓ ${Object.keys(files).length} files packed → ${out} (${kb(packed.length)})`);
