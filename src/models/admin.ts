export type MuscleGroup =
  | 'CHEST'
  | 'BACK'
  | 'SHOULDERS'
  | 'BICEPS'
  | 'TRICEPS'
  | 'LEGS'
  | 'GLUTES'
  | 'CORE'
  | 'FULL_BODY'
  | 'CARDIO'
  | 'OTHER';

export type ExerciseType = 'COMPOUND' | 'ISOLATION' | 'CARDIO' | 'OTHER';

export interface ExerciseMedia {
  images: string[];
  gifs: string[];
  videos: string[];
}

export interface ExerciseEntry {
  exerciseId: string;
  name: string;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  exerciseType: ExerciseType;
  media: ExerciseMedia;
  instructionsText: string;
  commonMistakesText: string;
  cuesText: string;
  isDeleted: boolean;
  lastUpdatedAt: string;
}

export interface TemplateExerciseRef {
  exerciseId: string;
  orderIndex: number;
  defaultSets: number;
  defaultReps: number;
  unit: string;
}

export interface WorkoutDayTemplate {
  dayId: string;
  name: string;
  orderIndex: number;
  exercises: TemplateExerciseRef[];
}

export interface AdminWorkoutPlanTemplate {
  templateId: string;
  templateCode: string;
  name: string;
  description: string;
  notes: string;
  workoutDays: WorkoutDayTemplate[];
  lastUpdatedAt: string;
  isDeleted: boolean;
  isPublic: boolean;
}

export interface RemoteMetadata {
  lastUpdatedTimestamp: string;
  exercises: string[];
  templates: string[];
  meals?: string[];
  foods?: string[];
  recipes?: string[];
  mediaHashes?: Record<string, string>;
}

export interface CatalogCache {
  lastUpdatedTimestamp: string;
  templates: AdminWorkoutPlanTemplate[];
  exerciseIds: string[];
  exerciseCount: number;
  syncedAt: string;
}
