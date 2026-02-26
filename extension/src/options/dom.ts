export type OptionsElements = {
  form: HTMLFormElement;
  idleHoursInput: HTMLInputElement;
  idleHoursError: HTMLElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludedHostsInput: HTMLTextAreaElement;
  siteProfilesList: HTMLElement;
  addSiteProfileButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  settingsStatusEl: HTMLElement;
  recoveryStatusEl: HTMLElement;
  recoveryList: HTMLElement;
  recoveryEmpty: HTMLElement;
  diagnosticsStatusEl: HTMLElement;
  diagnosticsSummaryEl: HTMLElement;
  diagnosticsListEl: HTMLElement;
  refreshDiagnosticsButton: HTMLButtonElement;
  importExportStatusEl: HTMLElement;
  importPreviewEl: HTMLElement;
  importPreviewSummaryEl: HTMLElement;
  importPreviewWarningsEl: HTMLElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  importFileInput: HTMLInputElement;
  applyImportButton: HTMLButtonElement;
  cancelImportButton: HTMLButtonElement;
};

export type SiteProfileRowElements = {
  id: string;
  root: HTMLElement;
  hostRuleInput: HTMLInputElement;
  idleHoursInput: HTMLInputElement;
  skipPinnedInput: HTMLInputElement;
  skipAudibleInput: HTMLInputElement;
  excludeFromSuspendInput: HTMLInputElement;
  deleteButton: HTMLButtonElement;
};

export function getOptionsElements(): OptionsElements | null {
  const form = document.getElementById("settingsForm");
  const idleHoursInput = document.getElementById("idleHours");
  const idleHoursError = document.getElementById("idleHoursError");
  const skipPinnedInput = document.getElementById("skipPinned");
  const skipAudibleInput = document.getElementById("skipAudible");
  const excludedHostsInput = document.getElementById("excludedHosts");
  const siteProfilesList = document.getElementById("siteProfiles");
  const addSiteProfileButton = document.getElementById("addSiteProfileButton");
  const saveButton = document.getElementById("saveButton");
  const settingsStatusEl = document.getElementById("status");
  const recoveryStatusEl = document.getElementById("recoveryStatus");
  const recoveryList = document.getElementById("recoveryList");
  const recoveryEmpty = document.getElementById("recoveryEmpty");
  const diagnosticsStatusEl = document.getElementById("diagnosticsStatus");
  const diagnosticsSummaryEl = document.getElementById("diagnosticsSummary");
  const diagnosticsListEl = document.getElementById("diagnosticsList");
  const refreshDiagnosticsButton = document.getElementById("refreshDiagnosticsButton");
  const importExportStatusEl = document.getElementById("importExportStatus");
  const importPreviewEl = document.getElementById("importPreview");
  const importPreviewSummaryEl = document.getElementById("importPreviewSummary");
  const importPreviewWarningsEl = document.getElementById("importPreviewWarnings");
  const exportButton = document.getElementById("exportConfigButton");
  const importButton = document.getElementById("importConfigButton");
  const importFileInput = document.getElementById("importConfigFile");
  const applyImportButton = document.getElementById("applyImportButton");
  const cancelImportButton = document.getElementById("cancelImportButton");

  if (
    !form ||
    !idleHoursInput ||
    !idleHoursError ||
    !skipPinnedInput ||
    !skipAudibleInput ||
    !excludedHostsInput ||
    !siteProfilesList ||
    !addSiteProfileButton ||
    !saveButton ||
    !settingsStatusEl ||
    !recoveryStatusEl ||
    !recoveryList ||
    !recoveryEmpty ||
    !diagnosticsStatusEl ||
    !diagnosticsSummaryEl ||
    !diagnosticsListEl ||
    !refreshDiagnosticsButton ||
    !importExportStatusEl ||
    !importPreviewEl ||
    !importPreviewSummaryEl ||
    !importPreviewWarningsEl ||
    !exportButton ||
    !importButton ||
    !importFileInput ||
    !applyImportButton ||
    !cancelImportButton
  ) {
    return null;
  }

  return {
    form: form as HTMLFormElement,
    idleHoursInput: idleHoursInput as HTMLInputElement,
    idleHoursError: idleHoursError as HTMLElement,
    skipPinnedInput: skipPinnedInput as HTMLInputElement,
    skipAudibleInput: skipAudibleInput as HTMLInputElement,
    excludedHostsInput: excludedHostsInput as HTMLTextAreaElement,
    siteProfilesList: siteProfilesList as HTMLElement,
    addSiteProfileButton: addSiteProfileButton as HTMLButtonElement,
    saveButton: saveButton as HTMLButtonElement,
    settingsStatusEl: settingsStatusEl as HTMLElement,
    recoveryStatusEl: recoveryStatusEl as HTMLElement,
    recoveryList: recoveryList as HTMLElement,
    recoveryEmpty: recoveryEmpty as HTMLElement,
    diagnosticsStatusEl: diagnosticsStatusEl as HTMLElement,
    diagnosticsSummaryEl: diagnosticsSummaryEl as HTMLElement,
    diagnosticsListEl: diagnosticsListEl as HTMLElement,
    refreshDiagnosticsButton: refreshDiagnosticsButton as HTMLButtonElement,
    importExportStatusEl: importExportStatusEl as HTMLElement,
    importPreviewEl: importPreviewEl as HTMLElement,
    importPreviewSummaryEl: importPreviewSummaryEl as HTMLElement,
    importPreviewWarningsEl: importPreviewWarningsEl as HTMLElement,
    exportButton: exportButton as HTMLButtonElement,
    importButton: importButton as HTMLButtonElement,
    importFileInput: importFileInput as HTMLInputElement,
    applyImportButton: applyImportButton as HTMLButtonElement,
    cancelImportButton: cancelImportButton as HTMLButtonElement
  };
}

