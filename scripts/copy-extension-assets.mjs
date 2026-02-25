import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const sourceDir = path.join(rootDir, "extension");
const outputDir = path.join(rootDir, "build", "extension");

const staticFiles = ["manifest.json", "options.html", "suspended.html"];
const optionalDirs = ["icons", "_locales"];

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

await fs.mkdir(outputDir, { recursive: true });

for (const fileName of staticFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  const destinationPath = path.join(outputDir, fileName);
  await fs.copyFile(sourcePath, destinationPath);
}

for (const dirName of optionalDirs) {
  const sourcePath = path.join(sourceDir, dirName);
  const destinationPath = path.join(outputDir, dirName);

  if (await exists(sourcePath)) {
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
  }
}

console.log("Copied extension static assets to build/extension");
