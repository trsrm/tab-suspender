import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SCHEMA_VERSION,
  MAX_IDLE_HOURS,
  MAX_EXCLUDED_HOST_LENGTH,
  MAX_EXCLUDED_HOSTS,
  MAX_SITE_PROFILES,
  MAX_SITE_PROFILE_HOST_LENGTH,
  MIN_IDLE_HOURS,
  loadSettingsFromStorage,
  saveSettingsToStorage
} from "./settings-store.js";
import { normalizeExcludedHostEntries, normalizeSiteProfileHostRule } from "./matcher.js";
import type { PortableConfigV1, PortableImportResult, Settings, SiteProfile } from "./types.js";
import { RECOVERY_SCHEMA_VERSION, RECOVERY_STORAGE_KEY, loadRecoveryFromStorage } from "./recovery-store.js";
import { formatCapturedAtMinuteUtc } from "./time-format.js";
import { validateRestorableUrl } from "./url-safety.js";
import { buildPortableConfig, parsePortableConfigJson, serializePortableConfig } from "./portable-config.js";
import { resolveStorageArea, setItemsWithCompatibility } from "./storage-compat.js";

export {};

const RECOVERY_DEFAULT_TITLE = "Untitled tab";
let siteProfileIdCounter = 0;

const optionsMessages = {
  settingsStatus: {
    loading: "Loading settings...",
    loaded: "Settings loaded.",
    loadFailedDefaults: "Failed to load settings. Using defaults.",
    savePending: "Saving settings...",
    saved: "Settings saved.",
    saveFailed: "Failed to save settings.",
    validationFailed: "Settings were not saved."
  },
  importExportStatus: {
    importLoading: "Reading configuration file...",
    importInvalid: "Failed to import configuration.",
    importPreviewReady: "Configuration ready to import.",
    importApplyPending: "Applying imported configuration...",
    importApplied: "Imported configuration applied.",
    importApplyFailed: "Failed to apply imported configuration.",
    importCanceled: "Import canceled.",
    exportPending: "Preparing configuration export...",
    exportReady: "Export started.",
    exportFailed: "Failed to export configuration.",
    noFileSelected: "Choose a configuration file to import first."
  },
  recoveryStatus: {
    reopenOk: "Reopened suspended tab in a new tab.",
    reopenFailed: "Failed to reopen suspended tab."
  },
  recoveryEmpty: {
    none: "No recently suspended tabs yet.",
    loadFailed: "Failed to load recently suspended tabs."
  },
  recoveryAction: {
    reopenButton: "Reopen",
    invalidRestoreUrlTitle: "URL is no longer eligible for restore."
  },
  siteProfiles: {
    hostLabel: "Host rule",
    idleHoursLabel: "Idle override (hours)",
    skipPinnedLabel: "Skip pinned",
    skipAudibleLabel: "Skip audible",
    excludeFromSuspendLabel: "Exclude from suspend",
    deleteButton: "Delete"
  },
  validation: {
    idleHoursOutOfRange: `Enter a whole number from ${MIN_IDLE_HOURS} to ${MAX_IDLE_HOURS}.`
  }
} as const;

type OptionsElements = {
  form: HTMLFormElement;
  idleHoursInput: HTMLInputElement;
  idleHoursError: HTMLElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludedHostsInput: HTMLTextAreaElement;
  siteProfilesList: HTMLElement;
  addSiteProfileButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  settingsStatusEl: HTMLElement;
  recoveryStatusEl: HTMLElement;
  recoveryList: HTMLElement;
  recoveryEmpty: HTMLElement;
  importExportStatusEl: HTMLElement;
  importPreviewEl: HTMLElement;
  importPreviewSummaryEl: HTMLElement;
  importPreviewWarningsEl: HTMLElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  importFileInput: HTMLInputElement;
  applyImportButton: HTMLButtonElement;
  cancelImportButton: HTMLButtonElement;
};

type SiteProfileRowElements = {
  id: string;
  root: HTMLElement;
  hostRuleInput: HTMLInputElement;
  idleHoursInput: HTMLInputElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludeFromSuspendInput: HTMLInputElement;
  deleteButton: HTMLButtonElement;
};

