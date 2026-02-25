import {
  DEFAULT_SETTINGS,
  MAX_IDLE_MINUTES,
  MIN_IDLE_MINUTES,
  loadSettingsFromStorage,
  saveSettingsToStorage
} from "./settings-store.js";
import type { Settings } from "./types.js";

export {};

type OptionsElements = {
  form: HTMLFormElement;
  idleMinutesInput: HTMLInputElement;
  idleMinutesError: HTMLElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludedHostsInput: HTMLTextAreaElement;
  saveButton: HTMLButtonElement;
  statusEl: HTMLElement;
};

function getOptionsElements(): OptionsElements | null {
  const form = document.getElementById("settingsForm");
  const idleMinutesInput = document.getElementById("idleMinutes");
  const idleMinutesError = document.getElementById("idleMinutesError");
  const skipPinnedInput = document.getElementById("skipPinned");
  const skipAudibleInput = document.getElementById("skipAudible");
  const excludedHostsInput = document.getElementById("excludedHosts");
  const saveButton = document.getElementById("saveButton");
  const statusEl = document.getElementById("status");

  if (
    !form ||
    !idleMinutesInput ||
    !idleMinutesError ||
    !skipPinnedInput ||
    !skipAudibleInput ||
    !excludedHostsInput ||
    !saveButton ||
    !statusEl
  ) {
    return null;
  }

  return {
    form: form as HTMLFormElement,
    idleMinutesInput: idleMinutesInput as HTMLInputElement,
    idleMinutesError: idleMinutesError as HTMLElement,
    skipPinnedInput: skipPinnedInput as HTMLInputElement,
    skipAudibleInput: skipAudibleInput as HTMLInputElement,
    excludedHostsInput: excludedHostsInput as HTMLTextAreaElement,
    saveButton: saveButton as HTMLButtonElement,
    statusEl: statusEl as HTMLElement
  };
}

function setStatus(elements: OptionsElements, message: string): void {
  elements.statusEl.textContent = message;
}

function setBusy(elements: OptionsElements, busy: boolean): void {
  elements.idleMinutesInput.disabled = busy;
  elements.skipPinnedInput.disabled = busy;
  elements.skipAudibleInput.disabled = busy;
  elements.excludedHostsInput.disabled = busy;
  elements.saveButton.disabled = busy;
}

function clearIdleMinutesError(elements: OptionsElements): void {
  elements.idleMinutesError.hidden = true;
  elements.idleMinutesError.textContent = "";
  elements.idleMinutesInput.setAttribute("aria-invalid", "false");
}

function setIdleMinutesError(elements: OptionsElements, message: string): void {
  elements.idleMinutesError.hidden = false;
  elements.idleMinutesError.textContent = message;
  elements.idleMinutesInput.setAttribute("aria-invalid", "true");
}

function parseIdleMinutes(rawValue: string): number | null {
  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < MIN_IDLE_MINUTES || parsed > MAX_IDLE_MINUTES) {
    return null;
  }

  return parsed;
}

function renderSettings(elements: OptionsElements, settings: Settings): void {
  elements.idleMinutesInput.value = String(settings.idleMinutes);
  elements.skipPinnedInput.checked = settings.skipPinned;
  elements.skipAudibleInput.checked = settings.skipAudible;
  elements.excludedHostsInput.value = settings.excludedHosts.join("\n");
}

async function loadAndRenderSettings(elements: OptionsElements): Promise<void> {
  setStatus(elements, "Loading settings...");
  setBusy(elements, true);
  clearIdleMinutesError(elements);

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
  clearIdleMinutesError(elements);

  const parsedIdleMinutes = parseIdleMinutes(elements.idleMinutesInput.value);

  if (parsedIdleMinutes === null) {
    setIdleMinutesError(
      elements,
      `Enter a whole number from ${MIN_IDLE_MINUTES} to ${MAX_IDLE_MINUTES}.`
    );
    setStatus(elements, "Settings were not saved.");
    return;
  }

  setBusy(elements, true);
  setStatus(elements, "Saving settings...");

  try {
    const persisted = await saveSettingsToStorage({
      idleMinutes: parsedIdleMinutes,
      skipPinned: elements.skipPinnedInput.checked,
      skipAudible: elements.skipAudibleInput.checked,
      excludedHosts: elements.excludedHostsInput.value
    });

    renderSettings(elements, persisted.settings);
    setStatus(elements, "Settings saved.");
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
  await loadAndRenderSettings(elements);
}

void initializeOptionsPage();
