# Cloud backup and sync (Supabase)

The app works fully offline. Signing in adds a cloud copy of all data and keeps several devices
in sync. Without the two environment variables below, the account UI is hidden.

## 1. Create the project

1. Create a free project at supabase.com. Pick an **EU region** (e.g. Frankfurt) for GDPR.
2. **SQL editor →** run `migrations/0001_sync.sql`. It creates the `records` table with
   row-level security (every user sees only their own rows), the `sync_push` upload function
   (last writer wins per record) and `delete_my_account` (GDPR erasure).
3. **Project Settings → API:** copy the *Project URL* and the *anon public* key into
   `.env.local` (see `.env.example`). The anon key is meant to be public; security comes from RLS.

## 2. Sign-in methods

- **Email code (works everywhere, start here):** Authentication → Providers → Email: enabled.
  Authentication → Email Templates → *Magic Link*: put the code in the email, for example
  `<p>Your Gym code: <strong>{{ .Token }}</strong></p>`. The app asks for this 6-digit code.
- **Google and Apple are hidden in the app** until you list them in `VITE_AUTH_PROVIDERS`
  (e.g. `google,apple`) after configuring them here.
- **Google:** create an OAuth client (Web) in Google Cloud Console, add
  `https://<project>.supabase.co/auth/v1/callback` as redirect URI, paste the client ID and
  secret into Authentication → Providers → Google.
- **Apple:** needs an Apple Developer account. Create a Services ID with
  Sign in with Apple and the same callback URL, then fill in Authentication → Providers → Apple.
- **Authentication → URL Configuration:** set *Site URL* to where the app is hosted and add it to
  *Redirect URLs*. Google and Apple sign-in return there.

## 3. How sync works

- Each workout, routine, custom exercise and measurement is one row; settings, the weekly plan
  and pinned notes are three small documents. Deletions are rows with `deleted_at`.
- The app uploads changes a few seconds after they happen and pulls other devices' changes on
  start, on focus, when back online and every 5 minutes (`src/lib/cloud.ts`).
- Conflicts: per record the newer edit wins, a deletion wins over older edits
  (`src/lib/sync.ts`, `src/lib/syncEngine.ts`, tests in `src/lib/__tests__/syncEngine.test.ts`).
- Signing in on a phone that already has data merges it into the account; nothing is lost.
