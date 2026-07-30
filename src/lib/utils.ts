import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts a datetime-local input string (e.g. "2026-07-31T10:00")
 * into a valid ISO string in the user's local timezone (IST).
 */
export function formatLocalInputToIso(localStr: string | null | undefined): string | null {
  if (!localStr) return null;
  const [datePart, timePart] = localStr.split("T");
  if (datePart && timePart) {
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
      const localDate = new Date(year, month - 1, day, hours, minutes, 0);
      return localDate.toISOString();
    }
  }
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Safely formats any ISO date or local date string for display in Indian Standard Time (IST) / local time.
 */
export function formatDisplayDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-IN", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
