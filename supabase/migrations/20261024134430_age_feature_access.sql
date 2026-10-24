-- AI face age estimate, not identity verification or guardian consent. Photos are never stored here.
create table public.hanpun_age_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_group text not null check(age_group in ('under14','14plus','unknown')),
 assessed_at timestamptz not null default now(),
 valid_until timestamptz not null,
 consent_version text not null check(consent_version='face-age-v1')
);
alter table public.hanpun_age_profiles enable row level security;
revoke all on public.hanpun_age_profiles from public,anon,authenticated;
grant select on public.hanpun_age_profiles to authenticated;
grant all on public.hanpun_age_profiles to service_role;
create policy hanpun_age_owner on public.hanpun_age_profiles for select to authenticated
 using ((select auth.uid())=user_id);

-- Restrictive policies are ANDed with the existing ownership policy. Unknown
-- profiles fail closed for these features; ordinary records remain available.
create policy hanpun_transaction_age_insert on public.hanpun_transactions as restrictive for insert to authenticated
 with check ((category not in ('insurance','insurance_payout') and installment_total is null and installment_months is null and installment_current is null)
 or exists(select 1 from public.hanpun_age_profiles a where a.user_id=(select auth.uid()) and a.age_group='14plus' and a.valid_until>now()));
create policy hanpun_transaction_age_update on public.hanpun_transactions as restrictive for update to authenticated
 using (true) with check ((category not in ('insurance','insurance_payout') and installment_total is null and installment_months is null and installment_current is null)
 or exists(select 1 from public.hanpun_age_profiles a where a.user_id=(select auth.uid()) and a.age_group='14plus' and a.valid_until>now()));
create policy hanpun_plan_age_insert on public.hanpun_monthly_plans as restrictive for insert to authenticated
 with check (coalesce((budgets->>'insurance')::numeric,0)=0 or exists(select 1 from public.hanpun_age_profiles a where a.user_id=(select auth.uid()) and a.age_group='14plus' and a.valid_until>now()));
create policy hanpun_plan_age_update on public.hanpun_monthly_plans as restrictive for update to authenticated
 using (true) with check (coalesce((budgets->>'insurance')::numeric,0)=0 or exists(select 1 from public.hanpun_age_profiles a where a.user_id=(select auth.uid()) and a.age_group='14plus' and a.valid_until>now()));

-- Age assessment results receive the same independent mirror and encrypted offsite backup.
alter table hanpun_private.ledger_mirror drop constraint ledger_mirror_entity_check;
alter table hanpun_private.ledger_mirror add constraint ledger_mirror_entity_check
 check(entity in ('hanpun_transactions','hanpun_monthly_plans','hanpun_age_profiles'));
create or replace function hanpun_private.mirror_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb; k text; old_key text;
begin
  if tg_op='DELETE' then v:=to_jsonb(old); else v:=to_jsonb(new); end if;
  k := case when tg_table_name='hanpun_transactions' then v->>'id' when tg_table_name='hanpun_age_profiles' then v->>'user_id' else (v->>'user_id')||':'||(v->>'month') end;
  if tg_op='UPDATE' then
    old_key := case when tg_table_name='hanpun_transactions' then (to_jsonb(old)->>'id') when tg_table_name='hanpun_age_profiles' then to_jsonb(old)->>'user_id' else (to_jsonb(old)->>'user_id')||':'||(to_jsonb(old)->>'month') end;
    if old_key<>k then update hanpun_private.ledger_mirror set deleted_at=now(),updated_at=now() where entity=tg_table_name and row_key=old_key; end if;
  end if;
  insert into hanpun_private.ledger_mirror(entity,row_key,payload,deleted_at)
    values(tg_table_name,k,v,case when tg_op='DELETE' then now() else null end)
  on conflict(entity,row_key) do update set payload=excluded.payload,updated_at=now(),deleted_at=excluded.deleted_at;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger hanpun_age_mirror after insert or update or delete on public.hanpun_age_profiles for each row execute function hanpun_private.mirror_ledger();
