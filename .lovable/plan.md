# Google login + private notes with RLS

## What gets built
- Lovable Cloud backend (database + auth) turned on for this project.
- Sign-in with Google, using the managed Google sign-in (no Google client secret stored in the repo).
- A simple "My notes" app: signed-in users can create, view, edit and delete their own notes. No one else's notes are ever returned.
- Public landing page at `/` with a "Sign in with Google" button; the notes page is only for signed-in users; a sign-out button in the header.

## Data and security
- Table `public.notes`: `id`, `user_id` (references the auth user, defaults to the current user), `title`, `body`, `created_at`, `updated_at`.
- Row Level Security on, with four policies scoped to `auth.uid() = user_id`:
  - select own rows
  - insert only with own `user_id`
  - update own rows (USING + WITH CHECK, so ownership cannot be reassigned)
  - delete own rows
- Grants only to `authenticated` and `service_role`; no `anon` access.
- `updated_at` trigger.
- All of this lives in a SQL migration file under `supabase/migrations/` in the repo.

## Secrets
- The frontend uses only the publishable key (designed to be public; security is enforced by RLS).
- No service-role key, Google secret, or other private key in frontend code or the repo. Data access goes through the browser client under RLS, so no privileged server code is needed.

## Two-user test + README
- Add `TESTING.md` (linked from README) documenting:
  1. User A signs in, creates a note, records its id.
  2. User B signs in: the list is empty; fetching A's note by id returns zero rows; updating/deleting A's note affects 0 rows; inserting a note with `user_id = A` is rejected by the policy.
  3. User A signs back in and the note is unchanged.
- Run the same checks for real against the database by simulating two authenticated users (setting the JWT `sub` claim per transaction) and paste the actual results into the README.
- Add a small automated test file covering those checks.

## GitHub link
- I can't push to GitHub myself. You connect it once: Connectors -> GitHub -> Connect, then create the repository. Lovable then syncs all code, including the migration and README, and you get the link to share.

## Technical details
- TanStack Start routes: `src/routes/index.tsx` (landing), `src/routes/auth.tsx`, `src/routes/_authenticated/notes.tsx`.
- Google via `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` and enabling the Google provider in Cloud auth settings.
- Single `onAuthStateChange` listener in `__root.tsx`; React Query for note reads/mutations.
- Unique head() metadata per page; distinctive, token-based styling.
