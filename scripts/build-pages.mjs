// Builds the static demo into out/ (see "Demo on GitHub Pages" in the README).
// Set NEXT_PUBLIC_BASE_PATH (e.g. /Leakfix) to serve it from a sub-path.
import { spawnSync } from "node:child_process";
import { readdirSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";

const require = createRequire(import.meta.url);

const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "true" },
});
if (result.status !== 0) process.exit(result.status ?? 1);

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

// Next names prefetch segment files from OS paths, so on Windows they land in
// folders (__next.pricing/__PAGE__.txt) instead of __next.pricing.__PAGE__.txt
// and client-side navigation 404s. Flatten them to the names the browser asks for.
function flattenSegmentFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (!entry.name.startsWith("__next.")) {
      flattenSegmentFiles(path);
      continue;
    }
    for (const file of filesUnder(path)) {
      renameSync(file, join(dir, [entry.name, ...relative(path, file).split(sep)].join(".")));
    }
    rmSync(path, { recursive: true });
  }
}

if (process.platform === "win32") flattenSegmentFiles("out");
