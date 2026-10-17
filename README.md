# Secure Self Safe — Google Login + Per-User Row Level Security (RLS)

A full-stack application built with **TanStack Start (React)** and **Supabase (PostgreSQL + Auth)** where authenticated users can create, read, update, and delete **only their own** notes.

Isolation is strictly enforced by PostgreSQL Row Level Security (RLS) at the database layer — not by client-side filters.

---

## Architecture & Features

- **Frontend**: TanStack Start (React 19) + Vite + Tailwind CSS
- **Authentication**: Native Supabase Google OAuth (`supabase.auth.signInWithOAuth`)
- **Database**: PostgreSQL on Supabase with Row Level Security
- **Strict Privacy**: Row-level isolation ensures no user can access, query, edit, or delete another user's records
- **Security-First**: Zero secret keys in client bundles or git repository; protected by `.gitignore` and `.env.example`

---

## Project Structure

| Component | Path | Description |
|---|---|---|
| **RLS Schema & Policies** | [`supabase/migrations/20261017000000_create_notes_with_rls.sql`](supabase/migrations/20261017000000_create_notes_with_rls.sql) | DDL defining table `notes` and 4 RLS policies |
| **Lock Out Anonymous Visitors** | [`supabase/migrations/20261017000100_revoke_anon_on_notes.sql`](supabase/migrations/20261017000100_revoke_anon_on_notes.sql) | Revokes permissions from `anon` role |
| **Two-User RLS Test Suite** | [`supabase/tests/rls_two_users.sql`](supabase/tests/rls_two_users.sql) | Database-level SQL test verifying User A vs User B isolation |
| **Google Sign-In Button** | [`src/components/GoogleButton.tsx`](src/components/GoogleButton.tsx) | Clean Supabase OAuth trigger with official Google SVG |
| **Authenticated Notes View** | [`src/routes/_authenticated/notes.tsx`](src/routes/_authenticated/notes.tsx) | CRUD notes interface for logged-in user |
| **Auth Route & Redirection** | [`src/routes/auth.tsx`](src/routes/auth.tsx) | Login page with automatic session detection |
| **Supabase Client Config** | [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts) | Pure browser client using Vite env variables |

---

## Row Level Security (RLS) Policies

All policies operate on `public.notes` for the `authenticated` Postgres role and scope access to `auth.uid() = user_id`:

1. **SELECT (`notes_select_own`)**:
   ```sql
   CREATE POLICY "notes_select_own" ON public.notes
     FOR SELECT TO authenticated
     USING (auth.uid() = user_id);
   ```
   Users only receive rows where the note's `user_id` matches their own JWT UUID.

2. **INSERT (`notes_insert_own`)**:
   ```sql
   CREATE POLICY "notes_insert_own" ON public.notes
     FOR INSERT TO authenticated
     WITH CHECK (auth.uid() = user_id);
   ```
   Ensures newly created rows are owned by the inserting user (`user_id` defaults to `auth.uid()`). Any attempt to insert a note on behalf of another user is immediately rejected.

3. **UPDATE (`notes_update_own`)**:
   ```sql
   CREATE POLICY "notes_update_own" ON public.notes
     FOR UPDATE TO authenticated
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   ```
   Users can only update their own notes, and cannot reassign ownership (`user_id`) to another user.

4. **DELETE (`notes_delete_own`)**:
   ```sql
   CREATE POLICY "notes_delete_own" ON public.notes
     FOR DELETE TO authenticated
     USING (auth.uid() = user_id);
   ```
   Users can only delete rows matching their own `auth.uid()`.

5. **Anonymous Lockout**:
   ```sql
   REVOKE ALL ON public.notes FROM anon;
   ```
   Unauthenticated visitors get a SQL `42501 permission denied` response.

---

## Secret Key Protection

- **No private secrets in code or git**: Only the public Supabase publishable key is present in `.env`, which is intentionally public and safe for browsers (security is enforced by Postgres RLS, not key secrecy).
- **Git Protection**: `.env` is ignored via [`.gitignore`](.gitignore). A template is provided in [`.env.example`](.env.example).
- **Service Role Key**: Never used or stored on the frontend.

---

## Testing & Verification with Two Users

Isolation was tested and verified across all operations using two distinct users (User A and User B).

### Test 1: Automated Database-Level Test (`supabase/tests/rls_two_users.sql`)

The test script runs in PostgreSQL, impersonating the `authenticated` role and switching the JWT `sub` claim between User A (`...000a`) and User B (`...000b`), identically to how the Supabase API presents requests.

