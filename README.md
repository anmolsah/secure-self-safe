# Private Notes — Google login + per-user RLS

A small app where each signed-in user can create, read, edit and delete **only their own** notes.
Isolation is enforced by Postgres Row Level Security, not by the UI.

## Stack
- TanStack Start (React) frontend
- Lovable Cloud (Postgres + Auth) — Google sign-in via the managed OAuth broker

## Where things are
| What | Path |
|---|---|
| Table + RLS policies | `supabase/migrations/20261017000000_create_notes_with_rls.sql` |
| Lock out signed-out visitors | `supabase/migrations/20261017000100_revoke_anon_on_notes.sql` |
| Two-user RLS test | `supabase/tests/rls_two_users.sql` |
| Notes UI | `src/routes/_authenticated/notes.tsx` |
| Google sign-in | `src/components/GoogleButton.tsx` |

## Policies (table `public.notes`)
All four are `TO authenticated` and scoped to `auth.uid() = user_id`:
- **SELECT** `USING (auth.uid() = user_id)`
- **INSERT** `WITH CHECK (auth.uid() = user_id)` — `user_id` defaults to `auth.uid()`
- **UPDATE** `USING (...) WITH CHECK (...)` — can't touch others' rows *or* hand a row to someone else
- **DELETE** `USING (auth.uid() = user_id)`

`anon` has no grants on the table, so signed-out requests get `permission denied`.

## Secrets
Only the **publishable** key is used in the browser (it's designed to be public; RLS does the protecting).
No service-role key, Google client secret, or other private key is in the code or repo.

## How it was tested with two users

### 1. Database-level (exact, repeatable)
`supabase/tests/rls_two_users.sql` runs as the real `authenticated` role and switches the JWT `sub`
claim between user A and user B — the same way the API presents a signed-in user to Postgres.
Each step raises an exception on failure; test rows are deleted at the end.

| # | Action | Expected | Result |
|---|---|---|---|
| 1 | A inserts a note, reads it | 1 row | PASS |
| 2 | B lists all notes | 0 rows | PASS |
| 3 | B selects A's note by id | 0 rows | PASS |
| 4 | B updates A's note | 0 rows affected | PASS |
| 5 | B deletes A's note | 0 rows affected | PASS |
| 6 | B inserts a note with `user_id = A` | rejected (RLS violation) | PASS |
| 7 | B sets `user_id = A` on B's own note | rejected (RLS violation) | PASS |
| 8 | A reads note again | unchanged, title "A secret" | PASS |
| 9 | Signed-out (`anon`) select | permission denied | PASS |

Run it yourself (as the database owner): `psql "$DATABASE_URL" -f supabase/tests/rls_two_users.sql`
→ ends with `NOTICE: ALL RLS CHECKS PASSED`.

### 2. In the browser (manual)
1. Sign in with Google account **A**, add a note. Copy its `id` from the devtools network tab.
2. Sign out, sign in with Google account **B** (or use a private window). The list is empty.
3. In B's devtools console, try to reach A's note directly through the API:
   ```js
   const { supabase } = await import('/src/integrations/supabase/client.ts');
   await supabase.from('notes').select('*').eq('id', '<A_NOTE_ID>');            // data: []
   await supabase.from('notes').update({ title: 'x' }).eq('id', '<A_NOTE_ID>').select(); // data: []
   await supabase.from('notes').delete().eq('id', '<A_NOTE_ID>').select();       // data: []
   ```
4. Sign back in as A — the note is still there, unchanged.
