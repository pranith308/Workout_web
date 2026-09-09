import type { ExerciseEntry } from '../models/admin';
import { fetchExercise, getRawBaseUrl } from './adminFetcher';

const CACHE_KEY = 'workout_web_exercises_v1';

type ExerciseMap = Record<string, ExerciseEntry>;

function loadMap(): ExerciseMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ExerciseMap;
  } catch {
    return {};
  }
}

function saveMap(map: ExerciseMap): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

export function getCachedExercise(exerciseId: string): ExerciseEntry | null {
  return loadMap()[exerciseId] ?? null;
}

export function getAllCachedExercises(): ExerciseEntry[] {
  return Object.values(loadMap())
    .filter((e) => !e.isDeleted)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureExercises(exerciseIds: string[]): Promise<ExerciseMap> {
  const map = loadMap();
  const rawBaseUrl = getRawBaseUrl();
  const missing = [...new Set(exerciseIds)].filter((id) => !map[id]);

  if (missing.length > 0) {
    const results = await Promise.allSettled(
      missing.map((id) => fetchExercise(rawBaseUrl, id)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.isDeleted) {
        map[r.value.exerciseId] = r.value;
      }
    }
    saveMap(map);
  }

  return map;
}
