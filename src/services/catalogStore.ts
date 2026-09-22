import { CATALOG_CACHE_KEY } from '../constants';
import type { AdminWorkoutPlanTemplate, CatalogCache } from '../models/admin';
import { fetchAllPublicTemplates, fetchMetadata, getRawBaseUrl } from './adminFetcher';
import { ensureExercises } from './exerciseCache';

/** Minimum time between automatic catalog syncs when the home screen is opened. */
export const CATALOG_AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function loadCatalogCache(): CatalogCache | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCache;
    return {
      ...parsed,
      exerciseIds: parsed.exerciseIds ?? [],
    };
  } catch {
    return null;
  }
}

export function saveCatalogCache(cache: CatalogCache): void {
  localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cache));
}

export function isCatalogSyncDue(): boolean {
  const cache = loadCatalogCache();
  if (!cache?.syncedAt) return true;
  const syncedAt = Date.parse(cache.syncedAt);
  if (Number.isNaN(syncedAt)) return true;
  return Date.now() - syncedAt >= CATALOG_AUTO_SYNC_INTERVAL_MS;
}

export function getTemplateByCode(
  cache: CatalogCache | null,
  code: string,
): AdminWorkoutPlanTemplate | undefined {
  if (!cache) return undefined;
  const upper = code.trim().toUpperCase();
  return cache.templates.find((t) => t.templateCode.toUpperCase() === upper);
}

export async function syncCatalogFromGit(): Promise<CatalogCache> {
  const rawBaseUrl = getRawBaseUrl();
  const metadata = await fetchMetadata(rawBaseUrl);
  const templates = await fetchAllPublicTemplates(rawBaseUrl, metadata.templates);

  // Prefetch exercise definitions for pickers / logging (best-effort)
  await ensureExercises(metadata.exercises);

  const cache: CatalogCache = {
    lastUpdatedTimestamp: metadata.lastUpdatedTimestamp,
    templates: templates.filter((t) => t.isPublic),
    exerciseIds: metadata.exercises,
    exerciseCount: metadata.exercises.length,
    syncedAt: new Date().toISOString(),
  };

  saveCatalogCache(cache);
  return cache;
}
