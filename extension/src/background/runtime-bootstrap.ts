type RuntimeBootstrapOptions = {
  hydrateSettings: () => Promise<void>;
  hydrateActivity: () => Promise<void>;
  hydrateRecovery: () => Promise<void>;
  pruneStaleActivityEntries: () => Promise<boolean>;
  seedActiveTabsOnStartup: () => Promise<boolean>;
  schedulePersistActivity: () => void;
  setInitialSweepDueMinute: (minute: number) => void;
  getCurrentEpochMinute: () => number;
};

export async function initializeRuntimeState(options: RuntimeBootstrapOptions): Promise<void> {
  const settingsReady = options.hydrateSettings();
  const activityReady = options.hydrateActivity();
  const recoveryReady = options.hydrateRecovery();

  await Promise.all([settingsReady, activityReady, recoveryReady]);

  const pruned = await options.pruneStaleActivityEntries();
  const seeded = await options.seedActiveTabsOnStartup();

  if (pruned || seeded) {
    options.schedulePersistActivity();
  }

  options.setInitialSweepDueMinute(options.getCurrentEpochMinute());
}