create or replace function hanpun_private.backup_snapshot() returns jsonb language sql security definer set search_path='' as $$
  with owners as (
    select distinct (payload->>'user_id')::uuid as id from hanpun_private.ledger_mirror where deleted_at is null
  ) select jsonb_build_object(
    'version',1,'schema_version',3,'project_ref','dbneonomwrqwlbitwdtr','exported_at',now(),
    'entities',coalesce((select jsonb_agg(to_jsonb(m)) from hanpun_private.ledger_mirror m),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'email_confirmed',u.email_confirmed_at is not null,
      'identities',coalesce((select jsonb_agg(jsonb_build_object('provider',i.provider,'provider_id',i.provider_id)) from auth.identities i where i.user_id=u.id),'[]'::jsonb)))
      from auth.users u join owners o on o.id=u.id),'[]'::jsonb)
  );
$$;
create or replace function public.hanpun_restore_backup(p_snapshot jsonb,p_user_map jsonb default '{}'::jsonb,p_apply boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; payload jsonb; owner_id uuid; inserted integer:=0; skipped integer:=0; checked integer:=0; count_rows integer; exported timestamptz;
begin
  if (p_snapshot->>'version') is distinct from '1' or coalesce(p_snapshot->>'schema_version','') not in ('2','3') or jsonb_typeof(p_snapshot->'entities') is distinct from 'array' or jsonb_typeof(p_snapshot->'accounts') is distinct from 'array' or jsonb_typeof(p_user_map) is distinct from 'object' or jsonb_array_length(p_snapshot->'entities')>100000 then raise exception 'INVALID_BACKUP'; end if;
  exported:=(p_snapshot->>'exported_at')::timestamptz;
  if exported is null then raise exception 'INVALID_BACKUP_TIME'; end if;
  for item in select value from jsonb_array_elements(p_snapshot->'entities') loop
    if item->>'entity' is null or item->>'entity' not in ('hanpun_transactions','hanpun_monthly_plans','hanpun_age_profiles') then raise exception 'INVALID_ENTITY'; end if;
    if item->>'deleted_at' is not null then skipped:=skipped+1; continue; end if;
    if exists(select 1 from hanpun_private.ledger_mirror where entity=item->>'entity' and row_key=item->>'row_key' and deleted_at is not null and deleted_at>=exported) then skipped:=skipped+1; continue; end if;
    payload:=item->'payload';
    if (item->>'row_key') is distinct from (case when item->>'entity'='hanpun_transactions' then payload->>'id' when item->>'entity'='hanpun_age_profiles' then payload->>'user_id' else (payload->>'user_id')||':'||(payload->>'month') end) then raise exception 'BACKUP_KEY_MISMATCH'; end if;
    owner_id:=hanpun_private.restore_owner((payload->>'user_id')::uuid,p_user_map,coalesce(p_snapshot->'accounts','[]'::jsonb));
    payload:=jsonb_set(payload,'{user_id}',to_jsonb(owner_id));
    checked:=checked+1;
    if p_apply is not true then continue; end if;
    if item->>'entity'='hanpun_transactions' then
      insert into public.hanpun_transactions select (jsonb_populate_record(null::public.hanpun_transactions,jsonb_build_object('custom_category','')||payload)).* on conflict(id) do nothing;
    elsif item->>'entity'='hanpun_age_profiles' then
      insert into public.hanpun_age_profiles select (jsonb_populate_record(null::public.hanpun_age_profiles,payload)).* on conflict(user_id) do nothing;
    else
      insert into public.hanpun_monthly_plans select (jsonb_populate_record(null::public.hanpun_monthly_plans,payload)).* on conflict(user_id,month) do nothing;
    end if;
    get diagnostics count_rows=row_count;
    inserted:=inserted+count_rows;
  end loop;
  return jsonb_build_object('dry_run',p_apply is not true,'checked',checked,'inserted',inserted,'skipped',skipped);
end $$;

notify pgrst,'reload schema';
