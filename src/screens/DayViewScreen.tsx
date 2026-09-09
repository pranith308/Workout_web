import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserWorkoutPlan } from '../models/user';
import { isCustomPlan, subscribePlan, updatePlan } from '../services/planService';
import { generateUserDayId } from '../utils/id';
import { Button, Card, ErrorText, LoadingSpinner, Screen } from '../components/ui';

export function DayViewScreen() {
  const { planId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<UserWorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const custom = plan ? isCustomPlan(plan) : false;
  const days = [...(plan?.workoutDays ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  async function addDay() {
    if (!user || !plan || !custom) return;
    setBusy(true);
    try {
      const index = plan.workoutDays.length;
      await updatePlan(user.uid, {
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add day');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="top-bar">
        <h1>{plan?.name ?? 'Workout Plan'}</h1>
        <div className="top-bar-actions">
          {custom && (
            <Button variant="ghost" onClick={() => navigate(`/plans/${planId}/edit`)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/plans')}>
            Back
          </Button>
        </div>
      </div>

      {plan?.description && (
        <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 0 }}>{plan.description}</p>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {loading ? (
        <LoadingSpinner label="Loading days…" />
      ) : days.length === 0 ? (
        <div className="empty-state">
          <p>No days in this plan.</p>
          {custom && <p>Tap + to add a day, or Edit to build the plan.</p>}
        </div>
      ) : (
        <ul className="plan-list">
          {days.map((day) => (
            <li key={day.userDayId}>
              <Card
                variant="day"
                onClick={() => navigate(`/plans/${planId}/days/${day.userDayId}`)}
              >
                <p className="plan-card-title">{day.name}</p>
                <p className="plan-card-meta">
                  {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {custom && (
        <button
          className="fab"
          aria-label="Add day"
          disabled={busy || days.length >= 14}
          onClick={() => void addDay()}
        >
          +
        </button>
      )}
    </Screen>
  );
}
