export const MAX_RESTORABLE_URL_LENGTH = 2048;

const RESTORABLE_PROTOCOLS = new Set(["http:", "https:"]);
type RestorableUrlValidationFailureReason = "missing" | "tooLong" | "invalidProtocol" | "invalidUrl";

export type RestorableUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: RestorableUrlValidationFailureReason };

export type RestorableUrlValidationWithMetadataResult =
  | {
      ok: true;
      url: string;
      protocol: string;
      hostname: string;
    }
  | { ok: false; reason: RestorableUrlValidationFailureReason };

export function validateRestorableUrlWithMetadata(rawUrl: unknown): RestorableUrlValidationWithMetadataResult {
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

  const protocol = parsedUrl.protocol.toLowerCase();

  if (!RESTORABLE_PROTOCOLS.has(protocol)) {
    return { ok: false, reason: "invalidProtocol" };
  }

  return {
    ok: true,
    url: normalizedUrl,
    protocol,
    hostname: parsedUrl.hostname
  };
}

export function validateRestorableUrl(rawUrl: unknown): RestorableUrlValidationResult {
  const validation = validateRestorableUrlWithMetadata(rawUrl);

  if (!validation.ok) {
    return validation;
  }

  return { ok: true, url: validation.url };
}