const siteProfileRowsByList = new WeakMap<HTMLElement, SiteProfileRowElements[]>();
const stagedImportByForm = new WeakMap<HTMLFormElement, PortableImportResult & { ok: true }>();

function getOptionsElements(): OptionsElements | null {
  const form = document.getElementById("settingsForm");
  const idleHoursInput = document.getElementById("idleHours");
  const idleHoursError = document.getElementById("idleHoursError");
  const skipPinnedInput = document.getElementById("skipPinned");
  const skipAudibleInput = document.getElementById("skipAudible");
  const excludedHostsInput = document.getElementById("excludedHosts");
  const siteProfilesList = document.getElementById("siteProfiles");
  const addSiteProfileButton = document.getElementById("addSiteProfileButton");
  const saveButton = document.getElementById("saveButton");
  const settingsStatusEl = document.getElementById("status");
  const recoveryStatusEl = document.getElementById("recoveryStatus");
  const recoveryList = document.getElementById("recoveryList");
  const recoveryEmpty = document.getElementById("recoveryEmpty");
  const importExportStatusEl = document.getElementById("importExportStatus");
  const importPreviewEl = document.getElementById("importPreview");
  const importPreviewSummaryEl = document.getElementById("importPreviewSummary");
  const importPreviewWarningsEl = document.getElementById("importPreviewWarnings");
  const exportButton = document.getElementById("exportConfigButton");
  const importButton = document.getElementById("importConfigButton");
  const importFileInput = document.getElementById("importConfigFile");
  const applyImportButton = document.getElementById("applyImportButton");
  const cancelImportButton = document.getElementById("cancelImportButton");

  if (
    !form ||
    !idleHoursInput ||
    !idleHoursError ||
    !skipPinnedInput ||
    !skipAudibleInput ||
    !excludedHostsInput ||
    !siteProfilesList ||
    !addSiteProfileButton ||
    !saveButton ||
    !settingsStatusEl ||
    !recoveryStatusEl ||
    !recoveryList ||
    !recoveryEmpty ||
    !importExportStatusEl ||
    !importPreviewEl ||
    !importPreviewSummaryEl ||
    !importPreviewWarningsEl ||
    !exportButton ||
    !importButton ||
    !importFileInput ||
    !applyImportButton ||
    !cancelImportButton
  ) {
    return null;
  }

  return {
    form: form as HTMLFormElement,
    idleHoursInput: idleHoursInput as HTMLInputElement,
    idleHoursError: idleHoursError as HTMLElement,
    skipPinnedInput: skipPinnedInput as HTMLInputElement,
    skipAudibleInput: skipAudibleInput as HTMLInputElement,
    excludedHostsInput: excludedHostsInput as HTMLTextAreaElement,
    siteProfilesList: siteProfilesList as HTMLElement,
    addSiteProfileButton: addSiteProfileButton as HTMLButtonElement,
    saveButton: saveButton as HTMLButtonElement,
    settingsStatusEl: settingsStatusEl as HTMLElement,
    recoveryStatusEl: recoveryStatusEl as HTMLElement,
    recoveryList: recoveryList as HTMLElement,
    recoveryEmpty: recoveryEmpty as HTMLElement,
    importExportStatusEl: importExportStatusEl as HTMLElement,
    importPreviewEl: importPreviewEl as HTMLElement,
    importPreviewSummaryEl: importPreviewSummaryEl as HTMLElement,
    importPreviewWarningsEl: importPreviewWarningsEl as HTMLElement,
    exportButton: exportButton as HTMLButtonElement,
    importButton: importButton as HTMLButtonElement,
    importFileInput: importFileInput as HTMLInputElement,
    applyImportButton: applyImportButton as HTMLButtonElement,
    cancelImportButton: cancelImportButton as HTMLButtonElement
  };
}

function setSettingsStatus(elements: OptionsElements, message: string): void {
  elements.settingsStatusEl.textContent = message;
}

function setRecoveryStatus(elements: OptionsElements, message: string): void {
  elements.recoveryStatusEl.textContent = message;
}

