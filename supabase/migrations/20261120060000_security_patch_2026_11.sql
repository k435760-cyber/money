-- 2026.11 security patch.
-- Supabase's default privileges gave browser roles TRUNCATE, TRIGGER and
-- REFERENCES on the ledger tables. TRUNCATE is not subject to RLS and would
-- remove every account's rows, so browser roles keep only the DML they use.
revoke truncate, references, trigger on public.hanpun_transactions, public.hanpun_monthly_plans from authenticated, anon, public;
revoke insert, update, delete, truncate, references, trigger on public.hanpun_age_profiles from authenticated, anon, public;

-- A missing artifact id or digest previously satisfied the checks (NULL !~ ...
-- is NULL, not true) and recorded an unconfirmed upload as acknowledged.
create or replace function public.hanpun_backup_ack(p_run_id text,p_artifact_id text,p_digest text) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_run_id is null or p_artifact_id is null or p_digest is null
    or p_run_id !~ '^[0-9]{1,25}$' or p_artifact_id !~ '^[0-9]{1,25}$'
    or length(p_digest) not between 1 and 200 then
    raise exception 'INVALID_BACKUP_ACK';
  end if;
  update hanpun_private.backup_runs set artifact_id=p_artifact_id,artifact_digest=p_digest,uploaded_at=now() where run_id=p_run_id;
  if not found then raise exception 'EXPORT_NOT_FOUND'; end if;
end $$;
revoke all on function public.hanpun_backup_ack(text,text,text) from public,anon,authenticated;
grant execute on function public.hanpun_backup_ack(text,text,text) to service_role;
