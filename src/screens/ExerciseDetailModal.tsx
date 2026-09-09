import { useEffect, useMemo, useState } from 'react';
import type { ExerciseEntry } from '../models/admin';
import type { UserExerciseConfig, WeightUnit, WorkoutLogEntry } from '../models/user';
import { getRawBaseUrl, mediaGifUrl, mediaImageUrl } from '../services/adminFetcher';
import {
  findLogForDay,
  subscribeExerciseHistory,
  upsertExerciseLog,
} from '../services/logService';
import {
  currentTimestamp,
  generateLogId,
  generateSessionId,
  getCurrentCalendarDay,
  youtubeVideoIdFromUrl,
} from '../utils/id';
import { Button, ErrorText, Field } from '../components/ui';

function parseTargetReps(targetReps: string): number {
  const n = parseInt(targetReps.split('-')[0] ?? targetReps, 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function formatSets(log: WorkoutLogEntry | null, timed: boolean): string {
  if (!log || log.performedSets <= 0) return '—';
  if (timed) {
    return log.performedReps.map((s) => `${s}s`).join(' · ') || '—';
  }
  return log.performedReps
    .map((reps, i) => {
      const w = log.performedWeights[i] ?? log.performedWeight;
      return w > 0 ? `${reps}×${w}${log.unit.toLowerCase()}` : `${reps}`;
    })
    .join(' · ');
}

export function ExerciseDetailModal({
  uid,
  planId,
  dayId,
  config,
  exercise,
  todayLog,
  previousLog,
  onClose,
  onSaved,
}: {
  uid: string;
  planId: string;
  dayId: string;
  config: UserExerciseConfig;
  exercise: ExerciseEntry | null;
  todayLog: WorkoutLogEntry | null;
  previousLog: WorkoutLogEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const timed = config.targetTimeSeconds > 0;
  const name = exercise?.name ?? todayLog?.exerciseName ?? 'Exercise';
  const targetSets = Math.max(1, config.targetSets || 3);
  const defaultReps = timed ? config.targetTimeSeconds || parseTargetReps(config.targetReps) : parseTargetReps(config.targetReps);

  const [sets, setSets] = useState(todayLog?.performedSets || targetSets);
  const [reps, setReps] = useState<number[]>(() => {
    if (todayLog?.performedReps?.length) return [...todayLog.performedReps];
    return Array.from({ length: targetSets }, () => defaultReps);
  });
  const [weights, setWeights] = useState<number[]>(() => {
    if (todayLog?.performedWeights?.length) return [...todayLog.performedWeights];
    const w = todayLog?.performedWeight || config.targetWeight || previousLog?.performedWeight || 0;
    return Array.from({ length: targetSets }, () => w);
  });
  const [unit, setUnit] = useState<WeightUnit>(todayLog?.unit || config.unit || 'KG');
  const [notes, setNotes] = useState(todayLog?.sessionNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutLogEntry[]>([]);
  const [mediaOpen, setMediaOpen] = useState(true);

  const rawBase = useMemo(() => getRawBaseUrl(), []);
  const gifs = exercise?.media.gifs ?? [];
  const images = exercise?.media.images ?? [];
  const cues = images.filter((n) => n.includes('_cues_'));
  const doDonts = images.filter((n) => n.includes('_do_dont_'));
  const videos = exercise?.media.videos ?? [];

  useEffect(() => {
    return subscribeExerciseHistory(uid, config.userExerciseId, setHistory);
  }, [uid, config.userExerciseId]);

  function resizeArrays(nextSets: number) {
    const s = Math.max(1, Math.min(20, nextSets));
    setSets(s);
    setReps((prev) => {
      const copy = [...prev];
      while (copy.length < s) copy.push(defaultReps);
      return copy.slice(0, s);
    });
    setWeights((prev) => {
      const copy = [...prev];
      const fill = copy[copy.length - 1] ?? config.targetWeight ?? 0;
      while (copy.length < s) copy.push(fill);
      return copy.slice(0, s);
    });
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const calendarDay = getCurrentCalendarDay();
      const existing = await findLogForDay(uid, config.userExerciseId, calendarDay);
      const weightsTrim = weights.slice(0, sets);
      const repsTrim = reps.slice(0, sets);
      const avg =
        weightsTrim.filter((w) => w > 0).length > 0
          ? weightsTrim.filter((w) => w > 0).reduce((a, b) => a + b, 0) /
            weightsTrim.filter((w) => w > 0).length
          : 0;

      const log: WorkoutLogEntry = {
        logId: existing?.logId ?? generateLogId(),
        userExerciseId: config.userExerciseId,
        exerciseId: config.exerciseId,
        exerciseName: name,
        performedSets: sets,
        performedReps: repsTrim,
        performedWeight: avg,
        performedWeights: weightsTrim,
        unit,
        performedTimeSeconds: timed ? repsTrim.reduce((a, b) => a + b, 0) : 0,
        sessionNotes: notes,
        sessionId: generateSessionId(uid, planId, dayId, calendarDay),
        performedAt: existing?.performedAt ?? currentTimestamp(),
        calendarDay,
        userPlanId: planId,
        userId: uid,
      };

      await upsertExerciseLog(uid, log);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop detail-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="detail-header">
          <h2>{name}</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <p className="detail-targets">
          Target: {config.targetSets} × {config.targetReps}
          {timed ? 's' : ''}
          {!timed && config.targetWeight > 0 ? ` @ ${config.targetWeight} ${config.unit}` : ''}
        </p>

        <div className="session-compare">
          <div>
            <strong>Last session</strong>
            <p>{formatSets(previousLog, timed)}</p>
            {previousLog && (
              <span className="muted">{previousLog.calendarDay}</span>
            )}
          </div>
          <div>
            <strong>Today</strong>
            <p>{formatSets(todayLog, timed)}</p>
          </div>
        </div>

        <div className="set-controls">
          <Field
            label="Sets"
            type="number"
            min={1}
            max={20}
            value={sets}
            onChange={(e) => resizeArrays(Number(e.target.value) || 1)}
          />
          {!timed && (
            <div className="unit-toggle">
              <button
                type="button"
                className={unit === 'KG' ? 'chip selected' : 'chip'}
                onClick={() => setUnit('KG')}
              >
                KG
              </button>
              <button
                type="button"
                className={unit === 'LB' ? 'chip selected' : 'chip'}
                onClick={() => setUnit('LB')}
              >
                LB
              </button>
            </div>
          )}
        </div>

        <div className="set-rows">
          {Array.from({ length: sets }).map((_, i) => (
            <div className="set-row" key={i}>
              <span className="set-label">Set {i + 1}</span>
              <input
                className="field-input set-input"
                type="number"
                inputMode="numeric"
                value={reps[i] ?? 0}
                onChange={(e) => {
                  const next = [...reps];
                  next[i] = Number(e.target.value) || 0;
                  setReps(next);
                }}
                aria-label={timed ? `Seconds set ${i + 1}` : `Reps set ${i + 1}`}
              />
              <span className="muted">{timed ? 'sec' : 'reps'}</span>
              {!timed && (
                <>
                  <input
                    className="field-input set-input"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={weights[i] ?? 0}
                    onChange={(e) => {
                      const next = [...weights];
                      next[i] = Number(e.target.value) || 0;
                      setWeights(next);
                    }}
                    aria-label={`Weight set ${i + 1}`}
                  />
                  <span className="muted">{unit.toLowerCase()}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <Field
          label="Session notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />

        {error && <ErrorText>{error}</ErrorText>}

        <Button variant="primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save log'}
        </Button>

        {(gifs.length > 0 || cues.length > 0 || doDonts.length > 0 || videos.length > 0) && (
          <div className="media-section">
            <button
              type="button"
              className="collapse-toggle"
              onClick={() => setMediaOpen((v) => !v)}
            >
              {mediaOpen ? '▾' : '▸'} Media & tips
            </button>
            {mediaOpen && (
              <div className="media-grid">
                {gifs.map((g) => (
                  <img key={g} src={mediaGifUrl(rawBase, g)} alt={`${name} gif`} className="media-img" />
                ))}
                {cues.map((c) => (
                  <img key={c} src={mediaImageUrl(rawBase, c)} alt="Cue" className="media-img" />
                ))}
                {doDonts.map((d) => (
                  <img key={d} src={mediaImageUrl(rawBase, d)} alt="Do/Don't" className="media-img" />
                ))}
                {videos.map((url) => {
                  const id = youtubeVideoIdFromUrl(url);
                  const thumb = id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="video-thumb"
                    >
                      {thumb ? <img src={thumb} alt="Video" /> : <span>Video</span>}
                    </a>
                  );
                })}
                {exercise?.instructionsText && (
                  <p className="tips-text">{exercise.instructionsText}</p>
                )}
                {exercise?.cuesText && <p className="tips-text">{exercise.cuesText}</p>}
                {exercise?.commonMistakesText && (
                  <p className="tips-text mistakes">{exercise.commonMistakesText}</p>
                )}
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <h3>History</h3>
            <ul className="history-list">
              {history.slice(0, 12).map((h) => (
                <li key={h.logId}>
                  <span>{h.calendarDay}</span>
                  <span>{formatSets(h, timed)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
