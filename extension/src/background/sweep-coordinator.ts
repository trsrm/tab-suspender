type CreateSweepCoordinatorOptions = {
  runSweep: (minute: number) => Promise<void>;
  onSweepError: (error: unknown) => void;
};

export type SweepCoordinator = {
  shouldRun: (nowMinute: number) => boolean;
  markRan: (nowMinute: number, intervalMinutes: number) => void;
  alignDueCandidate: (nowMinute: number, candidateDueMinute: number) => void;
  requestSweep: (nowMinute: number) => Promise<void>;
  setDueMinute: (dueMinute: number) => void;
};

export function createSweepCoordinator(options: CreateSweepCoordinatorOptions): SweepCoordinator {
  let nextSweepDueMinute = 0;
  let sweepInFlight: Promise<void> | null = null;
  let pendingSweepMinute: number | null = null;

  return {
    shouldRun(nowMinute: number): boolean {
      return nowMinute >= nextSweepDueMinute;
    },
    markRan(nowMinute: number, intervalMinutes: number): void {
      nextSweepDueMinute = nowMinute + intervalMinutes;
    },
    alignDueCandidate(nowMinute: number, candidateDueMinute: number): void {
      if (nextSweepDueMinute <= nowMinute || candidateDueMinute < nextSweepDueMinute) {
        nextSweepDueMinute = candidateDueMinute;
      }
    },
    requestSweep(nowMinute: number): Promise<void> {
      if (sweepInFlight) {
        pendingSweepMinute = pendingSweepMinute === null ? nowMinute : Math.max(pendingSweepMinute, nowMinute);
        return sweepInFlight;
      }

      // Pending minute should never outlive an in-flight run; clear defensively to keep runs independent.
      pendingSweepMinute = null;

      sweepInFlight = (async () => {
        try {
          await options.runSweep(nowMinute);

          // Bound catch-up to one extra sweep so prolonged alarm backlogs cannot run indefinitely.
          if (pendingSweepMinute !== null) {
            const nextMinute = pendingSweepMinute;
            pendingSweepMinute = null;
            await options.runSweep(nextMinute);
          }
        } catch (error: unknown) {
          // Prevent stale catch-up work from leaking into future independent requests.
          pendingSweepMinute = null;
          options.onSweepError(error);
        } finally {
          sweepInFlight = null;
        }
      })();

      return sweepInFlight;
    },
    setDueMinute(dueMinute: number): void {
      nextSweepDueMinute = dueMinute;
    }
  };
}
