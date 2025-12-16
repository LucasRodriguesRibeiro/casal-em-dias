-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users Table
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null, -- Links to Supabase Auth User
  name text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Months Table
create table public.months (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  month_code text not null, -- Format: YYYY-MM
  label text,       -- Format: Janeiro 2025
  closed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Salaries Table (normalized from MonthData)
create table public.salaries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  month_id uuid references public.months(id) on delete cascade not null,
  value numeric default 0,
  person_identifier text, -- e.g., 'salary1', 'salary2'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expenses Table
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  month_id uuid references public.months(id) on delete cascade not null,
  name text not null,
  value numeric default 0,
  category text,
  date date,
  type text check (type in ('fixed', 'variable')), -- 'fixed' or 'variable'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Optional but recommended starter)
alter table public.users enable row level security;
alter table public.months enable row level security;
alter table public.salaries enable row level security;
alter table public.expenses enable row level security;
