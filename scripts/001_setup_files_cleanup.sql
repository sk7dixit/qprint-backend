
-- 1. Create files table (if not exists)
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  path text not null,
  filename text,
  created_at timestamp with time zone default now()
);

-- 2. Add cleanup columns (idempotent)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'files' and column_name = 'cleanup_status') then
    alter table files add column cleanup_status text default 'pending';
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'files' and column_name = 'cleanup_started_at') then
    alter table files add column cleanup_started_at timestamp with time zone;
  end if;
end $$;
