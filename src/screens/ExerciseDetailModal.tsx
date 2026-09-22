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
import { classifyExerciseMedia, type HowToSection } from '../utils/exerciseMediaSections';
import { Button, ErrorText, Field } from '../components/ui';

type DetailTab = 'log' | 'howto' | 'dashboard';

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

function lastSetHint(
  setIndex: number,
  timed: boolean,
  previousLog: WorkoutLogEntry | null,
): string | null {
  if (!previousLog || setIndex >= previousLog.performedSets) return null;
  const reps = previousLog.performedReps[setIndex];
  if (reps == null) return null;
  if (timed) return `Last: ${reps}s`;
  const w = previousLog.performedWeights[setIndex] ?? previousLog.performedWeight;
  const u = previousLog.unit.toLowerCase();
  if (w > 0) return `Last: ${reps} reps @ ${w} ${u}`;
  return `Last: ${reps} reps`;
}

function maxWeightInLog(log: WorkoutLogEntry): number {
  const ws =
    log.performedWeights?.length > 0
      ? log.performedWeights.slice(0, log.performedSets)
      : [log.performedWeight];
  return Math.max(0, ...ws);
}

function computeBestSetLabel(history: WorkoutLogEntry[], timed: boolean): string {
  if (history.length === 0) return '—';
  if (timed) {
    let best = 0;
    for (const log of history) {
      for (let i = 0; i < log.performedSets; i++) {
        best = Math.max(best, log.performedReps[i] ?? 0);
      }
    }
    return best > 0 ? `${best}s` : '—';
  }
  let bestReps = 0;
  let bestWeight = 0;
  let unit: WeightUnit = 'KG';
  for (const log of history) {
    for (let i = 0; i < log.performedSets; i++) {
      const w = log.performedWeights[i] ?? log.performedWeight;
      const r = log.performedReps[i] ?? 0;
      if (w > bestWeight || (w === bestWeight && r > bestReps)) {
        bestWeight = w;
        bestReps = r;
        unit = log.unit;
      }
    }
  }
  if (bestWeight > 0) return `${bestReps}×${bestWeight} ${unit.toLowerCase()}`;
  if (bestReps > 0) return `${bestReps} reps`;
  return '—';
}

function WeightTrendChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) {
    return <p className="muted dashboard-empty">Log a few sessions to see trends.</p>;
  }
  const w = 280;
  const h = 120;
  const pad = { t: 8, r: 8, b: 24, l: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;
  const coords = points.map((p, i) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.t + innerH - ((p.value - minV) / span) * innerH;
    return { x, y };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Max weight trend">
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={w - pad.r}
        y2={pad.t + innerH}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        points={polyline}
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--accent)" />
      ))}
      <text x={pad.l} y={h - 4} fill="rgba(255,255,255,0.5)" fontSize="9">
        {points[0]?.label}
      </text>
      <text x={w - pad.r} y={h - 4} fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="end">
        {points[points.length - 1]?.label}
      </text>
    </svg>
  );
}

function TabIcon({ tab, active }: { tab: DetailTab; active: boolean }) {
  const stroke = active ? 'var(--accent)' : 'rgba(255,255,255,0.55)';
  if (tab === 'log') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }
  if (tab === 'howto') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.5 9a3 3 0 1 1 5 2.2c-.8.6-1.5 1.2-1.5 2.3" />
        <circle cx="12" cy="17" r="0.5" fill={stroke} />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 3 5-8" />
    </svg>
  );
}

