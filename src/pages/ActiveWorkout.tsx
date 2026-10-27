import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { confirmDialog, undoToast, useNow } from '../components/ui';
import { fmtClock } from '../lib/format';
import { t, tn } from '../i18n';

export default function ActiveWorkout() {
  const active = useStore((s) => s.active);
  const mutate = useStore((s) => s.mutateActive);
  const finish = useStore((s) => s.finishWorkout);
  const discard = useStore((s) => s.discardWorkout);
  const navigate = useNavigate();
  const now = useNow(1000);
  const [confirming, setConfirming] = useState(false);

  // Keep the screen on during a workout: a sleeping phone pauses the rest timer and its alert.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const take = async () => {
      try {
        if (document.visibilityState === 'visible' && !lock) {
          lock = (await navigator.wakeLock?.request('screen')) ?? null;
          lock?.addEventListener('release', () => (lock = null));
          if (cancelled) void lock?.release();
        }
      } catch {
        /* not supported or refused */
      }
    };
    void take();
    document.addEventListener('visibilitychange', take);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', take);
      void lock?.release();
    };
  }, []);

  if (!active) return <Navigate to="/train" replace />;

  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const discardWithUndo = () => {
    const copy = structuredClone(active);
    discard();
    navigate('/', { replace: true });
    undoToast(t('Workout discarded'), () => {
      useStore.getState().restoreActive(copy);
      navigate('/workout');
    });
  };

  const doFinish = () => {
    const id = finish();
    if (id) navigate(`/history/${id}?summary=1`, { replace: true });
    else navigate('/', { replace: true });
  };

  return (
    <div className="page">
      <div className="wk-header">
        <div className="row between">
          <button className="btn ghost" onClick={() => navigate(-1)} aria-label={t('Minimize')}>
            ⌄
          </button>
          <div className="center">
            <div className="bold" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 17 }}>
              {fmtClock((now - active.startedAt) / 1000)}
            </div>
            <div className="tiny muted">
              {t('{done}/{total} sets', { done, total })}
            </div>
          </div>
          <button className="btn ok sm" onClick={() => (done < total || done === 0 ? setConfirming(true) : doFinish())}>
            {t('Finish')}
          </button>
        </div>
        <div className="progress" style={{ marginTop: 10, height: 4 }}>
          <div style={{ width: `${total ? (done / total) * 100 : 0}%`, background: 'var(--ok)' }} />
        </div>
      </div>

      <input
        className="wk-title"
        value={active.name}
        onChange={(e) => {
          const v = e.target.value;
          mutate((w) => {
            w.name = v;
          });
        }}
      />

      <WorkoutEditor workout={active} mutate={mutate} live />

      <button
        className="btn danger block mt-l"
        onClick={async () => {
          if (await confirmDialog(t('Discard workout?'), t("Nothing from this workout will be saved."), t('Discard workout'))) {
            discardWithUndo();
          }
        }}
      >
        {t('Discard workout')}
      </button>

      {confirming && (
        <div className="overlay" onClick={() => setConfirming(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-body">
              {done === 0 ? (
                <>
                  <h2>{t('No sets completed')}</h2>
                  <p className="muted">{t("A workout with no completed sets won't be saved. Discard it?")}</p>
                  <div className="grid-2">
                    <button className="btn" onClick={() => setConfirming(false)}>
                      {t('Continue')}
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => {
                        discardWithUndo();
                      }}
                    >
                      {t('Discard')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{t('Finish workout?')}</h2>
                  <p className="muted">
                    {tn(
                      total - done,
                      "You have {n} unfinished set. It won't be saved.",
                      "You have {n} unfinished sets. They won't be saved.",
                    )}
                  </p>
                  <div className="grid-2">
                    <button className="btn" onClick={() => setConfirming(false)}>
                      {t('Continue')}
                    </button>
                    <button className="btn ok" onClick={doFinish}>
                      {t('Finish')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
