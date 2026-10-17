import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, CloudOff, LogOut, Mail, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { deleteAccount, oauthProviders, signInWith, signInWithPassword, signOut, signUpWithPassword, syncNow, useCloud } from '../lib/cloud';
import { relativeDay } from '../lib/format';
import { confirmDialog, Segmented, Sheet, toast } from './ui';
import { t } from '../i18n';

function statusText(s: ReturnType<typeof useCloud.getState>): string {
  switch (s.status) {
    case 'syncing':
      return t('Syncing…');
    case 'offline':
      return t('Offline. Changes sync when you are back online.');
    case 'error':
      return t('Sync failed: {error}', { error: s.error ?? '' });
    default: {
      if (!s.lastSyncAt) return t('Signed in');
      const min = Math.round((Date.now() - s.lastSyncAt) / 60_000);
      return min < 1 ? t('Synced just now') : min < 60 ? t('Synced {n} min ago', { n: min }) : t('Synced {when}', { when: relativeDay(s.lastSyncAt) });
    }
  }
}

/** Settings block: sign-in prompt, or the account with sync status and actions. */
export function AccountCard() {
  const cloud = useCloud();
  const [signIn, setSignIn] = useState(false);
  if (cloud.status === 'off') return null;

  if (!cloud.user) {
    return (
      <>
        <div className="card account-card">
          <div className="row" style={{ gap: 12 }}>
            <span className="account-icon">
              <Cloud size={22} aria-hidden="true" />
            </span>
            <div className="grow">
              <div className="bold">{t('Back up and sync')}</div>
              <div className="small muted">{t('Keep your workouts safe in the cloud and use Gym on more devices.')}</div>
            </div>
          </div>
          <button className="btn primary block mt" onClick={() => setSignIn(true)}>
            {t('Sign in or create account')}
          </button>
        </div>
        {signIn && <SignInSheet onClose={() => setSignIn(false)} />}
      </>
    );
  }

  return (
    <div className="card account-card">
      <div className="row" style={{ gap: 12 }}>
        <span className={`account-icon ${cloud.status === 'error' ? 'bad' : 'on'}`}>
          {cloud.status === 'error' ? <TriangleAlert size={22} /> : cloud.status === 'offline' ? <CloudOff size={22} /> : <Cloud size={22} />}
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold ellipsis">{cloud.user.email ?? t('Signed in')}</div>
          <div className={`small ${cloud.status === 'error' ? 'danger' : 'muted'}`}>{statusText(cloud)}</div>
        </div>
        <button className="icon-btn" onClick={() => void syncNow()} aria-label={t('Sync now')} disabled={cloud.status === 'syncing'}>
          <RefreshCw size={18} className={cloud.status === 'syncing' ? 'spin' : undefined} />
        </button>
      </div>
      <div className="row mt" style={{ gap: 8 }}>
        <button
          className="btn sm grow"
          onClick={async () => {
            if (!(await confirmDialog(t('Sign out?'), t('Your data stays on this phone. Sign in again any time to keep syncing.'), t('Sign out'), false))) return;
            await signOut();
            toast(t('Signed out'));
          }}
        >
          <LogOut size={16} /> {t('Sign out')}
        </button>
        <button
          className="btn sm grow danger"
          onClick={async () => {
            if (
              !(await confirmDialog(
                t('Delete your account?'),
                t('Your account and all data in the cloud are deleted for good. Data on this phone stays until you delete it in Settings.'),
                t('Delete account'),
              ))
            )
              return;
            try {
              await deleteAccount();
              toast(t('Account deleted'));
            } catch (e) {
              toast(t("Couldn't delete the account: {error}", { error: (e as Error).message }), 'error', 5000);
            }
          }}
        >
          <Trash2 size={16} /> {t('Delete account')}
        </button>
      </div>
    </div>
  );
}

/** Email and password (works without email setup), plus Apple and Google when enabled. */
export function SignInSheet({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || t('Something went wrong'), 'error', 5000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('Sign in')} onClose={onClose}>
      <div className="stack">
        {oauthProviders.includes('apple') && (
          <button className="btn block auth-apple" disabled={busy} onClick={() => void run(() => signInWith('apple'))}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.8-1.7 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.8zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" />
            </svg>
            {t('Continue with Apple')}
          </button>
        )}
        {oauthProviders.includes('google') && (
          <button className="btn block auth-google" disabled={busy} onClick={() => void run(() => signInWith('google'))}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
            </svg>
            {t('Continue with Google')}
          </button>
        )}

        {oauthProviders.length > 0 && <div className="auth-or small muted">{t('or with email')}</div>}

        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'signin', label: t('Sign in') },
            { value: 'signup', label: t('Create account') },
          ]}
        />
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (mode === 'signin') {
                await signInWithPassword(email.trim(), password);
                toast(t('Signed in. Syncing your data…'));
                onClose();
              } else if (await signUpWithPassword(email.trim(), password)) {
                toast(t('Account created. Syncing your data…'));
                onClose();
              } else {
                toast(t('Check your inbox and confirm your email, then sign in.'), 'info', 6000);
                setMode('signin');
              }
            });
          }}
        >
          <input type="email" inputMode="email" autoComplete="email" required placeholder={t('you@example.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            placeholder={mode === 'signin' ? t('Password') : t('Password (at least 8 characters)')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn primary block" disabled={busy || !email.includes('@') || password.length < 8}>
            <Mail size={18} /> {mode === 'signin' ? t('Sign in') : t('Create account')}
          </button>
        </form>

        <p className="tiny muted center" style={{ margin: 0 }}>
          {t('Your workouts on this phone are kept and merged with your account.')}{' '}
          <Link to="/privacy" className="accent" onClick={onClose}>
            {t('Privacy')}
          </Link>
        </p>
      </div>
    </Sheet>
  );
}
