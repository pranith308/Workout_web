import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { CatalogCache } from '../models/admin';
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
  onBrowseSelect,
  onCreateCustom,
  adding,
  error,
}: {
  catalog: CatalogCache | null;
  onClose: () => void;
  onAddByCode: (code: string) => void;
  onBrowseSelect: (code: string) => void;
  onCreateCustom: (name: string, days: number) => void;
  adding: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'custom' | 'browse'>('menu');
  const [customName, setCustomName] = useState('');
  const [customDays, setCustomDays] = useState('3');
  const publicTemplates = catalog?.templates.filter((t) => t.isPublic) ?? [];

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

  if (mode === 'browse') {
    return (
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <h2>Browse templates</h2>
          {publicTemplates.length === 0 ? (
            <p className="muted">No public templates in catalog. Sync catalog first.</p>
          ) : (
            <div className="template-browse-list">
              {publicTemplates.map((t) => (
                <button
                  key={t.templateId}
                  type="button"
                  className="modal-option"
                  disabled={adding}
                  onClick={() => onBrowseSelect(t.templateCode)}
                >
                  {t.templateCode} — {t.name}
                </button>
              ))}
            </div>
          )}
          {error && <ErrorText>{error}</ErrorText>}
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <Button variant="ghost" disabled={adding} onClick={() => setMode('menu')}>
              Back
            </Button>
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

  async function handleBrowseSelect(code: string) {
    if (!user || !catalog) return;
    const template = catalog.templates.find((t) => t.templateCode === code);
    if (!template) return;
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
          onBrowseSelect={handleBrowseSelect}
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
