import { decodeSuspendPayloadFromSearchParams, MAX_SUSPENDED_TITLE_LENGTH } from "./suspended-payload.js";
import { validateRestorableUrl } from "./url-safety.js";

const MINUTE_MS = 60_000;
const MAX_DOCUMENT_TITLE_LENGTH = 80;
const DEFAULT_TITLE = "Suspended tab";
const URL_UNAVAILABLE_TEXT = "Original URL is unavailable.";
const STATUS_READY = "Ready to restore this tab.";
const STATUS_RESTORING = "Restoring tab...";
const STATUS_RESTORE_FAILED = "Restore failed. Please try again.";
const COPY_STATUS_OK = "Original URL copied to clipboard.";
const COPY_STATUS_FAILED = "Could not copy URL. Copy manually.";

function getSearchParams(): URLSearchParams {
  const search = typeof globalThis.location?.search === "string" ? globalThis.location.search : "";
  return new URLSearchParams(search);
}

function getDisplayTitle(title: string): string {
  return title.length > 0 ? title : DEFAULT_TITLE;
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
    return URL_UNAVAILABLE_TEXT;
  }

  return trimmedUrl;
}

function formatCapturedAt(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return "Capture time unavailable.";
  }

  try {
    const isoMinute = new Date(ts * MINUTE_MS).toISOString().slice(0, 16).replace("T", " ");
    return `Captured at ${isoMinute} UTC.`;
  } catch {
    return `Captured at minute ${ts}.`;
  }
}

function getInvalidPayloadStatus(reason: "missing" | "tooLong" | "invalidProtocol" | "invalidUrl"): string {
  switch (reason) {
    case "missing":
      return "Cannot restore: missing original URL.";
    case "tooLong":
      return "Cannot restore: original URL is too long.";
    case "invalidProtocol":
      return "Cannot restore: original URL protocol is not supported.";
    case "invalidUrl":
      return "Cannot restore: original URL is invalid.";
  }
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
  originalUrlEl.disabled = displayUrl === URL_UNAVAILABLE_TEXT;
}

if (capturedAtEl) {
  capturedAtEl.textContent = formatCapturedAt(payload.ts);
}

if (statusEl) {
  statusEl.textContent = restoreUrlValidation.ok ? STATUS_READY : getInvalidPayloadStatus(restoreUrlValidation.reason);
}

if (restoreButton) {
  restoreButton.disabled = !restoreUrlValidation.ok;
}

if (originalUrlEl && displayUrl !== URL_UNAVAILABLE_TEXT) {
  originalUrlEl.addEventListener("click", () => {
    const clipboard = globalThis.navigator?.clipboard;

    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyStatus(COPY_STATUS_FAILED);
      return;
    }

    void clipboard
      .writeText(displayUrl)
      .then(() => {
        setCopyStatus(COPY_STATUS_OK);
      })
      .catch(() => {
        setCopyStatus(COPY_STATUS_FAILED);
      });
  });
}

if (restoreButton && restoreUrlValidation.ok) {
  restoreButton.addEventListener("click", () => {
    restoreButton.disabled = true;

    if (statusEl) {
      statusEl.textContent = STATUS_RESTORING;
    }

    try {
      globalThis.location.replace(restoreUrlValidation.url);
    } catch {
      if (statusEl) {
        statusEl.textContent = STATUS_RESTORE_FAILED;
      }

      restoreButton.disabled = false;
    }
  });
}