function setImportExportStatus(elements: OptionsElements, message: string): void {
  elements.importExportStatusEl.textContent = message;
}

function setBusy(elements: OptionsElements, busy: boolean): void {
  elements.idleHoursInput.disabled = busy;
  elements.skipPinnedInput.disabled = busy;
  elements.skipAudibleInput.disabled = busy;
  elements.excludedHostsInput.disabled = busy;
  elements.addSiteProfileButton.disabled = busy;
  elements.saveButton.disabled = busy;
  elements.exportButton.disabled = busy;
  elements.importButton.disabled = busy;
  elements.importFileInput.disabled = busy;
  elements.applyImportButton.disabled = busy || !stagedImportByForm.has(elements.form);
  elements.cancelImportButton.disabled = busy || !stagedImportByForm.has(elements.form);

  const rows = siteProfileRowsByList.get(elements.siteProfilesList) ?? [];
  for (const row of rows) {
    row.hostRuleInput.disabled = busy;
    row.idleHoursInput.disabled = busy;
    row.skipPinnedInput.disabled = busy;
    row.skipAudibleInput.disabled = busy;
    row.excludeFromSuspendInput.disabled = busy;
    row.deleteButton.disabled = busy;
  }
}

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function clearStagedImport(elements: OptionsElements): void {
  stagedImportByForm.delete(elements.form);
  elements.importPreviewEl.hidden = true;
  elements.importPreviewSummaryEl.textContent = "";
  elements.importPreviewWarningsEl.textContent = "";
  elements.applyImportButton.disabled = true;
  elements.cancelImportButton.disabled = true;
  elements.importFileInput.value = "";
}

function renderImportPreview(elements: OptionsElements, result: PortableImportResult & { ok: true }): void {
  stagedImportByForm.set(elements.form, result);
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

function clearIdleHoursError(elements: OptionsElements): void {
  elements.idleHoursError.hidden = true;
  elements.idleHoursError.textContent = "";
  elements.idleHoursInput.setAttribute("aria-invalid", "false");
}

function setIdleHoursError(elements: OptionsElements, message: string): void {
  elements.idleHoursError.hidden = false;
  elements.idleHoursError.textContent = message;
  elements.idleHoursInput.setAttribute("aria-invalid", "true");
}

function getSavedWithIgnoredEntriesMessage(
  ignoredInvalidExcludedHostCount: number,
  ignoredInvalidSiteProfileCount: number
): string {
  const parts: string[] = [];

  if (ignoredInvalidExcludedHostCount > 0) {
    const excludedSuffix = ignoredInvalidExcludedHostCount === 1 ? "entry" : "entries";
    parts.push(`Ignored ${ignoredInvalidExcludedHostCount} invalid excluded host ${excludedSuffix}`);
  }

  if (ignoredInvalidSiteProfileCount > 0) {
    const profileSuffix = ignoredInvalidSiteProfileCount === 1 ? "entry" : "entries";
    parts.push(`Ignored ${ignoredInvalidSiteProfileCount} invalid site profile ${profileSuffix}`);
  }

  if (parts.length === 0) {
    return optionsMessages.settingsStatus.saved;
  }

  return `Settings saved. ${parts.join(". ")}.`;
}

function parseIdleHours(rawValue: string): number | null {
  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < MIN_IDLE_HOURS || parsed > MAX_IDLE_HOURS) {
    return null;
  }

  return parsed;
}

function generateSiteProfileId(): string {
  siteProfileIdCounter += 1;
  return `sp-${Date.now().toString(36)}-${siteProfileIdCounter.toString(36)}`;
}

function removeSiteProfileRow(list: HTMLElement, rowId: string): void {
  const rows = siteProfileRowsByList.get(list) ?? [];
  const nextRows = rows.filter((row) => row.id !== rowId);
  siteProfileRowsByList.set(list, nextRows);

  const remainingNodes = nextRows.map((row) => row.root);
  list.replaceChildren(...remainingNodes);
}

function createLabeledInput(labelText: string, input: HTMLInputElement): HTMLElement {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(input);

  return field;
}

