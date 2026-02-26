import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const buildExtensionDir = path.join(rootDir, "build", "extension");
const manifestPath = path.join(buildExtensionDir, "manifest.json");
const wrapperResourcesDir = path.join(
  rootDir,
  "safari-wrapper",
  "TabSuspenderExtension",
  "Resources"
);

async function ensurePathExists(targetPath, hint) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`${hint}: ${targetPath}`);
  }
}

async function readManifestVersion(targetPath) {
  let manifestRaw;
  try {
    manifestRaw = await fs.readFile(targetPath, "utf8");
  } catch {
    throw new Error(`Unable to read manifest file: ${targetPath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    throw new Error(`Invalid JSON in manifest file: ${targetPath}`);
  }

  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error(`Manifest is missing a valid version string: ${targetPath}`);
  }

  return manifest.version;
}

async function syncWrapperResources() {
  await ensurePathExists(
    buildExtensionDir,
    "Build artifacts not found. Run npm run build first"
  );
  await ensurePathExists(
    manifestPath,
    "Manifest not found in build artifacts. Run npm run build first"
  );

  const manifestVersion = await readManifestVersion(manifestPath);

  await fs.mkdir(wrapperResourcesDir, { recursive: true });

  const existingEntries = await fs.readdir(wrapperResourcesDir, { withFileTypes: true });
  for (const entry of existingEntries) {
    if (entry.name === ".gitignore" || entry.name === ".gitkeep") {
      continue;
    }

    await fs.rm(path.join(wrapperResourcesDir, entry.name), {
      recursive: true,
      force: true
    });
  }

  const sourceEntries = await fs.readdir(buildExtensionDir, { withFileTypes: true });
  for (const entry of sourceEntries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const sourcePath = path.join(buildExtensionDir, entry.name);
    const destinationPath = path.join(wrapperResourcesDir, entry.name);
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
  }

  console.log(
    `Synced build/extension -> safari-wrapper/TabSuspenderExtension/Resources (manifest version ${manifestVersion})`
  );
}

syncWrapperResources().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
