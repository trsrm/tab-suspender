import { createTabWithCompat } from "../browser-compat.js";
import { loadRecoveryFromStorage } from "../recovery-store.js";
import { formatCapturedAtMinuteUtc } from "../time-format.js";
import { validateRestorableUrl } from "../url-safety.js";
import type { OptionsElements } from "./dom.js";
import { setRecoveryStatus } from "./dom.js";
import { optionsMessages, RECOVERY_DEFAULT_TITLE } from "./messages.js";

export type RecoveryItem = {
  url: string;
  title: string;
  suspendedAtMinute: number;
};

function getRecoveryTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : RECOVERY_DEFAULT_TITLE;
}

function setRecoveryEmpty(elements: OptionsElements, message: string, hidden: boolean): void {
  elements.recoveryEmpty.textContent = message;
  elements.recoveryEmpty.hidden = hidden;
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
      void createTabWithCompat(validation.url)
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

export function renderRecoveryList(elements: OptionsElements, entries: RecoveryItem[]): void {
  if (entries.length === 0) {
    elements.recoveryList.replaceChildren();
    setRecoveryEmpty(elements, optionsMessages.recoveryEmpty.none, false);
    return;
  }

  const rows = entries.map((entry) => createRecoveryRow(elements, entry));
  elements.recoveryList.replaceChildren(...rows);
  setRecoveryEmpty(elements, "", true);
}

export async function loadAndRenderRecovery(elements: OptionsElements): Promise<void> {
  try {
    const recoveryEntries = await loadRecoveryFromStorage();
    renderRecoveryList(elements, recoveryEntries);
  } catch {
    elements.recoveryList.replaceChildren();
    setRecoveryEmpty(elements, optionsMessages.recoveryEmpty.loadFailed, false);
  }
}
