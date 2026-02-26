import { sendRuntimeMessageWithCompat } from "../browser-compat.js";
import type {
  SuspendDiagnosticsEntry,
  SuspendDiagnosticsRequest,
  SuspendDiagnosticsResponse
} from "../types.js";
import type { OptionsElements } from "./dom.js";
import { setDiagnosticsBusy, setDiagnosticsStatus } from "./dom.js";
import {
  optionsMessages,
  RECOVERY_DEFAULT_TITLE,
  SUSPEND_DIAGNOSTICS_EMPTY_ROW,
  SUSPEND_DIAGNOSTICS_REQUEST_TYPE,
  SUSPEND_REASON_LABELS,
  SUSPEND_REASON_ORDER
} from "./messages.js";

function createDiagnosticsSummaryText(response: Extract<SuspendDiagnosticsResponse, { ok: true }>): string {
  if (response.totalTabs === 0) {
    return optionsMessages.diagnostics.summaryEmpty;
  }

  const parts: string[] = [];
  for (const reason of SUSPEND_REASON_ORDER) {
    const count = response.summary[reason];
    parts.push(`${SUSPEND_REASON_LABELS[reason]}: ${count}`);
  }

  const suffix = response.truncated ? ` ${optionsMessages.diagnostics.truncated}` : "";
  return `Evaluated ${response.totalTabs} tab(s). ${parts.join(" | ")}.${suffix}`;
}

function createDiagnosticsRow(entry: SuspendDiagnosticsEntry): HTMLElement {
  const row = document.createElement("li");
  row.className = "diagnostics-item";

  const title = document.createElement("p");
  title.className = "diagnostics-item-title";
  title.textContent = entry.title.trim().length > 0 ? entry.title : RECOVERY_DEFAULT_TITLE;

  const url = document.createElement("p");
  url.className = "diagnostics-item-url";
  url.textContent = entry.url;
  url.title = entry.url;

  const reason = document.createElement("p");
  reason.className = "diagnostics-item-reason";
  reason.textContent = SUSPEND_REASON_LABELS[entry.reason];

  row.appendChild(title);
  row.appendChild(url);
  row.appendChild(reason);
  return row;
}

export function renderDiagnosticsList(elements: OptionsElements, entries: SuspendDiagnosticsEntry[]): void {
  if (entries.length === 0) {
    const emptyRow = document.createElement("li");
    emptyRow.className = "diagnostics-item";
    const text = document.createElement("p");
    text.className = "diagnostics-item-title";
    text.textContent = SUSPEND_DIAGNOSTICS_EMPTY_ROW;
    emptyRow.appendChild(text);
    elements.diagnosticsListEl.replaceChildren(emptyRow);
    return;
  }

  const rows = entries.map((entry) => createDiagnosticsRow(entry));
  elements.diagnosticsListEl.replaceChildren(...rows);
}

export async function handleRefreshDiagnostics(elements: OptionsElements): Promise<void> {
  setDiagnosticsBusy(elements, true);
  setDiagnosticsStatus(elements, optionsMessages.diagnostics.loading);

  const request: SuspendDiagnosticsRequest = {
    type: SUSPEND_DIAGNOSTICS_REQUEST_TYPE
  };

  let response: SuspendDiagnosticsResponse;

  try {
    response =
      (await sendRuntimeMessageWithCompat<SuspendDiagnosticsResponse>(request)) ?? {
        ok: false,
        message: "No diagnostics response."
      };
  } catch (error) {
    response = {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  if (!response.ok) {
    setDiagnosticsStatus(elements, `${optionsMessages.diagnostics.failed} ${response.message}`);
    elements.diagnosticsSummaryEl.textContent = "";
    renderDiagnosticsList(elements, []);
    setDiagnosticsBusy(elements, false);
    return;
  }

  setDiagnosticsStatus(elements, optionsMessages.diagnostics.loaded);
  elements.diagnosticsSummaryEl.textContent = createDiagnosticsSummaryText(response);
  renderDiagnosticsList(elements, response.entries);
  setDiagnosticsBusy(elements, false);
}
