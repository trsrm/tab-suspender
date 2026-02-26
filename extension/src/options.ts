import {
  DEFAULT_SETTINGS,
  MAX_IDLE_HOURS,
  MAX_EXCLUDED_HOST_LENGTH,
  MAX_EXCLUDED_HOSTS,
  MIN_IDLE_HOURS,
  loadSettingsFromStorage,
  saveSettingsToStorage
} from "./settings-store.js";
import { normalizeExcludedHostEntries } from "./matcher.js";
import type { Settings } from "./types.js";
import { loadRecoveryFromStorage } from "./recovery-store.js";
import { validateRestorableUrl } from "./url-safety.js";

export {};

const RECOVERY_DEFAULT_TITLE = "Untitled tab";

type OptionsElements = {
  form: HTMLFormElement;
  idleHoursInput: HTMLInputElement;
  idleHoursError: HTMLElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludedHostsInput: HTMLTextAreaElement;
  saveButton: HTMLButtonElement;
  statusEl: HTMLElement;
  recoveryList: HTMLElement;
  recoveryEmpty: HTMLElement;
};

function getOptionsElements(): OptionsElements | null {
  const form = document.getElementById("settingsForm");
  const idleHoursInput = document.getElementById("idleHours");
  const idleHoursError = document.getElementById("idleHoursError");
  const skipPinnedInput = document.getElementById("skipPinned");
  const skipAudibleInput = document.getElementById("skipAudible");
  const excludedHostsInput = document.getElementById("excludedHosts");
  const saveButton = document.getElementById("saveButton");
  const statusEl = document.getElementById("status");
  const recoveryList = document.getElementById("recoveryList");
  const recoveryEmpty = document.getElementById("recoveryEmpty");

  if (
    !form ||
    !idleHoursInput ||
    !idleHoursError ||
    !skipPinnedInput ||
    !skipAudibleInput ||
    !excludedHostsInput ||
    !saveButton ||
    !statusEl ||
    !recoveryList ||
    !recoveryEmpty
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
    saveButton: saveButton as HTMLButtonElement,
    statusEl: statusEl as HTMLElement,
    recoveryList: recoveryList as HTMLElement,
    recoveryEmpty: recoveryEmpty as HTMLElement
  };
}

function setStatus(elements: OptionsElements, message: string): void {
  elements.statusEl.textContent = message;
}

