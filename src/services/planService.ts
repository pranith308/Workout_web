import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { MAX_PLANS_PER_USER } from '../constants';
import type { AdminWorkoutPlanTemplate, CatalogCache } from '../models/admin';
import type { UserWorkoutDay, UserWorkoutPlan, WeightUnit } from '../models/user';
import {
  currentTimestamp,
  generateUserDayId,
  generateUserExerciseId,
  generateUserPlanId,
} from '../utils/id';
import { getTemplateByCode } from './catalogStore';
import { getDb } from './firebase';

function plansCollection(uid: string) {
  return collection(getDb(), 'users', uid, 'plans');
}

export function subscribePlans(
  uid: string,
  onChange: (plans: UserWorkoutPlan[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(plansCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const plans = snap.docs.map((d) => d.data() as UserWorkoutPlan);
      onChange(plans);
    },
    (err) => onError?.(err),
  );
}

export function subscribePlan(
  uid: string,
  planId: string,
  onChange: (plan: UserWorkoutPlan | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), 'users', uid, 'plans', planId),
    (snap) => {
      if (!snap.exists()) onChange(null);
      else onChange(snap.data() as UserWorkoutPlan);
    },
    (err) => onError?.(err),
  );
}

export async function updatePlan(uid: string, plan: UserWorkoutPlan): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid, 'plans', plan.userPlanId), plan);
}

export async function deletePlan(uid: string, planId: string): Promise<void> {
  const db = getDb();
  const logsQ = query(collection(db, 'users', uid, 'logs'), where('userPlanId', '==', planId));
  const logsSnap = await getDocs(logsQ);
  const batch = writeBatch(db);
  logsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'users', uid, 'plans', planId));
  await batch.commit();
}

function templateToUserPlan(
  template: AdminWorkoutPlanTemplate,
  uid: string,
  customName?: string,
): UserWorkoutPlan {
  return {
    userPlanId: generateUserPlanId(),
    userId: uid,
    sourceTemplateId: template.templateId,
    name: customName?.trim() || template.name,
    description: template.description,
    notes: template.notes,
    workoutDays: template.workoutDays.map((day) => ({
      userDayId: generateUserDayId(),
      name: day.name,
      orderIndex: day.orderIndex,
      exercises: day.exercises.map((ref) => {
        const unitUpper = ref.unit.toUpperCase();
        let unit: WeightUnit = 'KG';
        let timeSecs = 0;
        if (unitUpper === 'LB') unit = 'LB';
        else if (unitUpper === 'SECONDS') timeSecs = ref.defaultReps;

        return {
          userExerciseId: generateUserExerciseId(),
          exerciseId: ref.exerciseId,
          targetSets: ref.defaultSets,
          targetReps: String(ref.defaultReps),
          targetWeight: 0,
          unit,
          targetTimeSeconds: timeSecs,
          userNotes: '',
        };
      }),
    })),
    createdAt: currentTimestamp(),
  };
}

export async function createPlanFromTemplateCode(
  uid: string,
  catalog: CatalogCache,
  templateCode: string,
  existingCount: number,
): Promise<UserWorkoutPlan> {
  if (existingCount >= MAX_PLANS_PER_USER) {
    throw new Error(`Maximum ${MAX_PLANS_PER_USER} plans reached. Delete one to add another.`);
  }

  const template = getTemplateByCode(catalog, templateCode);
  if (!template) {
    throw new Error(`Template "${templateCode}" not found. Refresh catalog and try again.`);
  }

  const plan = templateToUserPlan(template, uid);
  await setDoc(doc(getDb(), 'users', uid, 'plans', plan.userPlanId), plan);
  return plan;
}

export async function createPlanFromTemplate(
  uid: string,
  template: AdminWorkoutPlanTemplate,
  existingCount: number,
  customName?: string,
): Promise<UserWorkoutPlan> {
  if (existingCount >= MAX_PLANS_PER_USER) {
    throw new Error(`Maximum ${MAX_PLANS_PER_USER} plans reached. Delete one to add another.`);
  }

  const plan = templateToUserPlan(template, uid, customName);
  await setDoc(doc(getDb(), 'users', uid, 'plans', plan.userPlanId), plan);
  return plan;
}

export async function createCustomPlan(
  uid: string,
  name: string,
  numberOfDays: number,
  existingCount: number,
  description = '',
): Promise<UserWorkoutPlan> {
  if (existingCount >= MAX_PLANS_PER_USER) {
    throw new Error(`Maximum ${MAX_PLANS_PER_USER} plans reached. Delete one to add another.`);
  }
  if (!name.trim()) throw new Error('Plan name is required.');
  if (numberOfDays < 1 || numberOfDays > 14) throw new Error('Enter 1–14 days.');

  const workoutDays: UserWorkoutDay[] = Array.from({ length: numberOfDays }, (_, index) => ({
    userDayId: generateUserDayId(),
    name: `Day ${index + 1}`,
    orderIndex: index,
    exercises: [],
  }));

  const plan: UserWorkoutPlan = {
    userPlanId: generateUserPlanId(),
    userId: uid,
    sourceTemplateId: null,
    name: name.trim(),
    description: description.trim(),
    notes: '',
    workoutDays,
    createdAt: currentTimestamp(),
  };

  await setDoc(doc(getDb(), 'users', uid, 'plans', plan.userPlanId), plan);
  return plan;
}

export function isCustomPlan(plan: UserWorkoutPlan): boolean {
  return plan.sourceTemplateId == null;
}
