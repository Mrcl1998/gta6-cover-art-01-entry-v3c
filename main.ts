/* Night Drive Cover Studio — make.fun entry program (Node 22, stdlib only).
 * Copies app/ and screenshots/ into $MAKEFUN_OUTPUT_DIR (default /output),
 * makes every output file readable by any user, then writes dossier.json
 * with the kit's buildDossier. Written fresh for gta6-cover-art-01 v3c.
 *
 * Safety rules the grader enforces:
 * - Only the CONTENTS of the output dir are emptied, never the dir itself
 *   (/output is a bind mount; / is read-only).
 * - A copied read-only child gets a write bit before it is removed.
 * - Every output file ends up 0o644 and every output dir 0o755, because
 *   the grader reads /output as a different user.
 */

import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Add the owner write bit to a path and everything under it, so removal works. */
function addWriteBit(path: string): void {
  const st = lstatSync(path);
  const mode = st.mode | 0o200;
  chmodSync(path, mode);
  if (st.isDirectory()) {
    for (const child of readdirSync(path)) addWriteBit(join(path, child));
  }
}

/** Empty a directory's contents without removing the directory itself. */
function emptyDirContents(dir: string): void {
  for (const child of readdirSync(dir)) {
    const path = join(dir, child);
    addWriteBit(path);
    rmSync(path, { recursive: true, force: true });
  }
}

/** chmod every file 0o644 and every directory 0o755 under dir (dir itself too). */
function makeReadable(dir: string): void {
  const st = lstatSync(dir);
  if (st.isDirectory()) {
    chmodSync(dir, 0o755);
    for (const child of readdirSync(dir)) makeReadable(join(dir, child));
  } else {
    chmodSync(dir, 0o644);
  }
}

function main(): void {
  const appDir = join(REPO_ROOT, 'app');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(appDir)) throw new Error('app/ is missing from the repository');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing from the repository');

  mkdirSync(OUT_DIR, { recursive: true });
  emptyDirContents(OUT_DIR);

  cpSync(appDir, join(OUT_DIR, 'app'), { recursive: true });
  cpSync(shotsDir, join(OUT_DIR, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUT_DIR, DOSSIER_CAPS);
  const dossierPath = join(OUT_DIR, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  chmodSync(dossierPath, 0o644);

  makeReadable(join(OUT_DIR, 'app'));
  makeReadable(join(OUT_DIR, 'screenshots'));
  chmodSync(OUT_DIR, 0o755);

  console.log(`Wrote ${OUT_DIR}/dossier.json (${dossier.length} bytes)`);
}

main();
