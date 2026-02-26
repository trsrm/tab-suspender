export type PersistQueue = {
  markDirty: () => void;
  waitForIdle: () => Promise<void>;
};

export type PersistErrorContext = {
  attempt: number;
  willRetry: boolean;
  terminal: boolean;
};

type CreatePersistQueueOptions = {
  persist: () => Promise<void>;
  onPersistError: (error: unknown, context: PersistErrorContext) => void;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export function createPersistQueue(options: CreatePersistQueueOptions): PersistQueue {
  const maxRetries = Number.isInteger(options.maxRetries) ? Math.max(0, options.maxRetries ?? 0) : 2;
  const baseRetryDelayMs = Number.isFinite(options.baseRetryDelayMs) ? Math.max(0, options.baseRetryDelayMs ?? 0) : 50;
  const sleep =
    options.sleep ??
    ((delayMs: number) => {
      if (delayMs <= 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    });

  let queue: Promise<void> = Promise.resolve();
  let scheduled = false;
  let dirty = false;

  const persistWithRetry = async (): Promise<void> => {
    const totalAttempts = maxRetries + 1;
    let delayMs = baseRetryDelayMs;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        await options.persist();
        return;
      } catch (error) {
        const willRetry = attempt < totalAttempts;
        options.onPersistError(error, {
          attempt,
          willRetry,
          terminal: !willRetry
        });

        if (!willRetry) {
          return;
        }

        await sleep(delayMs);
        delayMs *= 2;
      }
    }
  };

  const schedule = (): void => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queue = queue
      .then(async () => {
        while (dirty) {
          dirty = false;
          await persistWithRetry();
        }
      })
      .finally(() => {
        scheduled = false;

        if (dirty) {
          schedule();
        }
      });
  };

  return {
    markDirty(): void {
      dirty = true;
      schedule();
    },
    waitForIdle(): Promise<void> {
      return queue;
    }
  };
}
