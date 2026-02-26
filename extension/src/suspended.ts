import { decodeSuspendPayloadFromSearchParams, MAX_SUSPENDED_TITLE_LENGTH } from "./suspended-payload.js";
import { formatCapturedAtMinuteUtc } from "./time-format.js";
import { validateRestorableUrl } from "./url-safety.js";

const MAX_DOCUMENT_TITLE_LENGTH = 80;
const messages = {
  title: {
    default: "Suspended tab"
  },
  url: {
    unavailable: "Original URL is unavailable."
  },
  restore: {
    ready: "Ready to restore this tab.",
    restoring: "Restoring tab...",
    failed: "Restore failed. Please try again.",
    invalidReason: {
      missing: "Cannot restore: missing original URL.",
      tooLong: "Cannot restore: original URL is too long.",
      invalidProtocol: "Cannot restore: original URL protocol is not supported.",
      invalidUrl: "Cannot restore: original URL is invalid."
    }
  },
  copy: {
    ok: "Original URL copied to clipboard.",
    failed: "Could not copy URL. Copy manually."
  }
} as const;

function getSearchParams(): URLSearchParams {
  const search = typeof globalThis.location?.search === "string" ? globalThis.location.search : "";
  return new URLSearchParams(search);
}

function getDisplayTitle(title: string): string {
  return title.length > 0 ? title : messages.title.default;
}

function getDocumentTitle(title: string): string {
  return title.slice(0, MAX_DOCUMENT_TITLE_LENGTH);
}

function getDisplayUrl(url: string, restorableUrl: string | null): string {
  if (restorableUrl !== null) {
    return restorableUrl;
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return messages.url.unavailable;
  }

  return trimmedUrl;
}

function getInvalidPayloadStatus(reason: "missing" | "tooLong" | "invalidProtocol" | "invalidUrl"): string {
  return messages.restore.invalidReason[reason];
}

const params = getSearchParams();
const payload = decodeSuspendPayloadFromSearchParams(params, "extensionPage");
const payloadTitle = payload.t.slice(0, MAX_SUSPENDED_TITLE_LENGTH);

const titleEl = document.getElementById("title");
const originalUrlEl = document.getElementById("originalUrl") as HTMLButtonElement | null;
const copyStatusEl = document.getElementById("copyStatus");
const capturedAtEl = document.getElementById("capturedAt");
const statusEl = document.getElementById("status");
const restoreButton = document.getElementById("restoreButton") as HTMLButtonElement | null;
const restoreUrlValidation = validateRestorableUrl(payload.u);
const pageTitle = getDisplayTitle(payloadTitle);
const displayUrl = getDisplayUrl(payload.u, restoreUrlValidation.ok ? restoreUrlValidation.url : null);

function setCopyStatus(status: string): void {
  if (copyStatusEl) {
    copyStatusEl.textContent = status;
  }
}

if (titleEl) {
  titleEl.textContent = pageTitle;
}

document.title = getDocumentTitle(pageTitle);

if (originalUrlEl) {
  originalUrlEl.textContent = displayUrl;
  originalUrlEl.title = displayUrl;
  originalUrlEl.disabled = displayUrl === messages.url.unavailable;
}

if (capturedAtEl) {
  capturedAtEl.textContent = formatCapturedAtMinuteUtc(payload.ts);
}

if (statusEl) {
  statusEl.textContent = restoreUrlValidation.ok ? messages.restore.ready : getInvalidPayloadStatus(restoreUrlValidation.reason);
}

if (restoreButton) {
  restoreButton.disabled = !restoreUrlValidation.ok;
}

if (originalUrlEl && displayUrl !== messages.url.unavailable) {
  originalUrlEl.addEventListener("click", () => {
    const clipboard = globalThis.navigator?.clipboard;

    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyStatus(messages.copy.failed);
      return;
    }

    void clipboard
      .writeText(displayUrl)
      .then(() => {
        setCopyStatus(messages.copy.ok);
      })
      .catch(() => {
        setCopyStatus(messages.copy.failed);
      });
  });
}

if (restoreButton && restoreUrlValidation.ok) {
  restoreButton.addEventListener("click", () => {
    restoreButton.disabled = true;

    if (statusEl) {
      statusEl.textContent = messages.restore.restoring;
    }

    try {
      globalThis.location.replace(restoreUrlValidation.url);
    } catch {
      if (statusEl) {
        statusEl.textContent = messages.restore.failed;
      }

      restoreButton.disabled = false;
    }
  });
}
