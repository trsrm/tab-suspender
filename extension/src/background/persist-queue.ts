export type PersistQueue = {
  markDirty: () => void;
  waitForIdle: () => Promise<void>;
};

type CreatePersistQueueOptions = {
  persist: () => Promise<void>;
  onPersistError: (error: unknown) => void;
};

export function createPersistQueue(options: CreatePersistQueueOptions): PersistQueue {
  let queue: Promise<void> = Promise.resolve();
  let scheduled = false;
  let dirty = false;

  const schedule = (): void => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queue = queue
      .then(async () => {
        while (dirty) {
          dirty = false;
          await options.persist();
        }
      })
      .catch((error: unknown) => {
        options.onPersistError(error);
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
