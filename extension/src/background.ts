const LOG_PREFIX = "[tab-suspender]";

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, details);
}

chrome.runtime.onInstalled.addListener(() => {
  log("Installed skeleton extension. Suspension logic not enabled yet.");
});

chrome.runtime.onStartup.addListener(() => {
  log("Startup detected. Waiting for future plans to enable logic.");
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: { id?: string } | undefined,
    sendResponse: (response: unknown) => void
  ) => {
  const typedMessage = message as { type?: string } | null | undefined;

  if (typedMessage?.type === "PING") {
    sendResponse({ ok: true, phase: "skeleton" });
    return;
  }

  log("Ignored message in skeleton mode.", { message, sender: sender?.id });
  }
);
