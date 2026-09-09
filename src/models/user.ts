export type WeightUnit = 'KG' | 'LB';

export interface UserExerciseConfig {
  userExerciseId: string;
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  targetWeight: number;
  unit: WeightUnit;
  targetTimeSeconds: number;
  userNotes: string;
}

export interface UserWorkoutDay {
  userDayId: string;
  name: string;
  orderIndex: number;
  exercises: UserExerciseConfig[];
}

export interface UserWorkoutPlan {
  userPlanId: string;
  userId: string;
  sourceTemplateId: string | null;
  name: string;
  description: string;
  notes: string;
  workoutDays: UserWorkoutDay[];
  createdAt: string;
}

export interface UserProfile {
  username: string;
  usernameKey: string;
  createdAt: string;
}

export interface WorkoutLogEntry {
  logId: string;
  userExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  performedSets: number;
  performedReps: number[];
  performedWeight: number;
  performedWeights: number[];
  unit: WeightUnit;
  performedTimeSeconds: number;
  sessionNotes: string;
  sessionId: string;
  performedAt: string;
  calendarDay: string;
  userPlanId: string;
  userId: string;
}