function setBusy(elements: OptionsElements, busy: boolean): void {
  elements.idleHoursInput.disabled = busy;
  elements.skipPinnedInput.disabled = busy;
  elements.skipAudibleInput.disabled = busy;
  elements.excludedHostsInput.disabled = busy;
  elements.saveButton.disabled = busy;
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

function renderSettings(elements: OptionsElements, settings: Settings): void {
  elements.idleHoursInput.value = String(Math.max(MIN_IDLE_HOURS, Math.floor(settings.idleMinutes / 60)));
  elements.skipPinnedInput.checked = settings.skipPinned;
  elements.skipAudibleInput.checked = settings.skipAudible;
  elements.excludedHostsInput.value = settings.excludedHosts.join("\n");
}

type RecoveryItem = {
  url: string;
  title: string;
  suspendedAtMinute: number;
};

function formatCapturedAtMinute(minute: number): string {
  if (!Number.isFinite(minute) || minute <= 0) {
    return "Capture time unavailable.";
  }

  try {
    const isoMinute = new Date(minute * 60_000).toISOString().slice(0, 16).replace("T", " ");
    return `Captured at ${isoMinute} UTC.`;
  } catch {
    return `Captured at minute ${minute}.`;
  }
}

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

function renderRecoveryList(elements: OptionsElements, entries: RecoveryItem[]): void {
  if (entries.length === 0) {
    elements.recoveryList.replaceChildren();
    setRecoveryEmpty(elements, "No recently suspended tabs yet.", false);
    return;
  }

  const rows: HTMLElement[] = entries.map((entry) => {
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
    capturedAt.textContent = formatCapturedAtMinute(entry.suspendedAtMinute);
    details.appendChild(capturedAt);

    const reopenButton = document.createElement("button");
    reopenButton.type = "button";
    reopenButton.textContent = "Reopen";

    const validation = validateRestorableUrl(entry.url);
    if (!validation.ok) {
      reopenButton.disabled = true;
      reopenButton.title = "URL is no longer eligible for restore.";
    } else {
      reopenButton.addEventListener("click", () => {
        reopenButton.disabled = true;
        void createTabWithCompatibility(validation.url)
          .then(() => {
            setStatus(elements, "Reopened suspended tab in a new tab.");
          })
          .catch(() => {
            setStatus(elements, "Failed to reopen suspended tab.");
            reopenButton.disabled = false;
          });
      });
    }

    row.appendChild(details);
    row.appendChild(reopenButton);
    return row;
  });

  elements.recoveryList.replaceChildren(...rows);
  setRecoveryEmpty(elements, "", true);
}

async function loadAndRenderRecovery(elements: OptionsElements): Promise<void> {
  try {
    const recoveryEntries = await loadRecoveryFromStorage();
    renderRecoveryList(elements, recoveryEntries);
  } catch {
    elements.recoveryList.replaceChildren();
    setRecoveryEmpty(elements, "Failed to load recently suspended tabs.", false);
  }
}

async function loadAndRenderSettings(elements: OptionsElements): Promise<void> {
  setStatus(elements, "Loading settings...");
  setBusy(elements, true);
  clearIdleHoursError(elements);

  try {
    const settings = await loadSettingsFromStorage();
    renderSettings(elements, settings);
    setStatus(elements, "Settings loaded.");
  } catch {
    renderSettings(elements, DEFAULT_SETTINGS);
    setStatus(elements, "Failed to load settings. Using defaults.");
  } finally {
    setBusy(elements, false);
  }
}

async function handleSave(elements: OptionsElements): Promise<void> {
  clearIdleHoursError(elements);

  const parsedIdleHours = parseIdleHours(elements.idleHoursInput.value);

  if (parsedIdleHours === null) {
    setIdleHoursError(
      elements,
      `Enter a whole number from ${MIN_IDLE_HOURS} to ${MAX_IDLE_HOURS}.`
    );
    setStatus(elements, "Settings were not saved.");
    return;
  }

  setBusy(elements, true);
  setStatus(elements, "Saving settings...");

  const normalizedExcludedHosts = normalizeExcludedHostEntries(elements.excludedHostsInput.value, {
    maxEntries: MAX_EXCLUDED_HOSTS,
    maxHostLength: MAX_EXCLUDED_HOST_LENGTH
  });

  try {
    const persisted = await saveSettingsToStorage({
      idleMinutes: parsedIdleHours * 60,
      skipPinned: elements.skipPinnedInput.checked,
      skipAudible: elements.skipAudibleInput.checked,
      excludedHosts: normalizedExcludedHosts.normalizedHosts
    });

    renderSettings(elements, persisted.settings);
    if (normalizedExcludedHosts.ignoredInvalidCount > 0) {
      const suffix = normalizedExcludedHosts.ignoredInvalidCount === 1 ? "entry" : "entries";
      setStatus(
        elements,
        `Settings saved. Ignored ${normalizedExcludedHosts.ignoredInvalidCount} invalid excluded host ${suffix}.`
      );
    } else {
      setStatus(elements, "Settings saved.");
    }
  } catch {
    setStatus(elements, "Failed to save settings.");
  } finally {
    setBusy(elements, false);
  }
}

function wireFormSubmission(elements: OptionsElements): void {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSave(elements);
  });
}

async function initializeOptionsPage(): Promise<void> {
  const elements = getOptionsElements();

  if (!elements) {
    return;
  }

  wireFormSubmission(elements);
  await Promise.all([loadAndRenderSettings(elements), loadAndRenderRecovery(elements)]);
}

void initializeOptionsPage();
