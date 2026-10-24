-- Insurance, custom labels, and paid installment metadata. Existing records remain valid.
alter table public.hanpun_transactions
  add column custom_category text not null default '',
  add column installment_total bigint,
  add column installment_months integer,
  add column installment_current integer;
alter table public.hanpun_transactions drop constraint hanpun_category_matches_kind;
alter table public.hanpun_transactions add constraint hanpun_category_matches_kind check (
  (kind='expense' and category in ('food','cafe','shopping','transport','living','culture','health','insurance','other'))
  or (kind='income' and category in ('salary','extra','insurance_payout'))
);
alter table public.hanpun_transactions add constraint hanpun_custom_category_valid check (
  char_length(btrim(custom_category)) <= 40 and (category in ('other','extra') or custom_category='')
);
alter table public.hanpun_transactions add constraint hanpun_installment_valid check (
  (installment_total is null and installment_months is null and installment_current is null)
  or (kind='expense' and installment_total is not null and installment_months is not null and installment_current is not null
    and installment_total between 1 and 9999999999 and installment_months between 2 and 60
    and installment_total >= installment_months and installment_current between 1 and installment_months)
);
alter table public.hanpun_monthly_plans drop constraint hanpun_valid_budgets;
update public.hanpun_monthly_plans set budgets=jsonb_build_object('insurance',0)||budgets where not budgets ? 'insurance';
create function hanpun_private.normalize_budget() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.budgets := jsonb_build_object('insurance',0)||new.budgets; return new; end $$;
revoke all on function hanpun_private.normalize_budget() from public, anon, authenticated;
create trigger hanpun_budget_compatibility before insert or update on public.hanpun_monthly_plans for each row execute function hanpun_private.normalize_budget();
alter table public.hanpun_monthly_plans add constraint hanpun_valid_budgets check (
  jsonb_typeof(budgets)='object'
  and budgets ?& array['food','cafe','shopping','transport','living','culture','health','insurance','other']
  and budgets-array['food','cafe','shopping','transport','living','culture','health','insurance','other']='{}'::jsonb
  and not jsonb_path_exists(budgets,'$.* ? (@.type() != "number" || @ < 0 || @ > 9999999999 || @ % 1 != 0)')
);

-- The mirror has no foreign keys to primary tables or Auth. Ordinary inserts/updates
-- are mirrored in the same transaction; a failed mirror write also rejects the original write.
create table hanpun_private.ledger_mirror (
  entity text not null check(entity in ('hanpun_transactions','hanpun_monthly_plans')),
  row_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key(entity,row_key)
);
create index hanpun_mirror_deleted_idx on hanpun_private.ledger_mirror(deleted_at) where deleted_at is not null;
alter table hanpun_private.ledger_mirror enable row level security;
revoke all on hanpun_private.ledger_mirror from public, anon, authenticated;
grant select,insert,update,delete on hanpun_private.ledger_mirror to service_role;
create policy hanpun_mirror_backend on hanpun_private.ledger_mirror for all to service_role using(true) with check(true);

-- A trigger must write outside the user's RLS scope: definer is confined to this private
-- schema, has no dynamic SQL, fixed search_path, and no browser-callable EXECUTE grant.
create function hanpun_private.mirror_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb; k text; old_key text;
begin
  if tg_op='DELETE' then v:=to_jsonb(old); else v:=to_jsonb(new); end if;
  k := case when tg_table_name='hanpun_transactions' then v->>'id' else (v->>'user_id')||':'||(v->>'month') end;
  if tg_op='UPDATE' then
    old_key := case when tg_table_name='hanpun_transactions' then (to_jsonb(old)->>'id') else (to_jsonb(old)->>'user_id')||':'||(to_jsonb(old)->>'month') end;
    if old_key<>k then update hanpun_private.ledger_mirror set deleted_at=now(),updated_at=now() where entity=tg_table_name and row_key=old_key; end if;
  end if;
  insert into hanpun_private.ledger_mirror(entity,row_key,payload,deleted_at)
    values(tg_table_name,k,v,case when tg_op='DELETE' then now() else null end)
  on conflict(entity,row_key) do update set payload=excluded.payload,updated_at=now(),deleted_at=excluded.deleted_at;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function hanpun_private.mirror_ledger() from public, anon, authenticated;
