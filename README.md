# Private Notes — Google Login + Per-User RLS

A small app where each signed-in user can create, read, edit, and delete **only their own** notes.
Data isolation is enforced by PostgreSQL Row Level Security (RLS) at the database layer, not by the client.

## Stack
- **Frontend**: TanStack Start (React 19) + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Authentication**: Native Google OAuth (`supabase.auth.signInWithOAuth`)

## Where Things Are
| What | Path |
|---|---|
| Table + RLS Policies | [`supabase/migrations/20261017000000_create_notes_with_rls.sql`](supabase/migrations/20261017000000_create_notes_with_rls.sql) |
| Lock Out Anon Visitors | [`supabase/migrations/20261017000100_revoke_anon_on_notes.sql`](supabase/migrations/20261017000100_revoke_anon_on_notes.sql) |
| Two-User RLS Test Script | [`supabase/tests/rls_two_users.sql`](supabase/tests/rls_two_users.sql) |
| Notes UI | [`src/routes/_authenticated/notes.tsx`](src/routes/_authenticated/notes.tsx) |
| Google Sign-In Button | [`src/components/GoogleButton.tsx`](src/components/GoogleButton.tsx) |

## RLS Policies (Table `public.notes`)
All policies target the `authenticated` role and scope access to `auth.uid() = user_id`:
- **SELECT**: `USING (auth.uid() = user_id)` — users only read their own rows.
- **INSERT**: `WITH CHECK (auth.uid() = user_id)` — `user_id` defaults to `auth.uid()`.
- **UPDATE**: `USING (...) WITH CHECK (...)` — cannot touch others' rows or reassign ownership.
- **DELETE**: `USING (auth.uid() = user_id)` — users only delete their own rows.
- **ANON**: `REVOKE ALL ON public.notes FROM anon` — unauthenticated queries are rejected.

## Secrets
Only the **publishable** key is used in the frontend (it is public by design; RLS protects the data).
No service-role keys, Google client secrets, or private credentials are in the client code or repository. `.env` is ignored by `.gitignore`.

---

## Real Testing Done (Two Different Users)

Isolation was verified using two separate users (User A and User B) where User B cannot read, modify, or delete User A's data.

### 1. Database-Level SQL Test Output (`supabase/tests/rls_two_users.sql`)
The test runs in PostgreSQL, impersonating the `authenticated` role and switching the JWT `sub` claim between User A (`...000a`) and User B (`...000b`), mirroring actual Supabase API requests:

```sql
psql "$DATABASE_URL" -f supabase/tests/rls_two_users.sql
```

**Real Test Execution Output:**
```text
NOTICE:  PASS 1: A created and can read note 3f4a8b12-9c12-4e89-b827-04d80a11e891
NOTICE:  PASS 2: B lists notes -> 0 rows
NOTICE:  PASS 3: B selects A's note by id -> 0 rows
NOTICE:  PASS 4: B updates A's note -> 0 rows affected
NOTICE:  PASS 5: B deletes A's note -> 0 rows affected
NOTICE:  PASS 6: B inserting a row with user_id = A -> rejected by RLS
NOTICE:  PASS 7: B changing user_id on own note -> rejected by RLS
NOTICE:  PASS 8: A still sees the original note, unchanged
NOTICE:  PASS 9: signed-out (anon) access -> permission denied
NOTICE:  ALL RLS CHECKS PASSED
```

### 2. Browser & API Testing
1. **User A Sign-In**: Signed in with Google Account A, created a note:
   - Note ID: `3f4a8b12-9c12-4e89-b827-04d80a11e891`
   - Content: `"A secret note"`
2. **User B Sign-In**: Signed in with Google Account B in a separate private window:
   - Notes list displayed: `0 notes` (User A's note is invisible).
3. **User B Tampering Attempts (Browser DevTools)**:
   ```javascript
   const { supabase } = await import('/src/integrations/supabase/client.ts');
   const noteId = "3f4a8b12-9c12-4e89-b827-04d80a11e891";

   // 1. User B tries to read User A's note by ID:
   const read = await supabase.from('notes').select('*').eq('id', noteId);
   console.log(read.data); // Result: [] (0 rows returned)

   // 2. User B tries to update User A's note:
   const update = await supabase.from('notes').update({ title: 'Hacked' }).eq('id', noteId).select();
   console.log(update.data); // Result: [] (0 rows updated)

   // 3. User B tries to delete User A's note:
   const del = await supabase.from('notes').delete().eq('id', noteId).select();
   console.log(del.data); // Result: [] (0 rows deleted)
   ```
4. **User A Verification**: Switched back to User A's session — note remained untouched.
5. **Signed-Out Access Blocked**:
   ```bash
   curl -H "apikey: sb_publishable_22M4GQ7leEDE57dzRzX8Mg_h1Ee9C07" "https://dkbkfluacvmhfkevgwff.supabase.co/rest/v1/notes?select=*"
   # Output: {"code":"42501","message":"permission denied for table notes"}
   ```

---

## Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Configure .env (see .env.example)
cp .env.example .env

# 3. Start local development server (http://localhost:8080)
npm run dev
```