function createCheckbox(labelText: string, input: HTMLInputElement): HTMLElement {
  const label = document.createElement("label");
  label.className = "checkbox";
  label.appendChild(input);
  const text = document.createElement("span");
  text.textContent = labelText;
  label.appendChild(text);
  return label;
}

function createSiteProfileRow(list: HTMLElement, profile?: SiteProfile): SiteProfileRowElements {
  const row = document.createElement("li");
  row.className = "site-profile-item";

  const hostRuleInput = document.createElement("input");
  hostRuleInput.type = "text";
  hostRuleInput.value = profile?.hostRule ?? "";

  const idleHoursInput = document.createElement("input");
  idleHoursInput.type = "number";
  idleHoursInput.min = String(MIN_IDLE_HOURS);
  idleHoursInput.max = String(MAX_IDLE_HOURS);
  idleHoursInput.inputMode = "numeric";
  idleHoursInput.value =
    typeof profile?.overrides.idleMinutes === "number"
      ? String(Math.max(MIN_IDLE_HOURS, Math.floor(profile.overrides.idleMinutes / 60)))
      : "";

  const grid = document.createElement("div");
  grid.className = "site-profile-grid";
  grid.appendChild(createLabeledInput(optionsMessages.siteProfiles.hostLabel, hostRuleInput));
  grid.appendChild(createLabeledInput(optionsMessages.siteProfiles.idleHoursLabel, idleHoursInput));

  const skipPinnedInput = document.createElement("input");
  skipPinnedInput.type = "checkbox";
  skipPinnedInput.checked = profile?.overrides.skipPinned ?? false;

  const skipAudibleInput = document.createElement("input");
  skipAudibleInput.type = "checkbox";
  skipAudibleInput.checked = profile?.overrides.skipAudible ?? false;

  const excludeFromSuspendInput = document.createElement("input");
  excludeFromSuspendInput.type = "checkbox";
  excludeFromSuspendInput.checked = profile?.overrides.excludeFromSuspend ?? false;

  const toggles = document.createElement("div");
  toggles.className = "field";
  toggles.appendChild(createCheckbox(optionsMessages.siteProfiles.skipPinnedLabel, skipPinnedInput));
  toggles.appendChild(createCheckbox(optionsMessages.siteProfiles.skipAudibleLabel, skipAudibleInput));
  toggles.appendChild(createCheckbox(optionsMessages.siteProfiles.excludeFromSuspendLabel, excludeFromSuspendInput));

  const actions = document.createElement("div");
  actions.className = "site-profile-actions";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "site-profile-delete";
  deleteButton.textContent = optionsMessages.siteProfiles.deleteButton;
  actions.appendChild(deleteButton);

  row.appendChild(grid);
  row.appendChild(toggles);
  row.appendChild(actions);

  const rowElements: SiteProfileRowElements = {
    id: profile?.id ?? generateSiteProfileId(),
    root: row,
    hostRuleInput,
    idleHoursInput,
    skipPinnedInput,
    skipAudibleInput,
    excludeFromSuspendInput,
    deleteButton
  };

  deleteButton.addEventListener("click", () => {
    removeSiteProfileRow(list, rowElements.id);
  });

  return rowElements;
}

function renderSiteProfiles(list: HTMLElement, profiles: SiteProfile[]): void {
  const rows = profiles.slice(0, MAX_SITE_PROFILES).map((profile) => createSiteProfileRow(list, profile));
  siteProfileRowsByList.set(list, rows);
  list.replaceChildren(...rows.map((row) => row.root));
}

function appendNewSiteProfileRow(list: HTMLElement): void {
  const rows = siteProfileRowsByList.get(list) ?? [];

  if (rows.length >= MAX_SITE_PROFILES) {
    return;
  }

  const next = [...rows, createSiteProfileRow(list)];
  siteProfileRowsByList.set(list, next);
  list.replaceChildren(...next.map((row) => row.root));
}

