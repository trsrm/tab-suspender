export type StorageAreaLike = {
  get: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
};

function getRuntimeLastErrorMessage(): string | null {
  const runtime = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime;
  const message = runtime?.lastError?.message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function resolveRecordValue(result: unknown, key: string): unknown {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  return (result as Record<string, unknown>)[key];
}

export function resolveStorageArea(storageArea: StorageAreaLike | null | undefined): StorageAreaLike | null {
  if (storageArea && typeof storageArea.get === "function" && typeof storageArea.set === "function") {
    return storageArea;
  }

  const runtimeStorage = (globalThis as { chrome?: { storage?: { local?: StorageAreaLike } } }).chrome?.storage?.local;

  if (runtimeStorage && typeof runtimeStorage.get === "function" && typeof runtimeStorage.set === "function") {
    return runtimeStorage;
  }

  return null;
}

export function getKeyWithCompatibility(storageArea: StorageAreaLike, key: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (value: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(toError(error));
    };

    const callback = (result: unknown): void => {
      const lastErrorMessage = getRuntimeLastErrorMessage();

      if (lastErrorMessage) {
        rejectOnce(new Error(lastErrorMessage));
        return;
      }

      resolveOnce(resolveRecordValue(result, key));
    };

    try {
      const maybePromise = storageArea.get(key, callback) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((result) => {
            resolveOnce(resolveRecordValue(result, key));
          })
          .catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

export function setItemsWithCompatibility(storageArea: StorageAreaLike, items: Record<string, unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(toError(error));
    };

    const callback = (): void => {
      const lastErrorMessage = getRuntimeLastErrorMessage();

      if (lastErrorMessage) {
        rejectOnce(new Error(lastErrorMessage));
        return;
      }

      resolveOnce();
    };

    try {
      const maybePromise = storageArea.set(items, callback) as Promise<unknown> | void;

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(() => {
            resolveOnce();
          })
          .catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}
