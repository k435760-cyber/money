-- Only the Edge Function's service role can access usage counters or the Gemini secret.
create schema if not exists hanpun_private;
revoke all on schema hanpun_private from public, anon, authenticated;
grant usage on schema hanpun_private to service_role;
create table hanpun_private.ai_usage (
  day date not null,
  actor text not null,
  requests integer not null default 0,
  last_request timestamptz not null default now(),
  primary key (day, actor)
);
alter table hanpun_private.ai_usage enable row level security;
revoke all on hanpun_private.ai_usage from public, anon, authenticated;
grant select, insert, update, delete on hanpun_private.ai_usage to service_role;
-- Vault is not an exposed Data API schema. The service role is a trusted backend role.
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;

create or replace function public.hanpun_ai_access(p_actor text, p_limit integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_secret text;
begin
  if p_limit not between 1 and 50 or length(p_actor) not between 16 and 100 then
    raise exception 'INVALID_AI_REQUEST';
  end if;
  delete from hanpun_private.ai_usage where day < current_date - 2;
  insert into hanpun_private.ai_usage(day,actor,requests) values(current_date,'global',1)
  on conflict(day,actor) do update set requests = ai_usage.requests + 1
  where ai_usage.requests < 200 returning requests into v_count;
  if v_count is null then raise exception 'AI_DAILY_LIMIT'; end if;
  v_count := null;
  insert into hanpun_private.ai_usage(day,actor,requests) values(current_date,p_actor,1)
  on conflict(day,actor) do update set requests = ai_usage.requests + 1, last_request = now()
  where ai_usage.requests < p_limit and ai_usage.last_request < now() - interval '3 seconds'
  returning requests into v_count;
  if v_count is null then raise exception 'AI_USAGE_LIMIT'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hanpun_gemini_api_key';
  if v_secret is null then raise exception 'AI_NOT_CONFIGURED'; end if;
  return v_secret;
end;
$$;
revoke all on function public.hanpun_ai_access(text,integer) from public, anon, authenticated;
grant execute on function public.hanpun_ai_access(text,integer) to service_role;
comment on function public.hanpun_ai_access(text,integer) is 'Backend only. Atomic daily quotas and encrypted Vault credential lookup; never callable by browser roles.';
create policy hanpun_ai_backend on hanpun_private.ai_usage for all to service_role using (true) with check (true);