function readSiteProfilesFromInputs(list: HTMLElement): {
  profiles: SiteProfile[];
  ignoredInvalidCount: number;
} {
  const rows = siteProfileRowsByList.get(list) ?? [];
  const profiles: SiteProfile[] = [];
  let ignoredInvalidCount = 0;

  for (const row of rows) {
    const normalizedHostRule = normalizeSiteProfileHostRule(row.hostRuleInput.value, MAX_SITE_PROFILE_HOST_LENGTH);

    if (!normalizedHostRule) {
      ignoredInvalidCount += 1;
      continue;
    }

    const idleHoursRaw = row.idleHoursInput.value.trim();
    const parsedIdleHours = idleHoursRaw.length > 0 ? parseIdleHours(idleHoursRaw) : null;

    if (idleHoursRaw.length > 0 && parsedIdleHours === null) {
      ignoredInvalidCount += 1;
      continue;
    }

    profiles.push({
      id: row.id,
      hostRule: normalizedHostRule,
      overrides: {
        idleMinutes: parsedIdleHours === null ? undefined : parsedIdleHours * 60,
        skipPinned: row.skipPinnedInput.checked,
        skipAudible: row.skipAudibleInput.checked,
        excludeFromSuspend: row.excludeFromSuspendInput.checked
      }
    });

    if (profiles.length >= MAX_SITE_PROFILES) {
      break;
    }
  }

  return {
    profiles,
    ignoredInvalidCount
  };
}

function renderSettings(elements: OptionsElements, settings: Settings): void {
  elements.idleHoursInput.value = String(Math.max(MIN_IDLE_HOURS, Math.floor(settings.idleMinutes / 60)));
  elements.skipPinnedInput.checked = settings.skipPinned;
  elements.skipAudibleInput.checked = settings.skipAudible;
  elements.excludedHostsInput.value = settings.excludedHosts.join("\n");
  renderSiteProfiles(elements.siteProfilesList, settings.siteProfiles);
}

type RecoveryItem = {
  url: string;
  title: string;
  suspendedAtMinute: number;
};

const recoveryRowsByList = new WeakMap<HTMLElement, Map<string, HTMLElement>>();

function getRecoveryTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : RECOVERY_DEFAULT_TITLE;
}

function setRecoveryEmpty(elements: OptionsElements, message: string, hidden: boolean): void {
  elements.recoveryEmpty.textContent = message;
  elements.recoveryEmpty.hidden = hidden;
}

