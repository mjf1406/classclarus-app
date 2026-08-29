export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function normalizeEndTime(endTime: string): string {
  const parts = endTime.split(":");
  if (parts.length === 2) return `${endTime}:00`;
  return endTime;
}

export function secondsUntilEndTime(endTime: string, nowMs = Date.now()): number {
  const [hours, minutes, seconds = 0] = endTime.split(":").map(Number);
  const now = new Date(nowMs);
  const target = new Date(now);
  target.setHours(hours, minutes, seconds, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

export function durationToSeconds(value: number, unit: "seconds" | "minutes" | "hours"): number {
  switch (unit) {
    case "minutes":
      return value * 60;
    case "hours":
      return value * 3600;
    default:
      return value;
  }
}
