import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { useNow } from '../components/ui';
import { fmtClock } from '../lib/format';

export default function ActiveWorkout() {
  const active = useStore((s) => s.active);
  const mutate = useStore((s) => s.mutateActive);
  const finish = useStore((s) => s.finishWorkout);
  const discard = useStore((s) => s.discardWorkout);
  const navigate = useNavigate();
  const now = useNow(1000);
  const [confirming, setConfirming] = useState(false);

  if (!active) return <Navigate to="/train" replace />;

  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const doFinish = () => {
    const id = finish();
    if (id) navigate(`/history/${id}?summary=1`, { replace: true });
    else navigate('/', { replace: true });
  };

  return (
    <div className="page">
      <div className="wk-header">
        <div className="row between">
          <button className="btn ghost" onClick={() => navigate(-1)} aria-label="Minimalizovat">
            ⌄
          </button>
          <div className="center">
            <div className="bold" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 17 }}>
              {fmtClock((now - active.startedAt) / 1000)}
            </div>
            <div className="tiny muted">
              {done}/{total} sérií
            </div>
          </div>
          <button className="btn ok sm" onClick={() => (done < total || done === 0 ? setConfirming(true) : doFinish())}>
            Dokončit
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
        onClick={() => {
          if (window.confirm('Opravdu zrušit trénink? Nic se neuloží.')) {
            discard();
            navigate('/', { replace: true });
          }
        }}
      >
        Zrušit trénink
      </button>

      {confirming && (
        <div className="overlay" onClick={() => setConfirming(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-body">
              {done === 0 ? (
                <>
                  <h2>Žádná dokončená série</h2>
                  <p className="muted">Trénink bez dokončených sérií se neuloží. Chceš ho zahodit?</p>
                  <div className="grid-2">
                    <button className="btn" onClick={() => setConfirming(false)}>
                      Pokračovat
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => {
                        discard();
                        navigate('/', { replace: true });
                      }}
                    >
                      Zahodit
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Dokončit trénink?</h2>
                  <p className="muted">
                    Máš {total - done} nedokončených sérií. Ty se při uložení vynechají.
                  </p>
                  <div className="grid-2">
                    <button className="btn" onClick={() => setConfirming(false)}>
                      Pokračovat
                    </button>
                    <button className="btn ok" onClick={doFinish}>
                      Dokončit
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
