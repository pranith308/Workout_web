import { useEffect, useMemo, useState } from 'react';
import type { ExerciseEntry } from '../models/admin';
import { ensureExercises, getAllCachedExercises } from '../services/exerciseCache';
import { loadCatalogCache } from '../services/catalogStore';
import { Button, ErrorText, Field } from '../components/ui';

export function ExercisePickerModal({
  onPick,
  onClose,
}: {
  onPick: (exercise: ExerciseEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const catalog = loadCatalogCache();
        const ids = catalog?.exerciseIds ?? [];
        if (ids.length > 0) {
          await ensureExercises(ids);
        }
        if (!cancelled) setExercises(getAllCachedExercises());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load exercises');
          setExercises(getAllCachedExercises());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscleGroup.toLowerCase().includes(q) ||
        e.exerciseId.toLowerCase().includes(q),
    );
  }, [exercises, query]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="detail-header">
          <h2>Add exercise</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <Field
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or muscle…"
          autoFocus
        />

        {error && <ErrorText>{error}</ErrorText>}
        {loading && <p className="muted">Loading exercises…</p>}

        {!loading && filtered.length === 0 && (
          <p className="empty-state">No exercises found. Sync catalog first.</p>
        )}

        <ul className="picker-list">
          {filtered.map((ex) => (
            <li key={ex.exerciseId}>
              <button type="button" className="picker-item" onClick={() => onPick(ex)}>
                <span className="picker-name">{ex.name}</span>
                <span className="muted">{ex.primaryMuscleGroup}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
