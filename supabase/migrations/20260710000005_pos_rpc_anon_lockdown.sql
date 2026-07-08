-- ============================================================
-- Defense-in-depth: the staff-facing POS RPCs are SECURITY DEFINER and
-- each already guards on `auth.uid()` being an active staff member — an
-- anonymous customer that reaches them just gets `forbidden`. But there is
-- no reason to expose them to the `anon` role at all. Revoke PUBLIC/anon
-- EXECUTE and re-grant only to `authenticated` (staff sign in as real users).
-- Mirrors the existing pattern (session_functions_search_path, and the
-- money `_tx` functions which are already fully locked from all client roles).
-- Closes the advisor's anon_security_definer_function_executable warnings.
-- ============================================================

do $$
declare
  fn text;
  fns text[] := array[
    'public.open_cash_session(uuid, int)',
    'public.close_cash_session(uuid, int)',
    'public.cash_session_report(uuid)',
    'public.clock_in()',
    'public.clock_out()',
    'public.my_open_shift()',
    'public.set_my_pin(text)',
    'public.verify_my_pin(text)',
    'public.my_pin_is_set()'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end$$;
