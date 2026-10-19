begin;
create table public.brands (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), description text not null default '' check(length(description)<=4000), tone text not null default '' check(length(tone)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.profiles (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 brand_id uuid not null, platform text not null check(platform in ('Instagram','TikTok','YouTube','Pinterest','Facebook','LinkedIn','Blog')),
 handle text not null check(length(handle) between 1 and 120),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,brand_id,owner_id),foreign key(brand_id,owner_id) references public.brands(id,owner_id) on delete restrict
);
create table public.contents (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 brand_id uuid not null,profile_id uuid,
 title text not null check(length(title) between 1 and 240),platform text not null check(platform in ('Instagram','TikTok','YouTube','Pinterest','Facebook','LinkedIn','Blog')),
 format text not null default '' check(length(format)<=80),pillar text not null default '' check(length(pillar)<=120),
 status text not null default 'Idea' check(status in ('Idea','In lavorazione','Da approvare','Programmato','Pubblicato')),
 scheduled_at timestamptz,script text not null default '' check(length(script)<=20000),notes text not null default '' check(length(notes)<=10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(brand_id,owner_id) references public.brands(id,owner_id) on delete restrict,
 foreign key(profile_id,brand_id,owner_id) references public.profiles(id,brand_id,owner_id) on delete restrict
);
create index brands_owner on public.brands(owner_id);
create index profiles_owner on public.profiles(owner_id,brand_id);
create index contents_owner_date on public.contents(owner_id,scheduled_at);
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$begin new.updated_at=now();return new;end;$$;
create trigger brands_updated before update on public.brands for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger contents_updated before update on public.contents for each row execute function public.set_updated_at();
alter table public.brands enable row level security;
alter table public.profiles enable row level security;
alter table public.contents enable row level security;
create policy brands_read on public.brands for select to authenticated using(owner_id=(select auth.uid()));
create policy brands_create on public.brands for insert to authenticated with check(owner_id=(select auth.uid()));
create policy brands_edit on public.brands for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy brands_remove on public.brands for delete to authenticated using(owner_id=(select auth.uid()));
create policy profiles_read on public.profiles for select to authenticated using(owner_id=(select auth.uid()));
create policy profiles_create on public.profiles for insert to authenticated with check(owner_id=(select auth.uid()));
create policy profiles_edit on public.profiles for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy profiles_remove on public.profiles for delete to authenticated using(owner_id=(select auth.uid()));
create policy contents_read on public.contents for select to authenticated using(owner_id=(select auth.uid()));
create policy contents_create on public.contents for insert to authenticated with check(owner_id=(select auth.uid()));
create policy contents_edit on public.contents for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy contents_remove on public.contents for delete to authenticated using(owner_id=(select auth.uid()));
revoke all on public.brands,public.profiles,public.contents from anon;
grant select,insert,update,delete on public.brands,public.profiles,public.contents to authenticated;
-- Atomic additive import. Owner is always derived from the JWT, never from input.
create function public.import_workspace(payload jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare b jsonb;p jsonb;c jsonb;uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(payload)<>'object' or jsonb_typeof(payload->'brands')<>'array' or jsonb_typeof(payload->'profiles')<>'array' or jsonb_typeof(payload->'contents')<>'array' then raise exception 'Invalid backup';end if;
 if jsonb_array_length(payload->'brands')>500 or jsonb_array_length(payload->'profiles')>2000 or jsonb_array_length(payload->'contents')>10000 then raise exception 'Backup too large';end if;
 for b in select value from jsonb_array_elements(payload->'brands') loop
 insert into public.brands(id,owner_id,name,description,tone) values((b->>'id')::uuid,uid,b->>'name',coalesce(b->>'description',''),coalesce(b->>'tone',''));
 end loop;
 for p in select value from jsonb_array_elements(payload->'profiles') loop
 insert into public.profiles(id,owner_id,brand_id,platform,handle) values((p->>'id')::uuid,uid,(p->>'brand_id')::uuid,p->>'platform',p->>'handle');
 end loop;
 for c in select value from jsonb_array_elements(payload->'contents') loop
 insert into public.contents(id,owner_id,brand_id,profile_id,title,platform,format,pillar,status,scheduled_at,script,notes)
 values((c->>'id')::uuid,uid,(c->>'brand_id')::uuid,(c->>'profile_id')::uuid,c->>'title',c->>'platform',coalesce(c->>'format',''),coalesce(c->>'pillar',''),c->>'status',(c->>'scheduled_at')::timestamptz,coalesce(c->>'script',''),coalesce(c->>'notes',''));
 end loop;
end;$$;
revoke all on function public.import_workspace(jsonb) from public,anon;
grant execute on function public.import_workspace(jsonb) to authenticated;
-- Rate counters are accessible exclusively to the Edge Function's server role.
create table public.ai_usage(owner_id uuid not null references auth.users(id) on delete cascade,day date not null,used integer not null default 0,primary key(owner_id,day));
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create function public.consume_ai_quota(user_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 insert into public.ai_usage(owner_id,day,used) values(user_id,current_date,1)
 on conflict(owner_id,day) do update set used=public.ai_usage.used+1 where public.ai_usage.used<20 returning used into total;
 return total is not null;
end;$$;
revoke all on function public.consume_ai_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;
commit;
