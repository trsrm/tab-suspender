function getRuntimeLastErrorMessage(): string | null {
  const runtime = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime;
  const message = runtime?.lastError?.message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function hasThen(value: unknown): value is Promise<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function resolvePromiseOrCallback<T>(
  invoke: (callback: (result: T | undefined) => void) => Promise<T> | void,
  onResolveFromCallback: (result: T | undefined) => T
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (result: T): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(toError(error));
    };

    const callback = (result: T | undefined): void => {
      if (settled) {
        return;
      }

      const runtimeErrorMessage = getRuntimeLastErrorMessage();
      if (runtimeErrorMessage) {
        rejectOnce(new Error(runtimeErrorMessage));
        return;
      }

      resolveOnce(onResolveFromCallback(result));
    };

    try {
      const maybePromise = invoke(callback);
      if (hasThen(maybePromise)) {
        maybePromise.then((result) => resolveOnce(result as T)).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

export function queryTabsWithCompat<TTab = unknown>(queryInfo: Record<string, unknown>): Promise<TTab[]> {
  const tabsApi = chrome?.tabs;

  if (!tabsApi || typeof tabsApi.query !== "function") {
    return Promise.reject(new Error("Tabs API unavailable."));
  }

  return resolvePromiseOrCallback<TTab[]>(
    (callback) =>
      tabsApi.query(
        queryInfo as Parameters<typeof tabsApi.query>[0],
        callback as Parameters<typeof tabsApi.query>[1]
      ) as Promise<TTab[]> | void,
    (result) => (Array.isArray(result) ? result : [])
  );
}

export function updateTabWithCompat(tabId: number, updateProperties: Record<string, unknown>): Promise<void> {
  const tabsApi = chrome?.tabs;

  if (!tabsApi || typeof tabsApi.update !== "function") {
    return Promise.reject(new Error("Tabs API unavailable."));
  }

  return resolvePromiseOrCallback<void>(
    (callback) =>
      tabsApi.update(
        tabId as Parameters<typeof tabsApi.update>[0],
        updateProperties as Parameters<typeof tabsApi.update>[1],
        callback as Parameters<typeof tabsApi.update>[2]
      ) as Promise<void> | void,
    () => undefined
  );
}

export function createTabWithCompat(url: string): Promise<void> {
  const tabsApi = chrome?.tabs;

  if (!tabsApi || typeof tabsApi.create !== "function") {
    return Promise.reject(new Error("Tabs API unavailable."));
  }

  return resolvePromiseOrCallback<void>(
    (callback) =>
      tabsApi.create(
        { url } as Parameters<typeof tabsApi.create>[0],
        callback as Parameters<typeof tabsApi.create>[1]
      ) as Promise<void> | void,
    () => undefined
  );
}

export function sendRuntimeMessageWithCompat<TResponse>(request: unknown): Promise<TResponse | undefined> {
  const runtimeApi = chrome?.runtime;

  if (!runtimeApi || typeof runtimeApi.sendMessage !== "function") {
    return Promise.reject(new Error("Runtime messaging is unavailable."));
  }

  return resolvePromiseOrCallback<TResponse | undefined>(
    (callback) =>
      runtimeApi.sendMessage(
        request as Parameters<typeof runtimeApi.sendMessage>[0],
        callback as Parameters<typeof runtimeApi.sendMessage>[1]
      ) as Promise<TResponse> | void,
    (result) => result
  );
}
