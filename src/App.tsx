import { useEffect } from 'react';
import { BookOpen, CalendarDays, Dumbbell, House, LayoutGrid, Play } from 'lucide-react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/store';
import { RestTimerBar } from './components/RestTimer';
import { Toasts, useNow } from './components/ui';
import { fmtClock } from './lib/format';
import Home from './pages/Home';
import Train from './pages/Train';
import RoutineEditor from './pages/RoutineEditor';
import ActiveWorkout from './pages/ActiveWorkout';
import History from './pages/History';
import WorkoutDetail from './pages/WorkoutDetail';
import WorkoutEdit from './pages/WorkoutEdit';
import Exercises from './pages/Exercises';
import ExerciseDetail from './pages/ExerciseDetail';
import More from './pages/More';
import Stats from './pages/Stats';
import Measure from './pages/Measure';
import Tools from './pages/Tools';
import Achievements from './pages/Achievements';
import Planner from './pages/Planner';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
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
        Přehled
      </NavLink>
      <NavLink to="/history">
        <span className="i">
          <CalendarDays size={21} strokeWidth={2.4} />
        </span>
        Historie
      </NavLink>
      <NavLink to={active ? '/workout' : '/train'} className="train">
        <span className="i">{active ? <Play size={24} fill="#fff" strokeWidth={2.4} /> : <Dumbbell size={24} strokeWidth={2.6} />}</span>
        Trénink
      </NavLink>
      <NavLink to="/exercises">
        <span className="i">
          <BookOpen size={21} strokeWidth={2.4} />
        </span>
        Cviky
      </NavLink>
      <NavLink to="/more">
        <span className="i">
          <LayoutGrid size={21} strokeWidth={2.4} />
        </span>
        Více
      </NavLink>
    </nav>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const fullscreen = pathname === '/workout' || /^\/history\/[^/]+\/edit$/.test(pathname) || pathname.startsWith('/routines/');
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <>
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
        <Route path="/stats" element={<Stats />} />
        <Route path="/measure" element={<Measure />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!fullscreen && <ActiveBar />}
      {!fullscreen && <BottomNav />}
      <RestTimerBar aboveNav={!fullscreen} />
      <Toasts />
    </>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  useTheme();
  if (!hydrated) return <div className="splash">Načítám…</div>;
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
