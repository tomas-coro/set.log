-- SET.LOG GARMIN SYNC MVP
-- Run once in Supabase > SQL Editor.
-- The bridge table is not directly accessible to anon users.
-- All access goes through narrow RPC functions and a high-entropy pairing token.

create table if not exists public.garmin_bridge (
  device_token text primary key,
  workout jsonb,
  result jsonb,
  updated_at timestamptz not null default now()
);

alter table public.garmin_bridge enable row level security;

revoke all on table public.garmin_bridge from anon, authenticated;

create or replace function public.garmin_put_workout(p_token text, p_workout jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid token';
  end if;

  insert into public.garmin_bridge(device_token, workout, result, updated_at)
  values (p_token, p_workout, null, now())
  on conflict (device_token)
  do update set workout = excluded.workout, result = null, updated_at = now();

  return true;
end;
$$;

create or replace function public.garmin_pull_workout(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select workout
  from public.garmin_bridge
  where device_token = p_token
  limit 1;
$$;

create or replace function public.garmin_push_result(p_token text, p_result jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.garmin_bridge where device_token = p_token) then
    return false;
  end if;

  update public.garmin_bridge
  set result = p_result, updated_at = now()
  where device_token = p_token;

  return true;
end;
$$;

create or replace function public.garmin_take_result(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out_result jsonb;
begin
  select result into out_result
  from public.garmin_bridge
  where device_token = p_token
  for update;

  if out_result is not null then
    update public.garmin_bridge
    set result = null, updated_at = now()
    where device_token = p_token;
  end if;

  return out_result;
end;
$$;

grant execute on function public.garmin_put_workout(text, jsonb) to anon, authenticated;
grant execute on function public.garmin_pull_workout(text) to anon, authenticated;
grant execute on function public.garmin_push_result(text, jsonb) to anon, authenticated;
grant execute on function public.garmin_take_result(text) to anon, authenticated;
