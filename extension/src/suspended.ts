import type { SuspendPayload } from "./types.js";

const MINUTE_MS = 60_000;
const MAX_TITLE_LENGTH = 120;

function getSearchParams(): URLSearchParams {
  const search = typeof globalThis.location?.search === "string" ? globalThis.location.search : "";
  return new URLSearchParams(search);
}

function parseSuspendPayload(params: URLSearchParams): SuspendPayload {
  const rawTs = Number(params.get("ts"));

  return {
    u: params.get("u") ?? "",
    t: (params.get("t") ?? "").trim().slice(0, MAX_TITLE_LENGTH),
    ts: Number.isFinite(rawTs) ? rawTs : 0
  };
}

function getUrlSummary(url: string): string {
  if (url.length === 0) {
    return "Original URL is unavailable.";
  }

  try {
    const parsed = new URL(url);
    return `Original tab: ${parsed.host}`;
  } catch {
    return `Original tab: ${url.slice(0, 160)}`;
  }
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

const params = getSearchParams();
const payload = parseSuspendPayload(params);

const titleEl = document.getElementById("title");
const summaryEl = document.getElementById("summary");
const capturedAtEl = document.getElementById("capturedAt");
const statusEl = document.getElementById("status");
const restoreButton = document.getElementById("restoreButton") as HTMLButtonElement | null;

if (titleEl) {
  titleEl.textContent = payload.t.length > 0 ? payload.t : "Suspended tab";
}

if (summaryEl) {
  summaryEl.textContent = getUrlSummary(payload.u);
}

if (capturedAtEl) {
  capturedAtEl.textContent = formatCapturedAt(payload.ts);
}

if (statusEl) {
  statusEl.textContent = "Restore is disabled in Plan 4 and will be implemented in Plan 5.";
}

if (restoreButton) {
  restoreButton.disabled = true;
}
