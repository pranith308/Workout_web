export function generateId(prefix: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}_${suffix}`;
}

export const generateUserPlanId = () => generateId('userplan');
export const generateUserDayId = () => generateId('uday');
export const generateUserExerciseId = () => generateId('uex');
export const generateLogId = () => generateId('log');

export function currentTimestamp(): string {
  return new Date().toISOString();
}

export function getCurrentCalendarDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateSessionId(
  userId: string,
  planId: string,
  dayId: string,
  calendarDay: string,
): string {
  return `sess_${userId}_${planId}_${dayId}_${calendarDay}`;
}

export function youtubeVideoIdFromUrl(url: string): string | null {
  const u = url.trim();
  if (u.includes('youtu.be/')) {
    const id = u.split('youtu.be/')[1]?.split(/[?#]/)[0]?.trim();
    return id || null;
  }
  if (u.includes('youtube.com/shorts/')) {
    const id = u.split('youtube.com/shorts/')[1]?.split(/[?#/]/)[0]?.trim();
    return id || null;
  }
  if (u.includes('youtube.com/embed/')) {
    const id = u.split('youtube.com/embed/')[1]?.split(/[?#/]/)[0]?.trim();
    return id || null;
  }
  if (u.includes('youtube.com') && u.includes('v=')) {
    const id = u.split('v=')[1]?.split(/[&#]/)[0]?.trim();
    return id || null;
  }
  return null;
}
