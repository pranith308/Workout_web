import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { WorkoutLogEntry } from '../models/user';
import { getDb } from './firebase';

function logsCollection(uid: string) {
  return collection(getDb(), 'users', uid, 'logs');
}

export function subscribeLogsForDay(
  uid: string,
  planId: string,
  calendarDay: string,
  onChange: (logs: WorkoutLogEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Single-field query + client filter (avoids composite index for Phase 2)
  const q = query(logsCollection(uid), where('userPlanId', '==', planId));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs
        .map((d) => d.data() as WorkoutLogEntry)
        .filter((l) => l.calendarDay === calendarDay);
      onChange(logs);
    },
    (err) => onError?.(err),
  );
}

export function subscribeExerciseHistory(
  uid: string,
  userExerciseId: string,
  onChange: (logs: WorkoutLogEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(logsCollection(uid), where('userExerciseId', '==', userExerciseId));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs
        .map((d) => d.data() as WorkoutLogEntry)
        .sort((a, b) => b.calendarDay.localeCompare(a.calendarDay));
      onChange(logs);
    },
    (err) => onError?.(err),
  );
}

export async function getPreviousExerciseLog(
  uid: string,
  userExerciseId: string,
  excludeCalendarDay: string,
): Promise<WorkoutLogEntry | null> {
  const q = query(logsCollection(uid), where('userExerciseId', '==', userExerciseId));
  const snap = await getDocs(q);
  const logs = snap.docs
    .map((d) => d.data() as WorkoutLogEntry)
    .filter((l) => l.calendarDay !== excludeCalendarDay)
    .sort((a, b) => b.calendarDay.localeCompare(a.calendarDay));
  return logs[0] ?? null;
}

export async function upsertExerciseLog(uid: string, log: WorkoutLogEntry): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid, 'logs', log.logId), log);
}

export async function findLogForDay(
  uid: string,
  userExerciseId: string,
  calendarDay: string,
): Promise<WorkoutLogEntry | null> {
  const q = query(logsCollection(uid), where('userExerciseId', '==', userExerciseId));
  const snap = await getDocs(q);
  const match = snap.docs
    .map((d) => d.data() as WorkoutLogEntry)
    .find((l) => l.calendarDay === calendarDay);
  return match ?? null;
}
