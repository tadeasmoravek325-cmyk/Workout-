import { lazy, Suspense, useEffect } from 'react';
import { BookOpen, CalendarDays, Dumbbell, House, LayoutGrid, Play } from 'lucide-react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useStore } from './store/store';
import { RestTimerBar } from './components/RestTimer';
import { Dialogs, Toasts, useNow } from './components/ui';
import { Keypad } from './components/Keypad';
import { topoDataUri } from './lib/topo';
import { DataRecovery, SaveErrorBanner } from './components/DataGuard';
import { useSafety } from './lib/safety';
import { fmtClock } from './lib/format';
import { t } from './i18n';
import Home from './pages/Home';
import Train from './pages/Train';
import ActiveWorkout from './pages/ActiveWorkout';
import History from './pages/History';
import Exercises from './pages/Exercises';
import More from './pages/More';
import { startCloud } from './lib/cloud';
import Onboarding from './pages/Onboarding';

// Secondary screens load on demand, so the first paint only carries Home and the workout itself.
const RoutineEditor = lazy(() => import('./pages/RoutineEditor'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));
const WorkoutEdit = lazy(() => import('./pages/WorkoutEdit'));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'));
const Progression = lazy(() => import('./pages/Progression'));
const Coach = lazy(() => import('./pages/Coach'));
const Stats = lazy(() => import('./pages/Stats'));
const MuscleDetail = lazy(() => import('./pages/MuscleDetail'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Measure = lazy(() => import('./pages/Measure'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const background = useStore((s) => s.settings.background ?? 'none');
  useEffect(() => {
    document.documentElement.dataset.bg = background === 'topo' ? 'topo' : 'none';
  }, [background]);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      // Beige contour lines: pale on dark, deeper sand on light.
      document.documentElement.style.setProperty('--topo', dark ? topoDataUri('#e4d5b7', 0.16) : topoDataUri('#b39a6b', 0.34));
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0a' : '#f4f4f4');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function ActiveBar() {
  const active = useStore((s) => s.active);
  const now = useNow(1000);
  if (!active) return null;
  return (
    <Link to="/workout" className="active-bar">
      <span className="ellipsis">
        <span className="pulse" />
        {active.name}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock((now - active.startedAt) / 1000)}</span>
    </Link>
  );
}

function BottomNav() {
  const active = useStore((s) => s.active);
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="i">
          <House size={21} strokeWidth={2.4} />
        </span>
        {t('Home')}
      </NavLink>
      <NavLink to="/history">
        <span className="i">
          <CalendarDays size={21} strokeWidth={2.4} />
        </span>
        {t('History')}
      </NavLink>
      <NavLink to={active ? '/workout' : '/train'} className="train">
        <span className="i">{active ? <Play size={22} fill="currentColor" strokeWidth={2.4} /> : <Dumbbell size={24} strokeWidth={2.6} />}</span>
        {t('Workout')}
      </NavLink>
      <NavLink to="/exercises">
        <span className="i">
          <BookOpen size={21} strokeWidth={2.4} />
        </span>
        {t('Exercises')}
      </NavLink>
      <NavLink to="/more">
        <span className="i">
          <LayoutGrid size={21} strokeWidth={2.4} />
        </span>
        {t('More')}
      </NavLink>
    </nav>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const fullscreen = pathname === '/workout' || /^\/history\/[^/]+\/edit$/.test(pathname) || pathname.startsWith('/routines/');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <Suspense fallback={<div className="page" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/train" element={<Train />} />
        <Route path="/routines/:id" element={<RoutineEditor />} />
        <Route path="/workout" element={<ActiveWorkout />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<WorkoutDetail />} />
        <Route path="/history/:id/edit" element={<WorkoutEdit />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
        <Route path="/more" element={<More />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/progression" element={<Progression />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/muscles/:id" element={<MuscleDetail />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/measure" element={<Measure />} />
        <Route path="/achievements" element={<Navigate to="/" replace />} />
        <Route path="/planner" element={<Navigate to="/settings" replace />} />
        <Route path="/profile" element={<Navigate to="/stats" replace />} />
        <Route path="/tools" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </Suspense>
      {!fullscreen && <ActiveBar />}
      {!fullscreen && <BottomNav />}
      <RestTimerBar aboveNav={!fullscreen} />
      <Keypad />
      <Toasts />
      <Dialogs />
      <SaveErrorBanner />
    </>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  const loadError = useSafety((s) => s.loadError);
  useTheme();
  useEffect(() => {
    // Never sync on top of data that failed to load: the recovery screen comes first.
    if (hydrated && !loadError) void startCloud();
  }, [hydrated, loadError]);
  if (!hydrated) return <div className="splash">{t('Loading…')}</div>;
  if (loadError) return <DataRecovery />;
  if (!onboarded)
    return (
      <>
        <Onboarding />
        <Toasts />
      </>
    );
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
