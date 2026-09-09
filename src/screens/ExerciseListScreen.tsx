import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ExerciseEntry } from '../models/admin';
import type { UserExerciseConfig, UserWorkoutPlan, WorkoutLogEntry } from '../models/user';
import { ensureExercises } from '../services/exerciseCache';
import { getPreviousExerciseLog, subscribeLogsForDay } from '../services/logService';
import { isCustomPlan, subscribePlan, updatePlan } from '../services/planService';
import { getRawBaseUrl, mediaGifUrl } from '../services/adminFetcher';
import { generateUserExerciseId, getCurrentCalendarDay } from '../utils/id';
import { Button, Card, ErrorText, LoadingSpinner, Screen } from '../components/ui';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { ExercisePickerModal } from './ExercisePickerModal';

function summaryLine(log: WorkoutLogEntry | undefined, timed: boolean): string {
  if (!log) return 'Not logged today';
  if (timed) {
    return log.performedReps.map((s) => `${s}s`).join(' · ');
  }
  return log.performedReps
    .map((reps, i) => {
      const w = log.performedWeights[i] ?? log.performedWeight;
      return w > 0 ? `${reps}×${w}` : `${reps}`;
    })
    .join(' · ');
}

export function ExerciseListScreen() {
  const { planId = '', dayId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const calendarDay = getCurrentCalendarDay();

  const [plan, setPlan] = useState<UserWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Record<string, ExerciseEntry>>({});
  const [todayLogs, setTodayLogs] = useState<WorkoutLogEntry[]>([]);
  const [selected, setSelected] = useState<UserExerciseConfig | null>(null);
  const [previousLog, setPreviousLog] = useState<WorkoutLogEntry | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const rawBase = useMemo(() => getRawBaseUrl(), []);

  const day = plan?.workoutDays.find((d) => d.userDayId === dayId) ?? null;
  const custom = plan ? isCustomPlan(plan) : false;

  useEffect(() => {
    if (!user || !planId) return;
    setLoading(true);
    return subscribePlan(
      user.uid,
      planId,
      (next) => {
        setPlan(next);
        setLoading(false);
        if (!next) setError('Plan not found.');
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [user, planId]);

  useEffect(() => {
    if (!day) return;
    const ids = day.exercises.map((e) => e.exerciseId);
    void ensureExercises(ids).then(setExercises);
  }, [day]);

  useEffect(() => {
    if (!user || !planId) return;
    return subscribeLogsForDay(user.uid, planId, calendarDay, setTodayLogs);
  }, [user, planId, calendarDay]);

  const logByExercise = useMemo(() => {
    const map = new Map<string, WorkoutLogEntry>();
    for (const log of todayLogs) map.set(log.userExerciseId, log);
    return map;
  }, [todayLogs]);

  async function openExercise(config: UserExerciseConfig) {
    if (!user) return;
    const prev = await getPreviousExerciseLog(user.uid, config.userExerciseId, calendarDay);
    setPreviousLog(prev);
    setSelected(config);
  }

  async function addExercise(entry: ExerciseEntry) {
    if (!user || !plan || !day || !custom) return;
    const config: UserExerciseConfig = {
      userExerciseId: generateUserExerciseId(),
      exerciseId: entry.exerciseId,
      targetSets: 3,
      targetReps: '10',
      targetWeight: 0,
      unit: 'KG',
      targetTimeSeconds: 0,
      userNotes: '',
    };
    await updatePlan(user.uid, {
      ...plan,
      workoutDays: plan.workoutDays.map((d) =>
        d.userDayId === dayId ? { ...d, exercises: [...d.exercises, config] } : d,
      ),
    });
    setExercises((prev) => ({ ...prev, [entry.exerciseId]: entry }));
    setShowPicker(false);
  }

  async function removeExercise(userExerciseId: string) {
    if (!user || !plan || !custom) return;
    if (!window.confirm('Remove this exercise from the day?')) return;
    await updatePlan(user.uid, {
      ...plan,
      workoutDays: plan.workoutDays.map((d) =>
        d.userDayId === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.userExerciseId !== userExerciseId) }
          : d,
      ),
    });
  }

  return (
    <Screen>
      <div className="top-bar">
        <h1>{day?.name ?? 'Workout'}</h1>
        <div className="top-bar-actions">
          {custom && (
            <Button variant="ghost" onClick={() => navigate(`/plans/${planId}/edit`)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate(`/plans/${planId}`)}>
            Back
          </Button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {plan?.name} · {calendarDay}
      </p>

      {error && <ErrorText>{error}</ErrorText>}

      {loading || !day ? (
        <LoadingSpinner label="Loading exercises…" />
      ) : day.exercises.length === 0 ? (
        <div className="empty-state">
          <p>No exercises on this day.</p>
          {custom && <p>Tap + to add exercises from the catalog.</p>}
        </div>
      ) : (
        <ul className="plan-list">
          {day.exercises.map((config) => {
            const entry = exercises[config.exerciseId];
            const name = entry?.name ?? config.exerciseId;
            const today = logByExercise.get(config.userExerciseId);
            const timed = config.targetTimeSeconds > 0;
            const gif = entry?.media.gifs[0];
            return (
              <li key={config.userExerciseId}>
                <Card variant="surface" onClick={() => void openExercise(config)}>
                  <div className="exercise-row">
                    {gif && (
                      <img
                        className="exercise-thumb"
                        src={mediaGifUrl(rawBase, gif)}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className="exercise-meta">
                      <p className="plan-card-title">{name}</p>
                      <p className="plan-card-meta">
                        Target {config.targetSets}×{config.targetReps}
                        {timed ? 's' : ''}
                      </p>
                      <p className={today ? 'logged-line' : 'muted'}>{summaryLine(today, timed)}</p>
                      {custom && (
                        <Button
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeExercise(config.userExerciseId);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {custom && (
        <button className="fab" aria-label="Add exercise" onClick={() => setShowPicker(true)}>
          +
        </button>
      )}

      {showPicker && (
        <ExercisePickerModal onClose={() => setShowPicker(false)} onPick={(ex) => void addExercise(ex)} />
      )}

      {selected && user && (
        <ExerciseDetailModal
          uid={user.uid}
          planId={planId}
          dayId={dayId}
          config={selected}
          exercise={exercises[selected.exerciseId] ?? null}
          todayLog={logByExercise.get(selected.userExerciseId) ?? null}
          previousLog={previousLog}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      )}
    </Screen>
  );
}
