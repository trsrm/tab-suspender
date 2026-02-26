export function formatCapturedAtMinuteUtc(minute: number): string {
  if (!Number.isFinite(minute) || minute <= 0) {
    return "Capture time unavailable.";
  }

  try {
    const isoMinute = new Date(minute * 60_000).toISOString().slice(0, 16).replace("T", " ");
    return `Captured at ${isoMinute} UTC.`;
  } catch {
    return `Captured at minute ${minute}.`;
  }
}
