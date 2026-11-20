// VICE LEDGER 3 — hand-in program for the make.fun bounty
// gta6-trophy-guide-01.
//
// What ships is the static guide in app/: plain files, no build step, fully
// offline in the browser. This file's only job is delivery — gather app/
// and screenshots/ into the output folder and ask the vendored make.fun
// library to write the dossier the scorer reads. The vendor file stays
// untouched: the dossier has to come out byte-identical to the scorer's
// own rendering of it.
//
// Local run:  MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader the output folder defaults to /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const target = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The app tree is copied exactly as authored in the repository.
mkdirSync(target, { recursive: true });
cpSync(join(root, "app"), join(target, "app"), { recursive: true });

// Screenshots ride along beside the app. The destination folder is made
// first so a checkout missing the source folder cannot break the run.
const shotsTarget = join(target, "screenshots");
mkdirSync(shotsTarget, { recursive: true });
const shotsSource = join(root, "screenshots");
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

// Gate limits, mirrored locally so an oversized entry fails here first:
// no more than 4 screenshots, none over 256 KiB; app/ capped at 993
// entries and 48 MiB; dossier text capped at 160 KiB.
const dossier = buildDossier(target, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(target, "dossier.json"), dossier);
