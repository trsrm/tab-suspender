import { normalizeSiteProfileHostRule } from "../matcher.js";
import { MAX_IDLE_HOURS, MAX_SITE_PROFILE_HOST_LENGTH, MAX_SITE_PROFILES, MIN_IDLE_HOURS } from "../settings-store.js";
import type { SiteProfile } from "../types.js";
import type { SiteProfileRowElements } from "./dom.js";
import { parseIdleHours } from "./idle-hours.js";
import { optionsMessages } from "./messages.js";

let siteProfileIdCounter = 0;
let siteProfileRows: SiteProfileRowElements[] = [];

function generateSiteProfileId(): string {
  siteProfileIdCounter += 1;
  return `sp-${Date.now().toString(36)}-${siteProfileIdCounter.toString(36)}`;
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

function removeSiteProfileRow(list: HTMLElement, rowId: string): void {
  siteProfileRows = siteProfileRows.filter((row) => row.id !== rowId);
  list.replaceChildren(...siteProfileRows.map((row) => row.root));
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

export function getSiteProfileRows(): SiteProfileRowElements[] {
  return siteProfileRows;
}

export function renderSiteProfiles(list: HTMLElement, profiles: SiteProfile[]): void {
  siteProfileRows = profiles.slice(0, MAX_SITE_PROFILES).map((profile) => createSiteProfileRow(list, profile));
  list.replaceChildren(...siteProfileRows.map((row) => row.root));
}

export function appendNewSiteProfileRow(list: HTMLElement): void {
  if (siteProfileRows.length >= MAX_SITE_PROFILES) {
    return;
  }

  siteProfileRows = [...siteProfileRows, createSiteProfileRow(list)];
  list.replaceChildren(...siteProfileRows.map((row) => row.root));
}

export function readSiteProfilesFromInputs(): {
  profiles: SiteProfile[];
  ignoredInvalidCount: number;
} {
  const profiles: SiteProfile[] = [];
  let ignoredInvalidCount = 0;

  for (const row of siteProfileRows) {
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
