import {
  DEFAULT_SETTINGS,
  MAX_EXCLUDED_HOST_LENGTH,
  MAX_EXCLUDED_HOSTS,
  MIN_IDLE_HOURS,
  loadSettingsFromStorage,
  saveSettingsToStorage
} from "../settings-store.js";
import { normalizeExcludedHostEntries } from "../matcher.js";
import type { Settings } from "../types.js";
import type { OptionsElements } from "./dom.js";
import { clearIdleHoursError, setIdleHoursError, setSettingsStatus } from "./dom.js";
import { parseIdleHours } from "./idle-hours.js";
import { optionsMessages } from "./messages.js";
import { readSiteProfilesFromInputs, renderSiteProfiles } from "./site-profiles.js";

type BusySetter = (busy: boolean) => void;

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

export function renderSettings(elements: OptionsElements, settings: Settings): void {
  elements.idleHoursInput.value = String(Math.max(MIN_IDLE_HOURS, Math.floor(settings.idleMinutes / 60)));
  elements.skipPinnedInput.checked = settings.skipPinned;
  elements.skipAudibleInput.checked = settings.skipAudible;
  elements.excludedHostsInput.value = settings.excludedHosts.join("\n");
  renderSiteProfiles(elements.siteProfilesList, settings.siteProfiles);
}

export async function loadAndRenderSettings(elements: OptionsElements, setBusy: BusySetter): Promise<void> {
  setSettingsStatus(elements, optionsMessages.settingsStatus.loading);
  setBusy(true);
  clearIdleHoursError(elements);

  try {
    const settings = await loadSettingsFromStorage();
    renderSettings(elements, settings);
    setSettingsStatus(elements, optionsMessages.settingsStatus.loaded);
  } catch {
    renderSettings(elements, DEFAULT_SETTINGS);
    setSettingsStatus(elements, optionsMessages.settingsStatus.loadFailedDefaults);
  } finally {
    setBusy(false);
  }
}

export async function handleSave(elements: OptionsElements, setBusy: BusySetter): Promise<void> {
  clearIdleHoursError(elements);

  const parsedIdleHours = parseIdleHours(elements.idleHoursInput.value);

  if (parsedIdleHours === null) {
    setIdleHoursError(elements, optionsMessages.validation.idleHoursOutOfRange);
    setSettingsStatus(elements, optionsMessages.settingsStatus.validationFailed);
    return;
  }

  setBusy(true);
  setSettingsStatus(elements, optionsMessages.settingsStatus.savePending);

  const normalizedExcludedHosts = normalizeExcludedHostEntries(elements.excludedHostsInput.value, {
    maxEntries: MAX_EXCLUDED_HOSTS,
    maxHostLength: MAX_EXCLUDED_HOST_LENGTH
  });
  const normalizedSiteProfiles = readSiteProfilesFromInputs();

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
    setBusy(false);
  }
}
