import { MAX_IDLE_HOURS, MIN_IDLE_HOURS } from "../settings-store.js";

export function parseIdleHours(rawValue: string): number | null {
  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < MIN_IDLE_HOURS || parsed > MAX_IDLE_HOURS) {
    return null;
  }

  return parsed;
}
