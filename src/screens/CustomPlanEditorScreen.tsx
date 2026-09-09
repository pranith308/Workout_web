import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ExerciseEntry } from '../models/admin';
import type { UserExerciseConfig, UserWorkoutPlan } from '../models/user';
import { ensureExercises } from '../services/exerciseCache';
import { isCustomPlan, subscribePlan, updatePlan } from '../services/planService';
import { generateUserDayId, generateUserExerciseId } from '../utils/id';
import { Button, ErrorText, Field, LoadingSpinner, Screen } from '../components/ui';
import { ExercisePickerModal } from './ExercisePickerModal';

export function CustomPlanEditorScreen() {
  const { planId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<UserWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [editingTargets, setEditingTargets] = useState<UserExerciseConfig | null>(null);
  const [targetSets, setTargetSets] = useState('3');
  const [targetReps, setTargetReps] = useState('10');
  const [targetWeight, setTargetWeight] = useState('0');

  useEffect(() => {
    if (!user || !planId) return;
    return subscribePlan(
      user.uid,
      planId,
      (next) => {
        setPlan(next);
        setLoading(false);
        if (!next) {
          setError('Plan not found.');
          return;
        }
        if (!isCustomPlan(next)) {
          setError('Only custom plans can be edited.');
          return;
        }
        setName(next.name);
        setDescription(next.description);
        const ids = next.workoutDays.flatMap((d) => d.exercises.map((e) => e.exerciseId));
        void ensureExercises(ids).then((map) => {
          const label: Record<string, string> = {};
          for (const id of ids) label[id] = map[id]?.name ?? id;
          setNames(label);
        });
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [user, planId]);

  async function persist(next: UserWorkoutPlan) {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlan(user.uid, next);
      setPlan(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta() {
    if (!plan) return;
    await persist({ ...plan, name: name.trim() || plan.name, description: description.trim() });
  }

  async function renameDay(dayId: string, dayName: string) {
    if (!plan) return;
    const next = {
      ...plan,
      workoutDays: plan.workoutDays.map((d) =>
        d.userDayId === dayId ? { ...d, name: dayName.trim() || d.name } : d,
      ),
    };
    await persist(next);
  }

  async function addDay() {
    if (!plan) return;
    const index = plan.workoutDays.length;
    const next = {
      ...plan,
      workoutDays: [
        ...plan.workoutDays,
        {
          userDayId: generateUserDayId(),
          name: `Day ${index + 1}`,
          orderIndex: index,
          exercises: [],
        },
      ],
    };
    await persist(next);
  }

  async function deleteDay(dayId: string) {
    if (!plan) return;
    if (!window.confirm('Delete this day and its exercises?')) return;
    const filtered = plan.workoutDays
      .filter((d) => d.userDayId !== dayId)
      .map((d, i) => ({ ...d, orderIndex: i }));
    await persist({ ...plan, workoutDays: filtered });
  }

  async function addExercise(exercise: ExerciseEntry) {
    if (!plan || !pickerDayId) return;
    const config: UserExerciseConfig = {
      userExerciseId: generateUserExerciseId(),
      exerciseId: exercise.exerciseId,
      targetSets: 3,
      targetReps: '10',
      targetWeight: 0,
      unit: 'KG',
      targetTimeSeconds: 0,
      userNotes: '',
    };
    const next = {
      ...plan,
      workoutDays: plan.workoutDays.map((d) =>
        d.userDayId === pickerDayId ? { ...d, exercises: [...d.exercises, config] } : d,
      ),
    };
    setNames((prev) => ({ ...prev, [exercise.exerciseId]: exercise.name }));
    setPickerDayId(null);
    await persist(next);
  }

  async function removeExercise(dayId: string, userExerciseId: string) {
    if (!plan) return;
    const next = {
      ...plan,
      workoutDays: plan.workoutDays.map((d) =>
        d.userDayId === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.userExerciseId !== userExerciseId) }
          : d,
      ),
    };
    await persist(next);
  }

  async function saveTargets() {
    if (!plan || !editingTargets) return;
    const sets = Math.max(1, Number(targetSets) || 1);
    const weight = Number(targetWeight) || 0;
    const next = {
      ...plan,
      workoutDays: plan.workoutDays.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) =>
          e.userExerciseId === editingTargets.userExerciseId
            ? {
                ...e,
                targetSets: sets,
                targetReps: targetReps.trim() || '10',
                targetWeight: weight,
              }
            : e,
        ),
      })),
    };
    setEditingTargets(null);
    await persist(next);
  }

  const days = [...(plan?.workoutDays ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Screen>
      <div className="top-bar">
        <h1>Edit custom plan</h1>
        <div className="top-bar-actions">
          <Button variant="ghost" onClick={() => navigate(`/plans/${planId}`)}>
            Done
          </Button>
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {loading || !plan ? (
        <LoadingSpinner />
      ) : (
        <>
          <Field label="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
          <Button variant="primary" disabled={saving} onClick={() => void saveMeta()}>
            {saving ? 'Saving…' : 'Save plan info'}
          </Button>

          <div className="editor-days">
            {days.map((day) => (
              <div key={day.userDayId} className="editor-day-card">
                <Field
                  label="Day name"
                  value={day.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlan((prev) =>
                      prev
                        ? {
                            ...prev,
                            workoutDays: prev.workoutDays.map((d) =>
                              d.userDayId === day.userDayId ? { ...d, name: value } : d,
                            ),
                          }
                        : prev,
                    );
                  }}
                  onBlur={(e) => void renameDay(day.userDayId, e.target.value)}
                />

                <ul className="editor-exercise-list">
                  {day.exercises.map((ex) => (
                    <li key={ex.userExerciseId} className="editor-exercise-row">
                      <div>
                        <strong>{names[ex.exerciseId] ?? ex.exerciseId}</strong>
                        <p className="muted">
                          {ex.targetSets}×{ex.targetReps}
                          {ex.targetWeight > 0 ? ` @ ${ex.targetWeight} ${ex.unit}` : ''}
                        </p>
                      </div>
                      <div className="editor-row-actions">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingTargets(ex);
                            setTargetSets(String(ex.targetSets));
                            setTargetReps(ex.targetReps);
                            setTargetWeight(String(ex.targetWeight));
                          }}
                        >
                          Targets
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void removeExercise(day.userDayId, ex.userExerciseId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="editor-day-actions">
                  <Button variant="ghost" onClick={() => setPickerDayId(day.userDayId)}>
                    + Exercise
                  </Button>
                  <Button variant="danger" onClick={() => void deleteDay(day.userDayId)}>
                    Delete day
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="ghost" disabled={saving || days.length >= 14} onClick={() => void addDay()}>
            + Add day
          </Button>
        </>
      )}

      {pickerDayId && (
        <ExercisePickerModal onClose={() => setPickerDayId(null)} onPick={(ex) => void addExercise(ex)} />
      )}

      {editingTargets && (
        <div className="modal-backdrop" onClick={() => setEditingTargets(null)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>Edit targets</h2>
            <Field label="Sets" type="number" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} />
            <Field label="Reps" value={targetReps} onChange={(e) => setTargetReps(e.target.value)} placeholder="e.g. 8-10" />
            <Field
              label="Target weight"
              type="number"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
            <div className="modal-actions">
              <Button variant="primary" onClick={() => void saveTargets()}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditingTargets(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