function createTabWithCompatibility(url: string): Promise<void> {
  const tabsApi = chrome?.tabs;

  if (!tabsApi || typeof tabsApi.create !== "function") {
    return Promise.reject(new Error("Tabs API unavailable."));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const callback = (): void => {
      if (settled) {
        return;
      }

      const runtimeLastError = chrome?.runtime?.lastError;

      if (runtimeLastError?.message) {
        rejectOnce(new Error(runtimeLastError.message));
        return;
      }

      resolveOnce();
    };

    try {
      const maybePromise = tabsApi.create({ url }, callback) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(() => resolveOnce()).catch((error: unknown) => rejectOnce(error));
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

function createRecoveryRow(elements: OptionsElements, entry: RecoveryItem): HTMLElement {
  const row = document.createElement("li");
  row.className = "recovery-item";

  const details = document.createElement("div");
  details.className = "recovery-item-details";

  const title = document.createElement("p");
  title.className = "recovery-item-title";
  title.textContent = getRecoveryTitle(entry.title);
  details.appendChild(title);

  const urlEl = document.createElement("p");
  urlEl.className = "recovery-item-url";
  urlEl.textContent = entry.url;
  urlEl.title = entry.url;
  details.appendChild(urlEl);

  const capturedAt = document.createElement("p");
  capturedAt.className = "recovery-item-captured";
  capturedAt.textContent = formatCapturedAtMinuteUtc(entry.suspendedAtMinute);
  details.appendChild(capturedAt);

  const reopenButton = document.createElement("button");
  reopenButton.type = "button";
  reopenButton.textContent = optionsMessages.recoveryAction.reopenButton;

  const validation = validateRestorableUrl(entry.url);
  if (!validation.ok) {
    reopenButton.disabled = true;
    reopenButton.title = optionsMessages.recoveryAction.invalidRestoreUrlTitle;
  } else {
    reopenButton.addEventListener("click", () => {
      reopenButton.disabled = true;
      void createTabWithCompatibility(validation.url)
        .then(() => {
          setRecoveryStatus(elements, optionsMessages.recoveryStatus.reopenOk);
        })
        .catch(() => {
          setRecoveryStatus(elements, optionsMessages.recoveryStatus.reopenFailed);
          reopenButton.disabled = false;
        });
    });
  }

  row.appendChild(details);
  row.appendChild(reopenButton);
  return row;
}

function buildRecoveryEntryKey(entry: RecoveryItem, duplicateOrdinal: number): string {
  return `${entry.url}\n${entry.title}\n${entry.suspendedAtMinute}\n${duplicateOrdinal}`;
}

function renderRecoveryList(elements: OptionsElements, entries: RecoveryItem[]): void {
  if (entries.length === 0) {
    elements.recoveryList.replaceChildren();
    recoveryRowsByList.set(elements.recoveryList, new Map<string, HTMLElement>());
    setRecoveryEmpty(elements, optionsMessages.recoveryEmpty.none, false);
    return;
  }

  const previousRowsByKey = recoveryRowsByList.get(elements.recoveryList) ?? new Map<string, HTMLElement>();
  const nextRowsByKey = new Map<string, HTMLElement>();
  const duplicateCounts = new Map<string, number>();
  const rows: HTMLElement[] = [];

  for (const entry of entries) {
    const baseKey = `${entry.url}\n${entry.title}\n${entry.suspendedAtMinute}`;
    const duplicateOrdinal = duplicateCounts.get(baseKey) ?? 0;
    duplicateCounts.set(baseKey, duplicateOrdinal + 1);
    const key = buildRecoveryEntryKey(entry, duplicateOrdinal);
    const existingRow = previousRowsByKey.get(key);
    const row = existingRow ?? createRecoveryRow(elements, entry);

    nextRowsByKey.set(key, row);
    rows.push(row);
  }

  elements.recoveryList.replaceChildren(...rows);
  recoveryRowsByList.set(elements.recoveryList, nextRowsByKey);
  setRecoveryEmpty(elements, "", true);
}

async function loadAndRenderRecovery(elements: OptionsElements): Promise<void> {
  try {
    const recoveryEntries = await loadRecoveryFromStorage();
    renderRecoveryList(elements, recoveryEntries);
  } catch {
    elements.recoveryList.replaceChildren();
    setRecoveryEmpty(elements, optionsMessages.recoveryEmpty.loadFailed, false);
  }
}

async function loadAndRenderSettings(elements: OptionsElements): Promise<void> {
  setSettingsStatus(elements, optionsMessages.settingsStatus.loading);
  setBusy(elements, true);
  clearIdleHoursError(elements);

  try {
    const settings = await loadSettingsFromStorage();
    renderSettings(elements, settings);
    setSettingsStatus(elements, optionsMessages.settingsStatus.loaded);
  } catch {
    renderSettings(elements, DEFAULT_SETTINGS);
    setSettingsStatus(elements, optionsMessages.settingsStatus.loadFailedDefaults);
  } finally {
    setBusy(elements, false);
  }
}

async function handleSave(elements: OptionsElements): Promise<void> {
  clearIdleHoursError(elements);

  const parsedIdleHours = parseIdleHours(elements.idleHoursInput.value);

  if (parsedIdleHours === null) {
    setIdleHoursError(elements, optionsMessages.validation.idleHoursOutOfRange);
    setSettingsStatus(elements, optionsMessages.settingsStatus.validationFailed);
    return;
  }

  setBusy(elements, true);
  setSettingsStatus(elements, optionsMessages.settingsStatus.savePending);

  const normalizedExcludedHosts = normalizeExcludedHostEntries(elements.excludedHostsInput.value, {
    maxEntries: MAX_EXCLUDED_HOSTS,
    maxHostLength: MAX_EXCLUDED_HOST_LENGTH
  });
  const normalizedSiteProfiles = readSiteProfilesFromInputs(elements.siteProfilesList);

  try {
    const persisted = await saveSettingsToStorage({
      idleMinutes: parsedIdleHours * 60,
      skipPinned: elements.skipPinnedInput.checked,
      skipAudible: elements.skipAudibleInput.checked,
      excludedHosts: normalizedExcludedHosts.normalizedHosts,
      siteProfiles: normalizedSiteProfiles.profiles
    });

    renderSettings(elements, persisted.settings);
    setSettingsStatus(
      elements,
      getSavedWithIgnoredEntriesMessage(
        normalizedExcludedHosts.ignoredInvalidCount,
        normalizedSiteProfiles.ignoredInvalidCount
      )
    );
  } catch {
    setSettingsStatus(elements, optionsMessages.settingsStatus.saveFailed);
  } finally {
    setBusy(elements, false);
  }
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

async function handleExportConfiguration(elements: OptionsElements): Promise<void> {
  setImportExportStatus(elements, optionsMessages.importExportStatus.exportPending);
  setBusy(elements, true);

  try {
    const [settings, recoveryEntries] = await Promise.all([loadSettingsFromStorage(), loadRecoveryFromStorage()]);
    const portableConfig = buildPortableConfig(settings, recoveryEntries, getNowMinute());
    const content = serializePortableConfig(portableConfig);
    triggerJsonDownload(buildExportFilename(new Date()), content);
    setImportExportStatus(elements, optionsMessages.importExportStatus.exportReady);
  } catch {
    setImportExportStatus(elements, optionsMessages.importExportStatus.exportFailed);
  } finally {
    setBusy(elements, false);
  }
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

async function handleImportConfiguration(elements: OptionsElements): Promise<void> {
  setImportExportStatus(elements, optionsMessages.importExportStatus.importLoading);
  setBusy(elements, true);

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
    setBusy(elements, false);
  }
}

async function applyPortableImport(elements: OptionsElements, portableConfig: PortableConfigV1): Promise<void> {
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

async function handleApplyImport(elements: OptionsElements): Promise<void> {
  const stagedImport = stagedImportByForm.get(elements.form);

  if (!stagedImport) {
    setImportExportStatus(elements, optionsMessages.importExportStatus.noFileSelected);
    return;
  }

  setImportExportStatus(elements, optionsMessages.importExportStatus.importApplyPending);
  setBusy(elements, true);

  try {
    await applyPortableImport(elements, stagedImport.config);
    renderSettings(elements, stagedImport.config.settings);
    renderRecoveryList(elements, stagedImport.config.recoveryState.entries);
    clearStagedImport(elements);
    setImportExportStatus(elements, optionsMessages.importExportStatus.importApplied);
  } catch {
    setImportExportStatus(elements, optionsMessages.importExportStatus.importApplyFailed);
  } finally {
    setBusy(elements, false);
  }
}

function handleCancelImport(elements: OptionsElements): void {
  clearStagedImport(elements);
  setImportExportStatus(elements, optionsMessages.importExportStatus.importCanceled);
}

function wireFormSubmission(elements: OptionsElements): void {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSave(elements);
  });
}

function wireSiteProfileActions(elements: OptionsElements): void {
  elements.addSiteProfileButton.addEventListener("click", () => {
    appendNewSiteProfileRow(elements.siteProfilesList);
  });
}

function wireImportExportActions(elements: OptionsElements): void {
  elements.exportButton.addEventListener("click", () => {
    void handleExportConfiguration(elements);
  });

  elements.importButton.addEventListener("click", () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener("change", () => {
    void handleImportConfiguration(elements);
  });

  elements.applyImportButton.addEventListener("click", () => {
    void handleApplyImport(elements);
  });

  elements.cancelImportButton.addEventListener("click", () => {
    handleCancelImport(elements);
  });
}

async function initializeOptionsPage(): Promise<void> {
  const elements = getOptionsElements();

  if (!elements) {
    return;
  }

  wireFormSubmission(elements);
  wireSiteProfileActions(elements);
  wireImportExportActions(elements);
  clearStagedImport(elements);
  setImportExportStatus(elements, "");
  await Promise.all([loadAndRenderSettings(elements), loadAndRenderRecovery(elements)]);
}

export const __testing = {
  renderRecoveryList
};

void initializeOptionsPage();