create trigger hanpun_transaction_mirror after insert or update or delete on public.hanpun_transactions for each row execute function hanpun_private.mirror_ledger();
create trigger hanpun_plan_mirror after insert or update or delete on public.hanpun_monthly_plans for each row execute function hanpun_private.mirror_ledger();
insert into hanpun_private.ledger_mirror(entity,row_key,payload)
  select 'hanpun_transactions',id::text,to_jsonb(t) from public.hanpun_transactions t;
insert into hanpun_private.ledger_mirror(entity,row_key,payload)
  select 'hanpun_monthly_plans',user_id::text||':'||month::text,to_jsonb(t) from public.hanpun_monthly_plans t;

create table hanpun_private.backup_runs (
  run_id text primary key,
  requested_at timestamptz not null default now(),
  artifact_id text,
  artifact_digest text,
  uploaded_at timestamptz
);
alter table hanpun_private.backup_runs enable row level security;
revoke all on hanpun_private.backup_runs from public,anon,authenticated;
grant select,insert,update,delete on hanpun_private.backup_runs to service_role;
create policy hanpun_backup_runs_backend on hanpun_private.backup_runs for all to service_role using(true) with check(true);

-- Minimal verified account references are needed to remap owners after a lost project.
-- No password hashes, sessions, unrelated users, or other applications' tables are exported.
create function hanpun_private.backup_snapshot() returns jsonb language sql security definer set search_path='' as $$
  with owners as (
    select distinct (payload->>'user_id')::uuid as id from hanpun_private.ledger_mirror where deleted_at is null
  ) select jsonb_build_object(
    'version',1,'schema_version',2,'project_ref','dbneonomwrqwlbitwdtr','exported_at',now(),
    'entities',coalesce((select jsonb_agg(to_jsonb(m)) from hanpun_private.ledger_mirror m),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'email_confirmed',u.email_confirmed_at is not null,
      'identities',coalesce((select jsonb_agg(jsonb_build_object('provider',i.provider,'provider_id',i.provider_id)) from auth.identities i where i.user_id=u.id),'[]'::jsonb)))
      from auth.users u join owners o on o.id=u.id),'[]'::jsonb)
  );
