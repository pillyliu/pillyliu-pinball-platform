import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

// Compatibility module retained for website deploy/tests. Admin owns the
// immutable-object and cohort manifest implementation.
const WEBSITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_ROOT = path.resolve(
  process.env.PINPROF_ADMIN_SOURCE_ROOT ?? path.join(WEBSITE_ROOT, "..", "PinProf Admin")
);
const CANONICAL_MODULE = path.join(
  ADMIN_ROOT,
  "scripts",
  "publish",
  "build-pinball-manifest.mjs"
);

const canonical = await import(pathToFileURL(CANONICAL_MODULE).href);
export const buildPinballManifest = canonical.buildPinballManifest;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildPinballManifest()
    .then((summary) => {
      console.log(
        `Manifest updated: +${summary.addedCount} ~${summary.changedCount} -${summary.removedCount} (${summary.totalFiles} files)`
      );
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exit(1);
    });
}
