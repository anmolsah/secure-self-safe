<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- RLS migrations are mirrored into `supabase/migrations/` and the two-user check lives in `supabase/tests/rls_two_users.sql`; keep both in sync when the notes schema changes — the repo is reviewed as proof of isolation.
- Notes are read/written from the browser client under RLS only; never add service-role access for user data — RLS is the security boundary.
