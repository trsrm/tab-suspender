import type { DecodedSuspendPayload, SuspendPayload, SuspendedPageFormat } from "./types.js";
import { formatCapturedAtMinuteUtc } from "./time-format.js";
import { validateRestorableUrl } from "./url-safety.js";

export const MAX_SUSPENDED_TITLE_LENGTH = 120;
export const SUSPENDED_DATA_PAGE_SIGNATURE = "TS_DATA_SUSPENDED_PAGE_V1";
export const MAX_DECODED_SUSPENDED_DATA_URL_LENGTH = 32_768;
const SUSPENDED_DATA_PAGE_PAYLOAD_SCRIPT_ID = "tab-suspender-payload";
const SUSPENDED_DATA_URL_MARKER = encodeURIComponent(`tab-suspender-signature:${SUSPENDED_DATA_PAGE_SIGNATURE}`);

function sanitizeRawUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function sanitizeSuspendedTitle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_SUSPENDED_TITLE_LENGTH);
}

function sanitizeSuspendTimestamp(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sanitizeDecodedSuspendPayload(raw: unknown, format: SuspendedPageFormat): DecodedSuspendPayload {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    u: sanitizeRawUrl(record.u),
    t: sanitizeSuspendedTitle(record.t),
    ts: sanitizeSuspendTimestamp(record.ts),
    format
  };
}

export function decodeSuspendPayloadFromSearchParams(
  params: URLSearchParams,
  format: SuspendedPageFormat
): DecodedSuspendPayload {
  return sanitizeDecodedSuspendPayload(
    {
      u: params.get("u") ?? "",
      t: params.get("t") ?? "",
      ts: params.get("ts")
    },
    format
  );
}

export function decodeLegacySuspendPayloadFromUrl(url: string): DecodedSuspendPayload | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "safari-extension:" || parsed.pathname !== "/suspended.html") {
      return null;
    }

    return decodeSuspendPayloadFromSearchParams(parsed.searchParams, "extensionPage");
  } catch {
    return null;
  }
}

function decodeDataUrlHtml(url: string): string | null {
  if (typeof url !== "string" || !url.startsWith("data:text/html")) {
    return null;
  }

  const commaIndex = url.indexOf(",");

  if (commaIndex < 0) {
    return null;
  }

  const metadata = url.slice(0, commaIndex).toLowerCase();
  const payload = url.slice(commaIndex + 1);

  if (metadata.includes(";base64")) {
    if (typeof globalThis.atob !== "function") {
      return null;
    }

    const maxBase64Length = Math.ceil((MAX_DECODED_SUSPENDED_DATA_URL_LENGTH * 4) / 3) + 8;
    if (payload.length > maxBase64Length) {
      return null;
    }

    try {
      const decoded = globalThis.atob(payload);
      return decoded.length <= MAX_DECODED_SUSPENDED_DATA_URL_LENGTH ? decoded : null;
    } catch {
      return null;
    }
  }

  if (payload.length > MAX_DECODED_SUSPENDED_DATA_URL_LENGTH * 4) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(payload);
    return decoded.length <= MAX_DECODED_SUSPENDED_DATA_URL_LENGTH ? decoded : null;
  } catch {
    return null;
  }
}

export function decodeSuspendPayloadFromDataUrl(url: string): DecodedSuspendPayload | null {
  const html = decodeDataUrlHtml(url);

  if (!html || !html.includes(SUSPENDED_DATA_PAGE_SIGNATURE)) {
    return null;
  }

  const payloadRegex = new RegExp(
    `<script id="${SUSPENDED_DATA_PAGE_PAYLOAD_SCRIPT_ID}" type="application/json">([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(payloadRegex);

  if (!match || typeof match[1] !== "string") {
    return null;
  }

  try {
    const rawPayload = JSON.parse(match[1]) as unknown;
    return sanitizeDecodedSuspendPayload(rawPayload, "dataUrl");
  } catch {
    return null;
  }
}

export function isSuspendedDataUrl(url: string | undefined): boolean {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }

  if (!url.startsWith("data:text/html")) {
    return false;
  }

  if (url.includes(SUSPENDED_DATA_URL_MARKER)) {
    return true;
  }

  // Backward compatibility for older generated pages that only carried the v1 signature token.
  return url.includes(SUSPENDED_DATA_PAGE_SIGNATURE);
}

function serializePayloadForHtml(payload: SuspendPayload): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export function buildSuspendedDataUrl(payload: SuspendPayload): string {
  const validation = validateRestorableUrl(payload.u);
  const pageTitle = payload.t.length > 0 ? payload.t : "Suspended tab";
  const documentTitle = pageTitle.slice(0, 80);
  const displayUrl = validation.ok ? validation.url : payload.u.trim().length > 0 ? payload.u.trim() : "Original URL is unavailable.";
  const capturedAtText = formatCapturedAtMinuteUtc(payload.ts);
  const escapedTitle = escapeHtml(pageTitle);
  const escapedDocumentTitle = escapeHtml(documentTitle);
  const escapedDisplayUrl = escapeHtml(displayUrl);
  const escapedCapturedAt = escapeHtml(capturedAtText);
  const statusMarkup = validation.ok
    ? ""
    : `<p id="status" role="status" aria-live="polite">${escapeHtml(getInvalidPayloadStatus(validation.reason))}</p>`;
  const escapedRestoreHref = validation.ok ? escapeHtml(validation.url) : "";
  const originalUrlControl = validation.ok
    ? `<a id="originalUrl" class="url" href="${escapedRestoreHref}">${escapedDisplayUrl}</a>`
    : `<span id="originalUrl" class="url muted">${escapedDisplayUrl}</span>`;
  const restoreControl = validation.ok
    ? `<a id="restoreControl" class="btn" href="${escapedRestoreHref}">Restore</a>`
    : `<a id="restoreControl" class="btn disabled" aria-disabled="true">Restore</a>`;

  const serializedPayload = serializePayloadForHtml(payload);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="tab-suspender-signature" content="${SUSPENDED_DATA_PAGE_SIGNATURE}"><title>${escapedDocumentTitle}</title><style>body{font:14px system-ui,-apple-system,sans-serif;margin:20px;background:#f8fafc;color:#0f172a}main{max-width:680px;margin:auto;padding:16px;background:#fff;border:1px solid #d0d7de;border-radius:10px}h1{font-size:1.12rem;margin:0 0 .5rem}p{margin:.45rem 0}.muted{color:#475569}.url{display:block;word-break:break-all}.btn{display:inline-block;margin-top:.55rem;padding:.45rem .7rem;border-radius:8px;background:#15803d;color:#fff;text-decoration:none}.btn.disabled{background:#94a3b8;pointer-events:none}</style></head><body><main><h1 id="title">${escapedTitle}</h1><p id="capturedAt" class="muted">${escapedCapturedAt}</p>${originalUrlControl}${statusMarkup}${restoreControl}</main><!--tab-suspender-signature:${SUSPENDED_DATA_PAGE_SIGNATURE}--><script id="${SUSPENDED_DATA_PAGE_PAYLOAD_SCRIPT_ID}" type="application/json">${serializedPayload}</script></body></html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
