create table public.hanpun_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1900-01-01'::date and '2100-12-31'::date),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  amount bigint not null check (amount between 1 and 9999999999),
  kind text not null check (kind in ('expense', 'income')),
  category text not null,
  payment text not null check (payment in ('체크카드', '신용카드', '현금', '계좌이체')),
  memo text not null default '' check (char_length(memo) <= 500),
  created_at timestamptz not null default now(),
  constraint hanpun_category_matches_kind check (
    (kind = 'expense' and category in ('food','cafe','shopping','transport','living','culture','health','other'))
    or (kind = 'income' and category in ('salary','extra'))
  )
);
create index hanpun_transactions_owner_date_idx on public.hanpun_transactions (user_id, date desc, id desc);

create table public.hanpun_monthly_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (
    extract(day from month) = 1
    and month between '1900-01-01'::date and '2100-12-01'::date
  ),
  budgets jsonb not null,
  note text not null default '' check (char_length(note) <= 500),
  primary key (user_id, month),
  constraint hanpun_valid_budgets check (
    jsonb_typeof(budgets) = 'object'
    and budgets ?& array['food','cafe','shopping','transport','living','culture','health','other']
    and budgets - array['food','cafe','shopping','transport','living','culture','health','other'] = '{}'::jsonb
    and not jsonb_path_exists(budgets, '$.* ? (@.type() != "number" || @ < 0 || @ > 9999999999 || @ % 1 != 0)')
  )
);

alter table public.hanpun_transactions enable row level security;
alter table public.hanpun_monthly_plans enable row level security;

create policy hanpun_transactions_owner on public.hanpun_transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy hanpun_monthly_plans_owner on public.hanpun_monthly_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.hanpun_transactions, public.hanpun_monthly_plans from anon, public;
grant select, insert, update, delete on public.hanpun_transactions, public.hanpun_monthly_plans to authenticated;

comment on table public.hanpun_transactions is '한푼: 계정별 수입·지출 기록. 소유자만 접근 가능.';
comment on table public.hanpun_monthly_plans is '한푼: 월별 카테고리 예산과 메모. 소유자만 접근 가능.';
notify pgrst, 'reload schema';
