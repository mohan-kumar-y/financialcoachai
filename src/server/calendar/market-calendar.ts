/**
 * Market Calendar Service (LLD §13).
 *
 * Single source of truth for "is the market open?" across the platform.
 * Replaces the inline weekday+clock check that used to live in
 * live-quote-poller.ts (which had no holiday awareness).
 *
 * IST conversion reuses the exact same UTC-offset math as the previous inline
 * version: shift the instant by +5h30m and then read UTC fields.
 */

/**
 * NSE trading holidays (ISO yyyy-mm-dd, IST calendar days).
 *
 * IMPORTANT: this is a deliberately conservative list containing only the
 * fixed-date national holidays we are confident about. The full official list
 * (Holi, Id, Diwali, Guru Nanak Jayanti, etc. — all lunar/variable dates)
 * MUST be verified against the annual NSE trading-holiday circular and added
 * here each year. Under-listing is safe (a poll on a closed day simply
 * returns no data); fabricated dates are not.
 */
export const NSE_HOLIDAYS_2026: string[] = [
  "2026-01-26", // Republic Day
  "2026-05-01", // Maharashtra Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-12-25", // Christmas
];

/**
 * Special sessions (e.g. Diwali Muhurat trading), ISO yyyy-mm-dd.
 * Intentionally empty: the 2026 Muhurat date is set by NSE circular and is not
 * something we will guess. Add it when the circular is published.
 */
export const NSE_SPECIAL_SESSIONS_2026: string[] = [];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const REGULAR_OPEN_MIN = 9 * 60 + 15;
const REGULAR_CLOSE_MIN = 15 * 60 + 30;
const PRE_OPEN_START_MIN = 9 * 60;

function toIst(at: Date): Date {
  return new Date(at.getTime() + IST_OFFSET_MS);
}

function istDateKey(at: Date): string {
  return toIst(at).toISOString().slice(0, 10);
}

function istMinutes(at: Date): number {
  const ist = toIst(at);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Build a UTC instant for a given IST calendar day + minute-of-day. */
function fromIstDayMinutes(istDayStart: Date, minutes: number): Date {
  const ist = new Date(istDayStart.getTime());
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() + minutes * 60 * 1000 - IST_OFFSET_MS);
}

export function isTradingDay(date: Date): boolean {
  const ist = toIst(date);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !NSE_HOLIDAYS_2026.includes(istDateKey(date));
}

export function isSpecialSession(date: Date): boolean {
  return NSE_SPECIAL_SESSIONS_2026.includes(istDateKey(date));
}

export function isMarketOpen(at: Date = new Date()): boolean {
  if (!isTradingDay(at)) return false;
  const minutes = istMinutes(at);
  return minutes >= REGULAR_OPEN_MIN && minutes <= REGULAR_CLOSE_MIN;
}

export function currentSession(
  at: Date = new Date(),
): "PRE_OPEN" | "REGULAR" | "CLOSED" | "SPECIAL" {
  if (isSpecialSession(at)) return "SPECIAL";
  if (!isTradingDay(at)) return "CLOSED";
  const minutes = istMinutes(at);
  if (minutes >= PRE_OPEN_START_MIN && minutes < REGULAR_OPEN_MIN) return "PRE_OPEN";
  if (minutes >= REGULAR_OPEN_MIN && minutes <= REGULAR_CLOSE_MIN) return "REGULAR";
  return "CLOSED";
}

/** Next regular-session open timestamp at or after `at`. */
export function nextOpen(at: Date = new Date()): Date {
  let cursor = toIst(at);
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(cursor.getTime());
    const candidate = fromIstDayMinutes(dayStart, REGULAR_OPEN_MIN);
    if (isTradingDay(candidate) && candidate.getTime() >= at.getTime()) return candidate;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    cursor.setUTCHours(0, 0, 0, 0);
  }
  throw new Error("nextOpen: no trading day found within 30 days");
}

/** Next regular-session close timestamp at or after `at`. */
export function nextClose(at: Date = new Date()): Date {
  let cursor = toIst(at);
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(cursor.getTime());
    const candidate = fromIstDayMinutes(dayStart, REGULAR_CLOSE_MIN);
    if (isTradingDay(candidate) && candidate.getTime() >= at.getTime()) return candidate;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    cursor.setUTCHours(0, 0, 0, 0);
  }
  throw new Error("nextClose: no trading day found within 30 days");
}
