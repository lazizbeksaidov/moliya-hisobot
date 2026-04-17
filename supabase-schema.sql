-- ============================================================
-- MOLIYA HISOBOTCHI — SUPABASE SCHEMA
-- Ishlatish: Supabase Dashboard → SQL Editor → bu butun faylni paste qiling → Run
-- ============================================================

-- PROFILES (foydalanuvchi sozlamalari)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  start_balance numeric default 0,
  currency text default 'UZS',
  created_at timestamptz default now()
);

-- CREDITS (kreditlar)
create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  bank text not null,
  purpose text,
  amount numeric not null,
  rate numeric not null default 0,
  months int not null default 12,
  monthly numeric not null,
  start_date date not null,
  paid numeric default 0,
  created_at timestamptz default now()
);
create index if not exists credits_user_idx on public.credits(user_id);

-- INCOMES (daromadlar)
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  source text not null,
  amount numeric not null,
  date date not null,
  note text,
  recurring text,  -- null | 'monthly' | 'weekly'
  created_at timestamptz default now()
);
create index if not exists incomes_user_date_idx on public.incomes(user_id, date desc);

-- EXPENSES (xarajatlar)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  amount numeric not null,
  date date not null,
  note text,
  recurring text,
  created_at timestamptz default now()
);
create index if not exists expenses_user_date_idx on public.expenses(user_id, date desc);
create index if not exists expenses_user_cat_idx on public.expenses(user_id, category);

-- BUDGETS (byudjet limitlari)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  monthly_limit numeric not null,
  created_at timestamptz default now(),
  unique(user_id, category)
);

-- ============================================================
-- ROW LEVEL SECURITY — har bir user faqat o'z ma'lumotini ko'radi
-- ============================================================
alter table public.profiles enable row level security;
alter table public.credits enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own credits" on public.credits;
create policy "own credits" on public.credits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own incomes" on public.incomes;
create policy "own incomes" on public.incomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own expenses" on public.expenses;
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Signup bo'lganda avtomatik profile yaratish
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