| # | Action | Expected Behavior | Result |
|---|---|---|---|
| **1** | User A creates a note and reads it back | 1 row returned | **PASS** |
| **2** | User B lists all notes in the database | 0 rows returned | **PASS** |
| **3** | User B tries to SELECT User A's note by explicit ID | 0 rows returned | **PASS** |
| **4** | User B tries to UPDATE User A's note | 0 rows affected | **PASS** |
| **5** | User B tries to DELETE User A's note | 0 rows affected | **PASS** |
| **6** | User B tries to INSERT a note with `user_id = A` | Rejected by RLS (`insufficient_privilege`) | **PASS** |
| **7** | User B tries to UPDATE their own note to set `user_id = A` | Rejected by RLS (`insufficient_privilege`) | **PASS** |
| **8** | User A queries their note again | Note is intact, title "A secret" | **PASS** |
| **9** | Signed-out (`anon`) visitor selects from notes | SQL error: `permission denied` | **PASS** |

**To run the database test yourself:**
```bash
psql "$DATABASE_URL" -f supabase/tests/rls_two_users.sql
# Output: NOTICE: ALL RLS CHECKS PASSED
```

---

### Test 2: In-Browser Verification

1. **Sign in as User A**:
   - Navigate to `http://localhost:8080/auth`.
   - Click **"Continue with Google"** and sign in with Google Account A.
   - You are redirected to `/notes`.
   - Create a note: Title: `"A Confidential Note"`, Body: `"Top secret notes for user A"`.
   - Copy the note's ID (visible in network tab payload).

2. **Sign in as User B**:
   - Open a private / incognito browsing window and navigate to `http://localhost:8080/auth`.
   - Sign in with Google Account B.
   - The notes list displays: *"No notes yet."* (User A's note is invisible).

3. **User B Attack Simulation via DevTools Console**:
   Open browser devtools console in User B's session and attempt to access or manipulate User A's note directly through the Supabase client:
   ```javascript
   const { supabase } = await import('/src/integrations/supabase/client.ts');
   const userANoteId = "<USER_A_NOTE_ID>";

   // Attempt 1: Read User A's note
   const readRes = await supabase.from('notes').select('*').eq('id', userANoteId);
   console.log(readRes.data);
   // Output: [] (Empty array — filtered out by RLS)

   // Attempt 2: Edit User A's note
   const updateRes = await supabase.from('notes').update({ title: 'Hacked by B' }).eq('id', userANoteId).select();
   console.log(updateRes.data);
   // Output: [] (Zero rows modified)

   // Attempt 3: Delete User A's note
   const deleteRes = await supabase.from('notes').delete().eq('id', userANoteId).select();
   console.log(deleteRes.data);
   // Output: [] (Zero rows deleted)
   ```

4. **Verify User A's Note Remains Unchanged**:
   - Switch back to User A's window and refresh.
   - User A's note remains completely intact.

5. **Verify Anonymous Access is Blocked**:
   ```bash
   curl -H "apikey: <SUPABASE_ANON_KEY>" "https://<PROJECT_REF>.supabase.co/rest/v1/notes?select=*"
   # Output:
   # {"code":"42501","message":"permission denied for table notes"}
   ```

---

## Local Setup

### 1. Clone & Install Dependencies
```bash
git clone <REPO_URL>
cd secure-self-safe
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root (see `.env.example`):
```env
SUPABASE_PROJECT_ID="your-project-ref"
SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_URL="https://your-project-ref.supabase.co"

VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
```

### 3. Apply Migrations to Supabase
Run the migrations in the Supabase SQL Editor:
- [`supabase/migrations/20261017000000_create_notes_with_rls.sql`](supabase/migrations/20261017000000_create_notes_with_rls.sql)
- [`supabase/migrations/20261017000100_revoke_anon_on_notes.sql`](supabase/migrations/20261017000100_revoke_anon_on_notes.sql)

### 4. Configure Google OAuth in Supabase
1. In Google Cloud Console, create an OAuth 2.0 Web Client ID:
   - **Authorized redirect URI**: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
   - **Authorized origins**: `http://localhost:8080`, `https://<YOUR_PROJECT_REF>.supabase.co`
2. In Supabase Dashboard:
   - **Authentication > Providers > Google**: Enable Google and paste Client ID & Client Secret.
   - **Authentication > URL Configuration**: Set Site URL to `http://localhost:8080` and add `http://localhost:8080/**` to Redirect URLs.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) to use the app.
