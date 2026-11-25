// Time helpers. The prototype week runs Monday (day 0) to Sunday (day 6).
// Absolute time is minutes since Monday 00:00.

export const DAY = 1440;
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// The sample week begins on Monday 23 November 2026.
export const WEEK_START_DATE = 23;

export const abs = (day, minute) => day * DAY + minute;
export const dayOf = (t) => Math.floor(t / DAY);
export const minuteOf = (t) => ((t % DAY) + DAY) % DAY;
export const hm = (h, m = 0) => h * 60 + m;

export function fmtTime(minute) {
  const m = ((minute % DAY) + DAY) % DAY;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return mm === 0 ? `${h}${suffix}` : `${h}:${String(mm).padStart(2, '0')}${suffix}`;
}

export function fmtAbs(t) {
  return `${DAYS_SHORT[dayOf(t)]} ${fmtTime(minuteOf(t))}`;
}

export function fmtRange(c) {
  return `${fmtTime(c.start)} to ${fmtTime(c.end)}`;
}

export function fmtDate(day) {
  return `${DAYS[day]} ${WEEK_START_DATE + day} November`;
}

export function fmtDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const overlaps = (a, b) => a.from < b.to && b.from < a.to;

// Real dates for the sample week, which begins on Monday 23 November 2026.
// Singapore is eight hours ahead of UTC all year, with no daylight saving.
export const WEEK_START_UTC = Date.UTC(2026, 10, 23);
export const SGT_OFFSET_MIN = 480;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A day number can run past the sample week: day 12 is Saturday 5 December.
export function dateOfDay(day) {
  return new Date(WEEK_START_UTC + day * 86400000);
}

export function fmtDayDate(day) {
  const d = dateOfDay(day);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}${d.getUTCFullYear() === 2026 ? '' : ` ${d.getUTCFullYear()}`}`;
}