function MediaAccordionSection({
  section,
  open,
  onToggle,
  name,
  rawBase,
}: {
  section: HowToSection;
  open: boolean;
  onToggle: () => void;
  name: string;
  rawBase: string;
}) {
  return (
    <div className={`media-accordion-item${open ? ' media-accordion-item--open' : ''}`}>
      <button type="button" className="media-accordion-header" onClick={onToggle} aria-expanded={open}>
        <span>{section.title}</span>
        <span className="media-accordion-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="media-accordion-body">
          {section.gifs.map((g) => (
            <img key={g} src={mediaGifUrl(rawBase, g)} alt={`${name} gif`} className="media-img" />
          ))}
          {section.images.map((img) => (
            <img key={img} src={mediaImageUrl(rawBase, img)} alt={section.title} className="media-img" />
          ))}
          {section.videos.map((url) => {
            const id = youtubeVideoIdFromUrl(url);
            const thumb = id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
            return (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="video-thumb">
                {thumb ? <img src={thumb} alt="Video" /> : <span>Video</span>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const warmup = config.targetSets === 0;
  const name = exercise?.name ?? todayLog?.exerciseName ?? 'Exercise';
  const targetSets = Math.max(1, config.targetSets || 3);
  const defaultReps = timed
    ? config.targetTimeSeconds || parseTargetReps(config.targetReps)
    : parseTargetReps(config.targetReps);

  const [tab, setTab] = useState<DetailTab>('log');
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const rawBase = useMemo(() => getRawBaseUrl(), []);
  const mediaLayout = useMemo(() => classifyExerciseMedia(exercise), [exercise]);

  const trendPoints = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.calendarDay.localeCompare(b.calendarDay));
    const recent = sorted.slice(-8);
    if (timed) {
      return recent.map((log) => ({
        label: log.calendarDay.slice(5),
        value: Math.max(0, ...log.performedReps.slice(0, log.performedSets)),
      }));
    }
    return recent.map((log) => ({
      label: log.calendarDay.slice(5),
      value: maxWeightInLog(log),
    }));
  }, [history, timed]);

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

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'howto', label: 'How-to' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="modal-backdrop detail-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal detail-modal detail-modal-tabs"
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

        <div className="detail-tab-panel">
          {tab === 'log' && (
            <>
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

              <div className="set-rows set-rows-cards">
                {Array.from({ length: sets }).map((_, i) => {
                  const hint = lastSetHint(i, timed, previousLog);
                  return (
                    <div className="set-card-block" key={i}>
                      <div className="set-row">
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
                            <span className="set-multiply" aria-hidden>
                              ×
                            </span>
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
                      {hint && <p className="set-card-last">{hint}</p>}
                    </div>
                  );
                })}
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
            </>
          )}

          {tab === 'howto' && (
            <div className="howto-panel">
              {warmup ? (
                <div className="media-grid">
                  {mediaLayout.warmupFlatGifs.map((g) => (
                    <img key={g} src={mediaGifUrl(rawBase, g)} alt={`${name} gif`} className="media-img" />
                  ))}
                  {mediaLayout.warmupFlatImages.map((img) => (
                    <img key={img} src={mediaImageUrl(rawBase, img)} alt="" className="media-img" />
                  ))}
                  {mediaLayout.videos.map((url) => {
                    const id = youtubeVideoIdFromUrl(url);
                    const thumb = id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
                    return (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="video-thumb">
                        {thumb ? <img src={thumb} alt="Video" /> : <span>Video</span>}
                      </a>
                    );
                  })}
                  {!mediaLayout.warmupFlatGifs.length &&
                    !mediaLayout.warmupFlatImages.length &&
                    !mediaLayout.videos.length && (
                      <p className="muted">No media for this exercise. Sync catalog if you expect some.</p>
                    )}
                </div>
              ) : (
                <>
                  {mediaLayout.primaryGif && (
                    <img
                      src={mediaGifUrl(rawBase, mediaLayout.primaryGif)}
                      alt={`${name} demonstration`}
                      className="media-img media-hero"
                    />
                  )}
                  {mediaLayout.sections.map((section) => (
                    <MediaAccordionSection
                      key={section.id}
                      section={section}
                      open={!!openSections[section.id]}
                      onToggle={() => toggleSection(section.id)}
                      name={name}
                      rawBase={rawBase}
                    />
                  ))}
                  {!mediaLayout.primaryGif && mediaLayout.sections.length === 0 && (
                    <p className="muted">No media for this exercise. Sync catalog if you expect some.</p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'dashboard' && (
            <div className="dashboard-panel">
              <div className="dashboard-stats">
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Sessions</span>
                  <span className="dashboard-stat-value">{history.length}</span>
                </div>
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">{timed ? 'Best hold' : 'Best set'}</span>
                  <span className="dashboard-stat-value">{computeBestSetLabel(history, timed)}</span>
                </div>
              </div>

              <h3 className="dashboard-heading">
                {timed ? 'Best time (per session)' : 'Top weight (per session)'}
              </h3>
              <WeightTrendChart points={trendPoints} />

              {history.length > 0 && (
                <div className="history-section">
                  <h3>Recent history</h3>
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
          )}
        </div>

        <nav className="detail-tab-bar" aria-label="Exercise detail sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`detail-tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <TabIcon tab={t.id} active={tab === t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
