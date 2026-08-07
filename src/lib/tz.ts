// ============================================================================
// The department operates on Eastern Time. All displayed dates/times, and the
// appointment date picker, use America/New_York regardless of the viewer's
// or server's own timezone. Handles EST/EDT automatically via Intl.
// ============================================================================

export const NY_TZ = "America/New_York";

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: NY_TZ, month: "short", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit",
};
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: NY_TZ, month: "short", day: "numeric", year: "numeric",
};
const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: NY_TZ, month: "short", day: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: NY_TZ, hour: "numeric", minute: "2-digit",
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", DATE_TIME_OPTS);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", DATE_OPTS);
}

export function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", SHORT_DATE_OPTS);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", TIME_OPTS);
}

// ---- datetime-local <input> <-> ISO, both read as NY wall-clock time ------

function nyOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

// ISO -> value for <input type="datetime-local">, shown as NY wall-clock time.
export function isoToNyInput(iso: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

// <input type="datetime-local"> value (typed as NY wall-clock time) -> ISO (UTC).
export function nyInputToIso(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  const naiveUtcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = nyOffsetMinutes(new Date(naiveUtcGuess));
  return new Date(naiveUtcGuess - offset * 60000).toISOString();
}
