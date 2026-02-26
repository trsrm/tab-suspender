import type { PortableConfigV1 } from "./types.js";
import {
  clearStagedImport,
  handleApplyImport,
  handleCancelImport,
  handleExportConfiguration,
  handleImportConfiguration,
  hasStagedImport
} from "./options/portable-config.js";
import {
  clearIdleHoursError,
  getOptionsElements,
  setBusy,
  setDiagnosticsStatus,
  setImportExportStatus,
  type OptionsElements
} from "./options/dom.js";
import { getSiteProfileRows, appendNewSiteProfileRow } from "./options/site-profiles.js";
import { handleSave, loadAndRenderSettings, renderSettings } from "./options/settings.js";
import { handleRefreshDiagnostics, renderDiagnosticsList } from "./options/diagnostics.js";
import { loadAndRenderRecovery, renderRecoveryList } from "./options/recovery.js";

export {};

function createBusySetter(elements: OptionsElements): (busy: boolean) => void {
  return (busy: boolean): void => {
    setBusy(elements, busy, hasStagedImport(), getSiteProfileRows());
  };
}

function wireFormSubmission(elements: OptionsElements, setBusyState: (busy: boolean) => void): void {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSave(elements, setBusyState);
  });
}

function wireSiteProfileActions(elements: OptionsElements): void {
  elements.addSiteProfileButton.addEventListener("click", () => {
    appendNewSiteProfileRow(elements.siteProfilesList);
  });
}

function wireImportExportActions(elements: OptionsElements, setBusyState: (busy: boolean) => void): void {
  elements.exportButton.addEventListener("click", () => {
    void handleExportConfiguration(elements, setBusyState);
  });

  elements.importButton.addEventListener("click", () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener("change", () => {
    void handleImportConfiguration(elements, setBusyState);
  });

  elements.applyImportButton.addEventListener("click", () => {
    void handleApplyImport(elements, setBusyState, (config: PortableConfigV1) => {
      renderSettings(elements, config.settings);
      renderRecoveryList(elements, config.recoveryState.entries);
    });
  });

  elements.cancelImportButton.addEventListener("click", () => {
    handleCancelImport(elements);
  });
}

function wireDiagnosticsActions(elements: OptionsElements): void {
  elements.refreshDiagnosticsButton.addEventListener("click", () => {
    void handleRefreshDiagnostics(elements);
  });
}

async function initializeOptionsPage(): Promise<void> {
  const elements = getOptionsElements();

  if (!elements) {
    return;
  }

  const setBusyState = createBusySetter(elements);

  wireFormSubmission(elements, setBusyState);
  wireSiteProfileActions(elements);
  wireImportExportActions(elements, setBusyState);
  wireDiagnosticsActions(elements);

  clearStagedImport(elements);
  clearIdleHoursError(elements);
  setImportExportStatus(elements, "");
  setDiagnosticsStatus(elements, "");
  elements.diagnosticsSummaryEl.textContent = "";
  renderDiagnosticsList(elements, []);

  await Promise.all([loadAndRenderSettings(elements, setBusyState), loadAndRenderRecovery(elements)]);
}

export const __testing = {
  renderRecoveryList,
  renderDiagnosticsList
};

void initializeOptionsPage();
