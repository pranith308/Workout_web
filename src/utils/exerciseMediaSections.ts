import type { ExerciseEntry } from '../models/admin';

export type HowToSectionId = 'commonMistakes' | 'otherGifs' | 'tipsTricks' | 'videos';

export type HowToSection = {
  id: HowToSectionId;
  title: string;
  gifs: string[];
  images: string[];
  videos: string[];
};

export function classifyExerciseMedia(exercise: ExerciseEntry | null) {
  const gifs = exercise?.media.gifs ?? [];
  const images = exercise?.media.images ?? [];
  const videos = exercise?.media.videos ?? [];
  const primaryGif = gifs[0] ?? null;
  const otherGifs = gifs.slice(1);
  const cueImages = images.filter((n) => n.includes('_cues_'));
  const doDontImages = images.filter((n) => n.includes('_do_dont_'));

  const sections: HowToSection[] = [];

  if (doDontImages.length > 0) {
    sections.push({
      id: 'commonMistakes',
      title: 'Common Mistakes',
      gifs: [],
      images: doDontImages,
      videos: [],
    });
  }
  if (otherGifs.length > 0) {
    sections.push({
      id: 'otherGifs',
      title: 'Other Gifs',
      gifs: otherGifs,
      images: [],
      videos: [],
    });
  }
  if (cueImages.length > 0) {
    sections.push({
      id: 'tipsTricks',
      title: 'Tips & Tricks',
      gifs: [],
      images: cueImages,
      videos: [],
    });
  }
  if (videos.length > 0) {
    sections.push({
      id: 'videos',
      title: 'Videos',
      gifs: [],
      images: [],
      videos,
    });
  }

  const warmupFlatGifs = gifs;
  const warmupFlatImages = images;

  return { primaryGif, sections, warmupFlatGifs, warmupFlatImages, videos };
}
