-- Two-user RLS check for public.notes.
-- Simulates user A and user B as the `authenticated` role by setting the JWT `sub` claim,
-- exactly how the Data API presents a signed-in user to Postgres.
-- Fails loudly (RAISE EXCEPTION) if user B can see or change user A's data.
-- Cleans up its own rows at the end.
DO $$
DECLARE
  user_a uuid := '00000000-0000-0000-0000-00000000000a';
  user_b uuid := '00000000-0000-0000-0000-00000000000b';
  note_a uuid;
  n int;
  blocked boolean;
BEGIN
  -- ---- User A creates a note ----
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  INSERT INTO public.notes (title, body) VALUES ('A secret', 'only A may see this') RETURNING id INTO note_a;
  SELECT count(*) INTO n FROM public.notes WHERE id = note_a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: A cannot read own note'; END IF;
  RAISE NOTICE 'PASS 1: A created and can read note %', note_a;

  -- ---- Switch to user B ----
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM public.notes;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B sees % rows', n; END IF;
  RAISE NOTICE 'PASS 2: B lists notes -> 0 rows';

  SELECT count(*) INTO n FROM public.notes WHERE id = note_a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B can read A''s note by id'; END IF;
  RAISE NOTICE 'PASS 3: B selects A''s note by id -> 0 rows';

  UPDATE public.notes SET title = 'hacked by B' WHERE id = note_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B updated A''s note'; END IF;
  RAISE NOTICE 'PASS 4: B updates A''s note -> 0 rows affected';

  DELETE FROM public.notes WHERE id = note_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B deleted A''s note'; END IF;
  RAISE NOTICE 'PASS 5: B deletes A''s note -> 0 rows affected';

  blocked := false;
  BEGIN
    INSERT INTO public.notes (user_id, title) VALUES (user_a, 'forged by B');
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: B inserted a row owned by A'; END IF;
  RAISE NOTICE 'PASS 6: B inserting a row with user_id = A -> rejected by RLS';

  -- B cannot hand their own note over to A either
  INSERT INTO public.notes (title) VALUES ('B note');
  blocked := false;
  BEGIN
    UPDATE public.notes SET user_id = user_a WHERE user_id = user_b;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: B reassigned ownership'; END IF;
  RAISE NOTICE 'PASS 7: B changing user_id on own note -> rejected by RLS';

  -- ---- Back to user A: note untouched ----
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.notes WHERE id = note_a AND title = 'A secret';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: A''s note changed or missing'; END IF;
  RAISE NOTICE 'PASS 8: A still sees the original note, unchanged';

  -- ---- Anonymous visitors get nothing ----
  PERFORM set_config('role', 'anon', true);
  blocked := false;
  BEGIN
    PERFORM count(*) FROM public.notes;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL: anon can query notes'; END IF;
  RAISE NOTICE 'PASS 9: signed-out (anon) access -> permission denied';

  -- ---- Cleanup ----
  PERFORM set_config('role', 'none', true);
  DELETE FROM public.notes WHERE user_id IN (user_a, user_b);
  RAISE NOTICE 'ALL RLS CHECKS PASSED';
END $$;