export function setSettingsStatus(elements: OptionsElements, message: string): void {
  elements.settingsStatusEl.textContent = message;
}

export function setRecoveryStatus(elements: OptionsElements, message: string): void {
  elements.recoveryStatusEl.textContent = message;
}

export function setImportExportStatus(elements: OptionsElements, message: string): void {
  elements.importExportStatusEl.textContent = message;
}

export function setDiagnosticsStatus(elements: OptionsElements, message: string): void {
  elements.diagnosticsStatusEl.textContent = message;
}

export function clearIdleHoursError(elements: OptionsElements): void {
  elements.idleHoursError.hidden = true;
  elements.idleHoursError.textContent = "";
  elements.idleHoursInput.setAttribute("aria-invalid", "false");
}

export function setIdleHoursError(elements: OptionsElements, message: string): void {
  elements.idleHoursError.hidden = false;
  elements.idleHoursError.textContent = message;
  elements.idleHoursInput.setAttribute("aria-invalid", "true");
}

export function setDiagnosticsBusy(elements: OptionsElements, busy: boolean): void {
  elements.refreshDiagnosticsButton.disabled = busy;
}

export function setBusy(
  elements: OptionsElements,
  busy: boolean,
  hasStagedImport: boolean,
  siteProfileRows: readonly SiteProfileRowElements[]
): void {
  elements.idleHoursInput.disabled = busy;
  elements.skipPinnedInput.disabled = busy;
  elements.skipAudibleInput.disabled = busy;
  elements.excludedHostsInput.disabled = busy;
  elements.addSiteProfileButton.disabled = busy;
  elements.saveButton.disabled = busy;
  elements.exportButton.disabled = busy;
  elements.importButton.disabled = busy;
  elements.importFileInput.disabled = busy;
  elements.applyImportButton.disabled = busy || !hasStagedImport;
  elements.cancelImportButton.disabled = busy || !hasStagedImport;

  for (const row of siteProfileRows) {
    row.hostRuleInput.disabled = busy;
    row.idleHoursInput.disabled = busy;
    row.skipPinnedInput.disabled = busy;
    row.skipAudibleInput.disabled = busy;
    row.excludeFromSuspendInput.disabled = busy;
    row.deleteButton.disabled = busy;
  }
}
