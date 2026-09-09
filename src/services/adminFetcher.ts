import {
  DEFAULT_GIT_REPO_URL,
  GITHUB_EXERCISES_PATH,
  GITHUB_TEMPLATES_PATH,
  GITHUB_MEDIA_GIFS_PATH,
  GITHUB_MEDIA_IMAGES_PATH,
} from '../constants';
import type {
  AdminWorkoutPlanTemplate,
  ExerciseEntry,
  RemoteMetadata,
} from '../models/admin';

export function gitUrlToRawBaseUrl(gitUrl: string): string {
  let url = gitUrl.trim();
  if (url.endsWith('.git')) url = url.slice(0, -4);
  if (url.endsWith('/')) url = url.slice(0, -1);
  url = url.replace('github.com', 'raw.githubusercontent.com');
  return `${url}/main/`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function fetchMetadata(rawBaseUrl: string): Promise<RemoteMetadata> {
  const json = await fetchText(`${rawBaseUrl}metadata.json`);
  return JSON.parse(json) as RemoteMetadata;
}

export async function fetchExercise(
  rawBaseUrl: string,
  exerciseId: string,
): Promise<ExerciseEntry> {
  const json = await fetchText(`${rawBaseUrl}${GITHUB_EXERCISES_PATH}${exerciseId}.json`);
  return JSON.parse(json) as ExerciseEntry;
}

export async function fetchTemplate(
  rawBaseUrl: string,
  templateCode: string,
): Promise<AdminWorkoutPlanTemplate> {
  const json = await fetchText(
    `${rawBaseUrl}${GITHUB_TEMPLATES_PATH}template_${templateCode}.json`,
  );
  return JSON.parse(json) as AdminWorkoutPlanTemplate;
}

export async function fetchAllPublicTemplates(
  rawBaseUrl: string,
  templateCodes: string[],
): Promise<AdminWorkoutPlanTemplate[]> {
  const results = await Promise.allSettled(
    templateCodes.map((code) => fetchTemplate(rawBaseUrl, code)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<AdminWorkoutPlanTemplate> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((t) => !t.isDeleted);
}

export function mediaGifUrl(rawBaseUrl: string, fileName: string): string {
  return `${rawBaseUrl}${GITHUB_MEDIA_GIFS_PATH}${encodeURIComponent(fileName)}`;
}

export function mediaImageUrl(rawBaseUrl: string, fileName: string): string {
  return `${rawBaseUrl}${GITHUB_MEDIA_IMAGES_PATH}${encodeURIComponent(fileName)}`;
}

export function getRawBaseUrl(gitUrl: string = DEFAULT_GIT_REPO_URL): string {
  return gitUrlToRawBaseUrl(gitUrl);
}