$$;
revoke all on function hanpun_private.backup_snapshot() from public,anon,authenticated;
grant execute on function hanpun_private.backup_snapshot() to service_role;
create function public.hanpun_backup_export(p_run_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_run_id !~ '^[0-9]{1,25}$' then raise exception 'INVALID_RUN_ID'; end if;
  insert into hanpun_private.backup_runs(run_id) values(p_run_id) on conflict(run_id) do update set requested_at=now();
  return hanpun_private.backup_snapshot();
end $$;
revoke all on function public.hanpun_backup_export(text) from public,anon,authenticated;
grant execute on function public.hanpun_backup_export(text) to service_role;
create function public.hanpun_backup_ack(p_run_id text,p_artifact_id text,p_digest text) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_run_id !~ '^[0-9]{1,25}$' or p_artifact_id !~ '^[0-9]{1,25}$' or length(p_digest)>200 then raise exception 'INVALID_BACKUP_ACK'; end if;
  update hanpun_private.backup_runs set artifact_id=p_artifact_id,artifact_digest=p_digest,uploaded_at=now() where run_id=p_run_id;
  if not found then raise exception 'EXPORT_NOT_FOUND'; end if;
end $$;
revoke all on function public.hanpun_backup_ack(text,text,text) from public,anon,authenticated;
grant execute on function public.hanpun_backup_ack(text,text,text) to service_role;

-- Restore never recreates Auth accounts or writes unrelated service data. Any owner
-- remapping must match a verified email or the original Google identity.
create function hanpun_private.restore_owner(p_old uuid,p_map jsonb,p_accounts jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_new uuid; account jsonb;
begin
  v_new:=coalesce((p_map->>p_old::text)::uuid,p_old);
  if not exists(select 1 from auth.users where id=v_new) then raise exception 'RESTORE_OWNER_MISSING'; end if;
  if v_new<>p_old then
    select a into account from jsonb_array_elements(p_accounts) a where (a->>'id')::uuid=p_old;
    if account is null or not exists(
      select 1 from auth.users u where u.id=v_new and (
        (u.email_confirmed_at is not null and account->>'email_confirmed'='true' and lower(u.email)=lower(account->>'email'))
        or exists(select 1 from auth.identities i, jsonb_array_elements(account->'identities') old_i where i.user_id=u.id and i.provider=old_i->>'provider' and i.provider_id=old_i->>'provider_id')
      )
    ) then raise exception 'RESTORE_OWNER_MISMATCH'; end if;
  end if;
  return v_new;
end $$;
revoke all on function hanpun_private.restore_owner(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function hanpun_private.restore_owner(uuid,jsonb,jsonb) to service_role;
create or replace function public.hanpun_restore_backup(p_snapshot jsonb,p_user_map jsonb default '{}'::jsonb,p_apply boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; payload jsonb; owner_id uuid; inserted integer:=0; skipped integer:=0; checked integer:=0; count_rows integer; exported timestamptz;
begin
  if (p_snapshot->>'version') is distinct from '1' or (p_snapshot->>'schema_version') is distinct from '2' or jsonb_typeof(p_snapshot->'entities') is distinct from 'array' or jsonb_typeof(p_snapshot->'accounts') is distinct from 'array' or jsonb_typeof(p_user_map) is distinct from 'object' or jsonb_array_length(p_snapshot->'entities')>100000 then raise exception 'INVALID_BACKUP'; end if;
  exported:=(p_snapshot->>'exported_at')::timestamptz;
  if exported is null then raise exception 'INVALID_BACKUP_TIME'; end if;
  for item in select value from jsonb_array_elements(p_snapshot->'entities') loop
    if item->>'entity' is null or item->>'entity' not in ('hanpun_transactions','hanpun_monthly_plans') then raise exception 'INVALID_ENTITY'; end if;
    if item->>'deleted_at' is not null then skipped:=skipped+1; continue; end if;
    if exists(select 1 from hanpun_private.ledger_mirror where entity=item->>'entity' and row_key=item->>'row_key' and deleted_at is not null and deleted_at>=exported) then skipped:=skipped+1; continue; end if;
    payload:=item->'payload';
    if (item->>'row_key') is distinct from (case when item->>'entity'='hanpun_transactions' then payload->>'id' else (payload->>'user_id')||':'||(payload->>'month') end) then raise exception 'BACKUP_KEY_MISMATCH'; end if;
    owner_id:=hanpun_private.restore_owner((payload->>'user_id')::uuid,p_user_map,coalesce(p_snapshot->'accounts','[]'::jsonb));
    payload:=jsonb_set(payload,'{user_id}',to_jsonb(owner_id));
    checked:=checked+1;
    if p_apply is not true then continue; end if;
    if item->>'entity'='hanpun_transactions' then
      insert into public.hanpun_transactions select (jsonb_populate_record(null::public.hanpun_transactions,jsonb_build_object('custom_category','')||payload)).* on conflict(id) do nothing;
    else
      insert into public.hanpun_monthly_plans select (jsonb_populate_record(null::public.hanpun_monthly_plans,payload)).* on conflict(user_id,month) do nothing;
    end if;
    get diagnostics count_rows=row_count;
    inserted:=inserted+count_rows;
  end loop;
  return jsonb_build_object('dry_run',p_apply is not true,'checked',checked,'inserted',inserted,'skipped',skipped);
end $$;
revoke all on function public.hanpun_restore_backup(jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.hanpun_restore_backup(jsonb,jsonb,boolean) to service_role;

-- Fixed retention jobs, rather than cleanup only when somebody next uses AI.
delete from hanpun_private.ai_usage where day < current_date - 2;
select cron.schedule('hanpun-retention-cleanup','0 * * * *',$job$
  delete from hanpun_private.ai_usage where day < current_date - 2;
  delete from hanpun_private.ledger_mirror where deleted_at <= now() - interval '6 days 23 hours';
  delete from hanpun_private.backup_runs where requested_at <= now() - interval '7 days';
$job$);
comment on table hanpun_private.ledger_mirror is 'Atomic server-side ledger mirror. Deleted rows expire within seven days using an hourly cleanup with a one-hour safety margin.';

notify pgrst, 'reload schema';
