import type { DecodedSuspendPayload, SuspendPayload, SuspendedPageFormat } from "./types.js";
import { formatCapturedAtMinuteUtc } from "./time-format.js";
import { validateRestorableUrl } from "./url-safety.js";

export const MAX_SUSPENDED_TITLE_LENGTH = 120;
export const SUSPENDED_DATA_PAGE_SIGNATURE = "TS_DATA_SUSPENDED_PAGE_V1";
const SUSPENDED_DATA_PAGE_PAYLOAD_SCRIPT_ID = "tab-suspender-payload";

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

    try {
      return globalThis.atob(payload);
    } catch {
      return null;
    }
  }

  try {
    return decodeURIComponent(payload);
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

  return decodeSuspendPayloadFromDataUrl(url) !== null;
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
  const statusText = validation.ok ? "Ready to restore this tab." : getInvalidPayloadStatus(validation.reason);
  const escapedTitle = escapeHtml(pageTitle);
  const escapedDocumentTitle = escapeHtml(documentTitle);
  const escapedDisplayUrl = escapeHtml(displayUrl);
  const escapedCapturedAt = escapeHtml(capturedAtText);
  const escapedStatus = escapeHtml(statusText);
  const escapedRestoreHref = validation.ok ? escapeHtml(validation.url) : "";
  const originalUrlControl = validation.ok
    ? `<a id="originalUrl" class="url-control" href="${escapedRestoreHref}">${escapedDisplayUrl}</a>`
    : `<span id="originalUrl" class="url-control is-disabled">${escapedDisplayUrl}</span>`;
  const restoreControl = validation.ok
    ? `<a id="restoreControl" class="restore-link" href="${escapedRestoreHref}">Restore</a>`
    : `<span id="restoreControl" class="restore-link is-disabled" aria-disabled="true">Restore</span>`;

  const serializedPayload = serializePayloadForHtml(payload);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="tab-suspender-signature" content="${SUSPENDED_DATA_PAGE_SIGNATURE}" />
  <title>${escapedDocumentTitle}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 20px; background: #f5f6f8; color: #1f2933; }
    main { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #d8dee9; border-radius: 12px; padding: 20px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
    p { margin: 0.5rem 0; }
    .url-control { display: block; width: 100%; box-sizing: border-box; text-align: left; text-decoration: none; border: 1px solid #d8dee9; background: #f8fafc; color: #1f2933; border-radius: 8px; padding: 10px; word-break: break-all; }
    .url-control.is-disabled { opacity: 0.75; }
    .actions { margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .restore-link { display: inline-block; border: 1px solid #166534; background: #15803d; color: #fff; border-radius: 8px; padding: 0.6rem 0.9rem; text-decoration: none; }
    .restore-link.is-disabled { opacity: 0.7; pointer-events: none; }
    .muted { color: #52606d; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">${escapedTitle}</h1>
    <p class="muted" id="capturedAt">${escapedCapturedAt}</p>
    <p><strong>Original URL</strong></p>
    ${originalUrlControl}
    <p id="status" role="status" aria-live="polite">${escapedStatus}</p>
    <div class="actions">
      ${restoreControl}
    </div>
  </main>
  <script id="${SUSPENDED_DATA_PAGE_PAYLOAD_SCRIPT_ID}" type="application/json">${serializedPayload}</script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
