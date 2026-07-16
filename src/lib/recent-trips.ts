// Browser-side memory (localStorage) — the app has no accounts, so the browser
// remembers which trips you've visited and who you are in each one. All
// functions are SSR-safe (no-op / empty when `window` is undefined).

const RECENT_KEY = "trip-splitter:recent";
const ME_PREFIX = "trip-splitter:me:";
const MAX_RECENT = 30;

export interface RecentTrip {
  publicId: string;
  name: string;
  currency: string;
  /** ms epoch of the last visit — most recent first. */
  visitedAt: number;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/** Recent trips, most-recently-visited first. */
export function getRecentTrips(): RecentTrip[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentTrip[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((t) => t && typeof t.publicId === "string")
      .sort((a, b) => (b.visitedAt ?? 0) - (a.visitedAt ?? 0));
  } catch {
    return [];
  }
}

/** Record (or refresh) a trip in the recent list. Called when a trip page loads. */
export function rememberTrip(trip: { publicId: string; name: string; currency: string }): void {
  if (!hasWindow()) return;
  const now = Date.now();
  const others = getRecentTrips().filter((t) => t.publicId !== trip.publicId);
  const next = [{ ...trip, visitedAt: now }, ...others].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage full / disabled — silently ignore
  }
}

/** Drop a trip from the recent list (e.g. it was deleted or the user hides it). */
export function forgetTrip(publicId: string): void {
  if (!hasWindow()) return;
  const next = getRecentTrips().filter((t) => t.publicId !== publicId);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.localStorage.removeItem(ME_PREFIX + publicId);
  } catch {
    // ignore
  }
}

/** The trip_members.id the user has claimed as "me" for this trip, or null. */
export function getMe(publicId: string): number | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(ME_PREFIX + publicId);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Remember which participant the user is in this trip. */
export function setMe(publicId: string, memberId: number): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(ME_PREFIX + publicId, String(memberId));
  } catch {
    // ignore
  }
}

/** Forget the "me" choice for this trip (e.g. to switch identity). */
export function clearMe(publicId: string): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(ME_PREFIX + publicId);
}
