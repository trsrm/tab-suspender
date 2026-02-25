export const MAX_RESTORABLE_URL_LENGTH = 2048;

const RESTORABLE_PROTOCOLS = new Set(["http:", "https:"]);

export type RestorableUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: "missing" | "tooLong" | "invalidProtocol" | "invalidUrl" };

export function validateRestorableUrl(rawUrl: unknown): RestorableUrlValidationResult {
  if (typeof rawUrl !== "string") {
    return { ok: false, reason: "missing" };
  }

  const normalizedUrl = rawUrl.trim();

  if (normalizedUrl.length === 0) {
    return { ok: false, reason: "missing" };
  }

  if (normalizedUrl.length > MAX_RESTORABLE_URL_LENGTH) {
    return { ok: false, reason: "tooLong" };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return { ok: false, reason: "invalidUrl" };
  }

  if (!RESTORABLE_PROTOCOLS.has(parsedUrl.protocol.toLowerCase())) {
    return { ok: false, reason: "invalidProtocol" };
  }

  return {
    ok: true,
    url: normalizedUrl
  };
}
