import { useEffect, useState } from 'react';
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
import { loadCatalogCache, syncCatalogFromGit } from '../services/catalogStore';
import { Button, Card, ErrorText, Field, LoadingSpinner, Screen } from '../components/ui';

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
  const [mode, setMode] = useState<'menu' | 'custom'>('menu');
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
          />
          <Button
            variant="primary"
            disabled={adding || !code.trim()}
            onClick={() => onAddByCode(code.trim())}
            aria-label="Add plan by code"
          >
            →
          </Button>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <Button variant="ghost" disabled={adding} onClick={() => setMode('custom')}>
            Custom plan
          </Button>
        </div>

        {publicTemplates.length > 0 && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '16px 0 8px' }}>
              Or choose a template:
            </p>
            <div className="modal-actions">
              {publicTemplates.slice(0, 12).map((t) => (
                <Button
                  key={t.templateId}
                  variant="ghost"
                  disabled={adding}
                  onClick={() => onBrowseSelect(t.templateCode)}
                >
                  {t.templateCode} — {t.name}
                </Button>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <Button variant="ghost" onClick={onClose} disabled={adding}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
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

  async function handleSyncCatalog() {
    setSyncError(null);
    setSyncing(true);
    try {
      const next = await syncCatalogFromGit();
      setCatalog(next);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Catalog sync failed');
    } finally {
      setSyncing(false);
    }
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
  }

  return (
    <Screen>
      <div className="top-bar">
        <h1>Workout Plans</h1>
        <div className="top-bar-actions">
          <Button variant="ghost" onClick={handleSyncCatalog} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync catalog'}
          </Button>
          <Button variant="ghost" onClick={() => logout()}>
            Out
          </Button>
        </div>
      </div>

      {username && (
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 12px' }}>Signed in as {username}</p>
      )}

      <div className="catalog-banner">
        {catalog ? (
          <>
            Catalog: {catalog.templates.length} templates, {catalog.exerciseCount} exercises
            <br />
            <span style={{ opacity: 0.75 }}>
              Updated {new Date(catalog.syncedAt).toLocaleString()}
            </span>
          </>
        ) : (
          <>No catalog cached yet. Tap &quot;Sync catalog&quot; to load exercises and templates from Git.</>
        )}
      </div>

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
            <li key={plan.userPlanId}>
              <Card variant="plan" onClick={() => navigate(`/plans/${plan.userPlanId}`)}>
                <p className="plan-card-title">{plan.name}</p>
                {plan.description && <p className="plan-card-desc">{plan.description}</p>}
                <p className="plan-card-meta">
                  {plan.workoutDays.length} day{plan.workoutDays.length === 1 ? '' : 's'}
                  {isCustomPlan(plan) ? ' · custom' : ' · from template'}
                </p>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  {isCustomPlan(plan) && (
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/plans/${plan.userPlanId}/edit`);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(plan.userPlanId);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
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
    </Screen>
  );
}
