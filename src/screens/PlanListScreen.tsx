import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AdminWorkoutPlanTemplate, CatalogCache } from '../models/admin';
import { getCachedExercise } from '../services/exerciseCache';
import type { UserWorkoutPlan } from '../models/user';
import {
  createCustomPlan,
  createPlanFromTemplate,
  createPlanFromTemplateCode,
  deletePlan,
  isCustomPlan,
  subscribePlans,
} from '../services/planService';
import { isCatalogSyncDue, loadCatalogCache, syncCatalogFromGit } from '../services/catalogStore';
import {
  Button,
  Card,
  ErrorText,
  Field,
  IconArrowRight,
  IconButton,
  IconLogout,
  IconSync,
  LoadingSpinner,
  Screen,
} from '../components/ui';

const LONG_PRESS_MS = 500;

function templateExerciseCount(template: AdminWorkoutPlanTemplate): number {
  return template.workoutDays.reduce((n, day) => n + day.exercises.length, 0);
}

function sortedWorkoutDays(template: AdminWorkoutPlanTemplate) {
  return [...template.workoutDays].sort((a, b) => a.orderIndex - b.orderIndex);
}

function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    firedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [clear, onLongPress]);

  const end = useCallback(() => {
    clear();
  }, [clear]);

  const consumeIfLongPress = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const pointerHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      start();
    },
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
  };

  return { pointerHandlers, consumeIfLongPress };
}

