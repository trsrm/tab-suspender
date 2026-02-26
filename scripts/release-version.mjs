import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const packageJsonPath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "extension", "manifest.json");
const pbxprojPath = path.join(
  rootDir,
  "safari-wrapper",
  "TabSuspenderWrapper.xcodeproj",
  "project.pbxproj"
);

const versionPattern = /^\d+\.\d+\.\d+$/;

function parseArgs(argv) {
  const args = [...argv];

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    return { help: true };
  }

  const version = args[0];
  let dryRun = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { version, dryRun, help: false };
}

function validateVersion(version) {
  if (!versionPattern.test(version)) {
    throw new Error(`Invalid version: ${version}. Expected format: x.y.z (for example 0.1.1)`);
  }
}

function computeNextBuildNumber(content) {
  const matches = [...content.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) =>
    Number(m[1])
  );

  if (matches.length === 0) {
    throw new Error("No CURRENT_PROJECT_VERSION entries found in project.pbxproj");
  }

  return Math.max(...matches) + 1;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data, dryRun) {
  if (dryRun) {
    return;
  }
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updatePbxproj(content, version, buildNumber) {
  const marketingMatches = content.match(/MARKETING_VERSION = .*?;/g) ?? [];
  const buildMatches = content.match(/CURRENT_PROJECT_VERSION = \d+;/g) ?? [];

  if (marketingMatches.length === 0) {
    throw new Error("No MARKETING_VERSION entries found in project.pbxproj");
  }
  if (buildMatches.length === 0) {
    throw new Error("No CURRENT_PROJECT_VERSION entries found in project.pbxproj");
  }

  const next = content
    .replace(/MARKETING_VERSION = .*?;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);

  return {
    content: next,
    marketingCount: marketingMatches.length,
    buildCount: buildMatches.length
  };
}

async function main() {
  const { help, version, dryRun } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      "Usage: npm run release:version -- <x.y.z> [--dry-run]\\n" +
        "Examples:\\n" +
        "  npm run release:version -- 0.1.1\\n" +
        "  npm run release:version -- 0.2.0 --dry-run"
    );
    return;
  }

  validateVersion(version);

  const [pkg, manifest, pbxprojContent] = await Promise.all([
    readJson(packageJsonPath),
    readJson(manifestPath),
    fs.readFile(pbxprojPath, "utf8")
  ]);

  const nextBuildNumber = computeNextBuildNumber(pbxprojContent);
  const updatedPbxproj = updatePbxproj(pbxprojContent, version, nextBuildNumber);

  pkg.version = version;
  manifest.version = version;

  if (!dryRun) {
    await Promise.all([
      writeJson(packageJsonPath, pkg, false),
      writeJson(manifestPath, manifest, false),
      fs.writeFile(pbxprojPath, updatedPbxproj.content, "utf8")
    ]);
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Updated release version to ${version} (build ${nextBuildNumber})`
  );
  console.log(
    `${dryRun ? "Would update" : "Updated"} package.json, extension/manifest.json, and ${updatedPbxproj.marketingCount} MARKETING_VERSION + ${updatedPbxproj.buildCount} CURRENT_PROJECT_VERSION entries in project.pbxproj`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
