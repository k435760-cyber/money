-- Public clients must have a live Auth session, not just an unexpired JWT.
create function hanpun_private.session_matches(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function hanpun_private.session_matches(uuid,uuid) from public,anon,authenticated;
grant execute on function hanpun_private.session_matches(uuid,uuid) to service_role;

create function hanpun_private.current_session_active()
returns boolean language sql stable security definer set search_path='' as $$
 select hanpun_private.session_matches((select auth.uid()),case
 when (select auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then (select auth.jwt()->>'session_id')::uuid else null end);
$$;
revoke all on function hanpun_private.current_session_active() from public,anon,authenticated;
grant usage on schema hanpun_private to authenticated;
grant execute on function hanpun_private.current_session_active() to authenticated;

-- The exposed wrappers have caller privileges. Only a boolean is returned;
-- browser callers cannot probe arbitrary users or read the Auth session table.
create function public.hanpun_session_active() returns boolean language sql stable security invoker set search_path='' as $$
 select hanpun_private.current_session_active();
$$;
revoke all on function public.hanpun_session_active() from public,anon,authenticated;
grant execute on function public.hanpun_session_active() to authenticated;
create function public.hanpun_ai_session_active(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select hanpun_private.session_matches(p_user_id,p_session_id);
$$;
revoke all on function public.hanpun_ai_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hanpun_ai_session_active(uuid,uuid) to service_role;

create policy hanpun_transactions_active_session on public.hanpun_transactions as restrictive for all to authenticated
 using ((select public.hanpun_session_active())) with check ((select public.hanpun_session_active()));
create policy hanpun_plans_active_session on public.hanpun_monthly_plans as restrictive for all to authenticated
 using ((select public.hanpun_session_active())) with check ((select public.hanpun_session_active()));
create policy hanpun_age_active_session on public.hanpun_age_profiles as restrictive for select to authenticated
 using ((select public.hanpun_session_active()));

-- Client-side date restrictions also apply to direct REST inserts and updates.
-- This service uses Korean calendar dates; old future rows remain readable/deletable.
create policy hanpun_transactions_not_future_insert on public.hanpun_transactions as restrictive for insert to authenticated
 with check (date <= (now() at time zone 'Asia/Seoul')::date);
create policy hanpun_transactions_not_future_update on public.hanpun_transactions as restrictive for update to authenticated
 using (true) with check (date <= (now() at time zone 'Asia/Seoul')::date);
notify pgrst,'reload schema';