function PlanActionSheet({
  plan,
  onClose,
  onEdit,
  onDelete,
}: {
  plan: UserWorkoutPlan;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const custom = isCustomPlan(plan);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal plan-action-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-action-title"
      >
        <h2 id="plan-action-title">{plan.name}</h2>
        <div className="modal-actions">
          {custom && (
            <Button variant="ghost" onClick={onEdit}>
              Edit plan
            </Button>
          )}
          <Button variant="danger" onClick={onDelete}>
            Delete plan
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddPlanModal({
  catalog,
  onClose,
  onAddByCode,
  onAddTemplate,
  onCreateCustom,
  adding,
  error,
}: {
  catalog: CatalogCache | null;
  onClose: () => void;
  onAddByCode: (code: string) => void;
  onAddTemplate: (template: AdminWorkoutPlanTemplate) => void;
  onCreateCustom: (name: string, days: number) => void;
  adding: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'custom' | 'browse' | 'browse-preview'>('menu');
  const [customName, setCustomName] = useState('');
  const [customDays, setCustomDays] = useState('3');
  const [previewTemplate, setPreviewTemplate] = useState<AdminWorkoutPlanTemplate | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const publicTemplates =
    catalog?.templates.filter((t) => t.isPublic).sort((a, b) => a.name.localeCompare(b.name)) ?? [];

  function openTemplatePreview(template: AdminWorkoutPlanTemplate) {
    setPreviewTemplate(template);
    setExpandedDays({});
    setMode('browse-preview');
  }

  function toggleDay(dayId: string) {
    setExpandedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  }

  if (mode === 'custom') {
    return (
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <h2>Custom plan</h2>
          <Field
            label="Plan name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g., Home gym"
            disabled={adding}
          />
          <Field
            label="Number of days"
            type="number"
            min={1}
            max={14}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            disabled={adding}
          />
          {error && <ErrorText>{error}</ErrorText>}
          <div className="modal-actions">
            <Button
              variant="primary"
              disabled={adding || !customName.trim()}
              onClick={() => onCreateCustom(customName.trim(), Number(customDays) || 3)}
            >
              {adding ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="ghost" disabled={adding} onClick={() => setMode('menu')}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'browse-preview' && previewTemplate) {
    const days = sortedWorkoutDays(previewTemplate);
    const totalExercises = templateExerciseCount(previewTemplate);

    return (
      <div className="modal-backdrop template-browse-backdrop" onClick={onClose} role="presentation">
        <div
          className="modal modal-template-browse"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="template-browse-toolbar">
            <Button variant="ghost" disabled={adding} onClick={() => setMode('browse')}>
              ‹ Templates
            </Button>
            <span className="template-browse-toolbar-title">Preview</span>
            <Button variant="ghost" onClick={onClose} disabled={adding}>
              Close
            </Button>
          </div>

          <div className="template-browse-scroll">
            <h2 className="template-preview-name">{previewTemplate.name}</h2>
            {previewTemplate.description?.trim() && (
              <p className="template-preview-desc">{previewTemplate.description}</p>
            )}
            <p className="template-preview-stats muted">
              {days.length} day{days.length === 1 ? '' : 's'} · {totalExercises} exercise
              {totalExercises === 1 ? '' : 's'}
            </p>

            <div className="template-day-list">
              {days.map((day, index) => {
                const open = !!expandedDays[day.dayId];
                const count = day.exercises.length;
                return (
                  <div
                    key={day.dayId}
                    className={`media-accordion-item${open ? ' media-accordion-item--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="media-accordion-header"
                      onClick={() => toggleDay(day.dayId)}
                      aria-expanded={open}
                    >
                      <span className="media-accordion-title-block">
                        <span>
                          Day {index + 1} — {day.name}
                        </span>
                        {!open && (
                          <span className="media-accordion-sub muted">
                            {count} exercise{count === 1 ? '' : 's'} — tap to expand
                          </span>
                        )}
                      </span>
                      <span className="media-accordion-chevron" aria-hidden>
                        {open ? '▾' : '▸'}
                      </span>
                    </button>
                    {open && (
                      <div className="media-accordion-body">
                        <ul className="template-day-exercises">
                          {day.exercises.map((ref) => {
                            const entry = getCachedExercise(ref.exerciseId);
                            const label = entry?.name ?? ref.exerciseId;
                            return (
                              <li key={`${day.dayId}-${ref.exerciseId}-${ref.orderIndex}`}>{label}</li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <ErrorText>{error}</ErrorText>}
          </div>

          <div className="template-browse-footer">
            <Button
              variant="primary"
              disabled={adding}
              onClick={() => onAddTemplate(previewTemplate)}
            >
              {adding ? 'Adding…' : `Add ${previewTemplate.name}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'browse') {
    return (
      <div className="modal-backdrop template-browse-backdrop" onClick={onClose} role="presentation">
        <div
          className="modal modal-template-browse"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="template-browse-toolbar">
            <Button variant="ghost" disabled={adding} onClick={() => setMode('menu')}>
              ‹ Back
            </Button>
            <span className="template-browse-toolbar-title">Templates</span>
            <Button variant="ghost" onClick={onClose} disabled={adding}>
              Close
            </Button>
          </div>

          <div className="template-browse-scroll">
            {publicTemplates.length === 0 ? (
              <p className="muted">No public templates in catalog. Sync catalog first.</p>
            ) : (
              <div className="template-pick-list">
                {publicTemplates.map((t) => {
                  const dayCount = t.workoutDays.length;
                  return (
                    <button
                      key={t.templateId}
                      type="button"
                      className="template-pick-row"
                      disabled={adding}
                      onClick={() => openTemplatePreview(t)}
                    >
                      <span className="template-pick-text">
                        <span className="template-pick-name">{t.name}</span>
                        <span className="template-pick-meta muted">
                          {dayCount} day{dayCount === 1 ? '' : 's'} · tap to preview
                        </span>
                      </span>
                      <span className="template-pick-chevron" aria-hidden>
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {error && <ErrorText>{error}</ErrorText>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>Add Workout Plan</h2>

        <div className="row-input">
          <Field
            label="Template code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., PPL"
            disabled={adding}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim() && !adding) onAddByCode(code.trim());
            }}
          />
          <Button
            variant="primary"
            className="btn-circle-submit"
            disabled={adding || !code.trim()}
            onClick={() => onAddByCode(code.trim())}
            aria-label="Add plan by template code"
          >
            <IconArrowRight />
          </Button>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="modal-option"
            disabled={adding}
            onClick={() => setMode('custom')}
          >
            Custom plan
          </button>
          <button
            type="button"
            className="modal-option"
            disabled={adding}
            onClick={() => setMode('browse')}
          >
            Browse templates
          </button>
          <Button variant="ghost" onClick={onClose} disabled={adding}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanListItem({
  plan,
  onOpen,
  onShowActions,
}: {
  plan: UserWorkoutPlan;
  onOpen: () => void;
  onShowActions: () => void;
}) {
  const { pointerHandlers, consumeIfLongPress } = useLongPress(onShowActions);

  return (
    <li
      className="plan-list-item"
      onContextMenu={(e) => {
        e.preventDefault();
        onShowActions();
      }}
    >
      <div {...pointerHandlers}>
        <Card
          variant="plan"
          onClick={() => {
            if (consumeIfLongPress()) return;
            onOpen();
          }}
        >
          <p className="plan-card-title">{plan.name}</p>
          {plan.description && <p className="plan-card-desc">{plan.description}</p>}
          <p className="plan-card-meta">
            {plan.workoutDays.length} day{plan.workoutDays.length === 1 ? '' : 's'}
            {isCustomPlan(plan) ? ' · custom' : ' · from template'}
          </p>
        </Card>
      </div>
    </li>
  );
}

export function PlanListScreen() {
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<UserWorkoutPlan[]>([]);
  const [catalog, setCatalog] = useState<CatalogCache | null>(() => loadCatalogCache());
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<UserWorkoutPlan | null>(null);
  const syncToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (syncToastTimer.current) clearTimeout(syncToastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingPlans(true);
    const unsub = subscribePlans(
      user.uid,
      (next) => {
        setPlans(next);
        setLoadingPlans(false);
      },
      (err) => {
        setPlanError(err.message);
        setLoadingPlans(false);
      },
    );
    return unsub;
  }, [user]);

  function showSyncToast(message: string) {
    setSyncToast(message);
    if (syncToastTimer.current) clearTimeout(syncToastTimer.current);
    syncToastTimer.current = setTimeout(() => setSyncToast(null), 4000);
  }

  async function runCatalogSync() {
    setSyncError(null);
    setSyncing(true);
    try {
      const next = await syncCatalogFromGit();
      setCatalog(next);
      showSyncToast(
        `Catalog synced · ${next.templates.length} templates, ${next.exerciseCount} exercises`,
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Catalog sync failed');
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!user || !isCatalogSyncDue()) return;
    void runCatalogSync();
  }, [user]);

  async function handleSyncCatalog() {
    await runCatalogSync();
  }

  async function handleAddByCode(code: string) {
    if (!user || !catalog) return;
    setAddError(null);
    setAdding(true);
    try {
      await createPlanFromTemplateCode(user.uid, catalog, code, plans.length);
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add plan');
    } finally {
      setAdding(false);
    }
  }

  async function handleAddTemplate(template: AdminWorkoutPlanTemplate) {
    if (!user) return;
    setAddError(null);
    setAdding(true);
    try {
      await createPlanFromTemplate(user.uid, template, plans.length);
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add plan');
    } finally {
      setAdding(false);
    }
  }

  async function handleCreateCustom(name: string, days: number) {
    if (!user) return;
    setAddError(null);
    setAdding(true);
    try {
      const plan = await createCustomPlan(user.uid, name, days, plans.length);
      setShowAdd(false);
      navigate(`/plans/${plan.userPlanId}/edit`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not create plan');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(planId: string) {
    if (!user) return;
    if (!window.confirm('Delete this plan and its logs?')) return;
    await deletePlan(user.uid, planId);
    setActionPlan(null);
  }

  return (
    <Screen>
      <div className="top-bar">
        <h1>Workout Plans</h1>
        <div className="top-bar-actions">
          <IconButton label="Sync catalog" onClick={() => void handleSyncCatalog()} disabled={syncing}>
            <IconSync spinning={syncing} />
          </IconButton>
          <IconButton label="Log out" onClick={() => void logout()}>
            <IconLogout />
          </IconButton>
        </div>
      </div>

      {username && (
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 12px' }}>Signed in as {username}</p>
      )}

      {syncError && <ErrorText>{syncError}</ErrorText>}
      {planError && <ErrorText>{planError}</ErrorText>}

      {loadingPlans ? (
        <LoadingSpinner label="Loading plans…" />
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <p>No workout plans yet.</p>
          <p>Tap + to add a template or create a custom plan.</p>
        </div>
      ) : (
        <ul className="plan-list">
          {plans.map((plan) => (
            <PlanListItem
              key={plan.userPlanId}
              plan={plan}
              onOpen={() => navigate(`/plans/${plan.userPlanId}`)}
              onShowActions={() => setActionPlan(plan)}
            />
          ))}
        </ul>
      )}

      {syncToast && (
        <div className="sync-toast" role="status" aria-live="polite">
          {syncToast}
        </div>
      )}

      <button
        className="fab"
        aria-label="Add plan"
        onClick={() => {
          setAddError(null);
          setShowAdd(true);
        }}
      >
        +
      </button>

      {showAdd && (
        <AddPlanModal
          catalog={catalog}
          onClose={() => setShowAdd(false)}
          onAddByCode={handleAddByCode}
          onAddTemplate={handleAddTemplate}
          onCreateCustom={handleCreateCustom}
          adding={adding}
          error={addError}
        />
      )}

      {actionPlan && (
        <PlanActionSheet
          plan={actionPlan}
          onClose={() => setActionPlan(null)}
          onEdit={() => {
            const id = actionPlan.userPlanId;
            setActionPlan(null);
            navigate(`/plans/${id}/edit`);
          }}
          onDelete={() => void handleDelete(actionPlan.userPlanId)}
        />
      )}
    </Screen>
  );
}
