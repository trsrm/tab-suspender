import { buildPortableConfig, parsePortableConfigJson, serializePortableConfig } from "../portable-config.js";
import { RECOVERY_SCHEMA_VERSION, RECOVERY_STORAGE_KEY, loadRecoveryFromStorage } from "../recovery-store.js";
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  loadSettingsFromStorage
} from "../settings-store.js";
import { resolveStorageArea, setItemsWithCompatibility } from "../storage-compat.js";
import type { PortableConfigV1, PortableImportResult } from "../types.js";
import type { OptionsElements } from "./dom.js";
import { setImportExportStatus } from "./dom.js";
import { optionsMessages } from "./messages.js";

type BusySetter = (busy: boolean) => void;
let stagedImport: (PortableImportResult & { ok: true }) | null = null;

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderImportPreview(elements: OptionsElements, result: PortableImportResult & { ok: true }): void {
  stagedImport = result;
  elements.importPreviewEl.hidden = false;
  elements.importPreviewSummaryEl.textContent = [
    `Schema v${result.preview.exportSchemaVersion}.`,
    `Generated at minute ${result.preview.generatedAtMinute}.`,
    `${formatCount(result.preview.counts.excludedHosts, "excluded host")}, ${formatCount(
      result.preview.counts.siteProfiles,
      "site profile"
    )}, ${formatCount(result.preview.counts.recoveryEntries, "recovery entry")}.`
  ].join(" ");

  const warnings: string[] = [];
  if (result.preview.ignoredInvalid.excludedHosts > 0) {
    warnings.push(
      `Ignored ${formatCount(result.preview.ignoredInvalid.excludedHosts, "invalid excluded host entry", "invalid excluded host entries")}.`
    );
  }
  if (result.preview.ignoredInvalid.siteProfiles > 0) {
    warnings.push(
      `Ignored ${formatCount(result.preview.ignoredInvalid.siteProfiles, "invalid site profile entry", "invalid site profile entries")}.`
    );
  }
  if (result.preview.ignoredInvalid.recoveryEntries > 0) {
    warnings.push(
      `Ignored ${formatCount(result.preview.ignoredInvalid.recoveryEntries, "invalid recovery entry", "invalid recovery entries")}.`
    );
  }

  elements.importPreviewWarningsEl.textContent = warnings.join(" ");
  elements.applyImportButton.disabled = false;
  elements.cancelImportButton.disabled = false;
}

function clearPreviewElements(elements: OptionsElements): void {
  elements.importPreviewEl.hidden = true;
  elements.importPreviewSummaryEl.textContent = "";
  elements.importPreviewWarningsEl.textContent = "";
  elements.applyImportButton.disabled = true;
  elements.cancelImportButton.disabled = true;
}

function buildExportFilename(now: Date): string {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  return `tab-suspender-config-${year}${month}${day}-${hours}${minutes}.json`;
}

function triggerJsonDownload(filename: string, content: string): void {
  const link = document.createElement("a");
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
  link.download = filename;
  link.click();
}

function getNowMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

async function readImportFileText(fileInput: HTMLInputElement): Promise<string | null> {
  const files = fileInput.files;
  if (!files || files.length === 0) {
    return null;
  }

  const selectedFile = files[0] as { text?: () => Promise<string> };
  if (selectedFile && typeof selectedFile.text === "function") {
    return selectedFile.text();
  }

  return null;
}

async function applyPortableImport(portableConfig: PortableConfigV1): Promise<void> {
  const storageArea = resolveStorageArea(null);

  if (!storageArea) {
    throw new Error("Storage API unavailable.");
  }

  await setItemsWithCompatibility(storageArea, {
    [SETTINGS_STORAGE_KEY]: {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      settings: portableConfig.settings
    },
    [RECOVERY_STORAGE_KEY]: {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      entries: portableConfig.recoveryState.entries
    }
  });
}

export function hasStagedImport(): boolean {
  return stagedImport !== null;
}

export function clearStagedImport(elements: OptionsElements): void {
  stagedImport = null;
  clearPreviewElements(elements);
  elements.importFileInput.value = "";
}

export async function handleExportConfiguration(elements: OptionsElements, setBusy: BusySetter): Promise<void> {
  setImportExportStatus(elements, optionsMessages.importExportStatus.exportPending);
  setBusy(true);

  try {
    const [settings, recoveryEntries] = await Promise.all([loadSettingsFromStorage(), loadRecoveryFromStorage()]);
    const portableConfig = buildPortableConfig(settings, recoveryEntries, getNowMinute());
    const content = serializePortableConfig(portableConfig);
    triggerJsonDownload(buildExportFilename(new Date()), content);
    setImportExportStatus(elements, optionsMessages.importExportStatus.exportReady);
  } catch {
    setImportExportStatus(elements, optionsMessages.importExportStatus.exportFailed);
  } finally {
    setBusy(false);
  }
}

export async function handleImportConfiguration(elements: OptionsElements, setBusy: BusySetter): Promise<void> {
  setImportExportStatus(elements, optionsMessages.importExportStatus.importLoading);
  setBusy(true);

  try {
    const fileText = await readImportFileText(elements.importFileInput);

    if (fileText === null) {
      setImportExportStatus(elements, optionsMessages.importExportStatus.noFileSelected);
      return;
    }

    const importResult = await parsePortableConfigJson(fileText);

    if (!importResult.ok) {
      clearStagedImport(elements);
      setImportExportStatus(elements, `${optionsMessages.importExportStatus.importInvalid} ${importResult.message}`);
      return;
    }

    renderImportPreview(elements, importResult);
    setImportExportStatus(elements, optionsMessages.importExportStatus.importPreviewReady);
  } catch {
    clearStagedImport(elements);
    setImportExportStatus(elements, optionsMessages.importExportStatus.importInvalid);
  } finally {
    setBusy(false);
  }
}

export async function handleApplyImport(
  elements: OptionsElements,
  setBusy: BusySetter,
  onApplied: (config: PortableConfigV1) => void
): Promise<void> {
  if (!stagedImport) {
    setImportExportStatus(elements, optionsMessages.importExportStatus.noFileSelected);
    return;
  }

  setImportExportStatus(elements, optionsMessages.importExportStatus.importApplyPending);
  setBusy(true);

  try {
    await applyPortableImport(stagedImport.config);
    onApplied(stagedImport.config);
    clearStagedImport(elements);
    setImportExportStatus(elements, optionsMessages.importExportStatus.importApplied);
  } catch {
    setImportExportStatus(elements, optionsMessages.importExportStatus.importApplyFailed);
  } finally {
    setBusy(false);
  }
}

export function handleCancelImport(elements: OptionsElements): void {
  clearStagedImport(elements);
  setImportExportStatus(elements, optionsMessages.importExportStatus.importCanceled);
}
