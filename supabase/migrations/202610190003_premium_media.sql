begin;
-- Plan assignments can only be written by a trusted server/admin. No browser writes.
create table public.account_plans(owner_id uuid primary key references auth.users(id) on delete cascade,plan text not null check(plan in ('free','base','pro','premium')),updated_at timestamptz not null default now());
alter table public.account_plans enable row level security;
create policy own_plan_read on public.account_plans for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.account_plans from anon,authenticated;
grant select on public.account_plans to authenticated;
create function public.current_plan() returns text language sql stable security definer set search_path='' as $$select coalesce((select plan from public.account_plans where owner_id=auth.uid()),'free')$$;
revoke all on function public.current_plan() from public,anon;
grant execute on function public.current_plan() to authenticated;
create function public.editorial_media_valid(user_id uuid,platform_name text,files jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare item jsonb;plan_name text;expected_width integer;expected_height integer;expected_platform text;
begin
 if jsonb_typeof(files)<>'array' or jsonb_array_length(files)>10 then return false;end if;
 if jsonb_array_length(files)=0 then return true;end if;
 if user_id<>auth.uid() then return false;end if;
 select coalesce((select plan from public.account_plans where owner_id=user_id),'free') into plan_name;
 if jsonb_array_length(files)>1 and (plan_name<>'premium' or platform_name not in ('Instagram','TikTok')) then return false;end if;
 for item in select value from jsonb_array_elements(files) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'kind','') not in ('image','video') or (item->>'kind'='video' and plan_name<>'premium') then return false;end if;
  if coalesce(length(item->>'name'),0) not between 1 and 240 or coalesce(length(item->>'path'),0) not between 1 and 500 or split_part(item->>'path','/',1)<>user_id::text then return false;end if;
  case item->>'preset'
   when 'ig-square' then expected_width:=1080;expected_height:=1080;expected_platform:='Instagram';
   when 'ig-portrait' then expected_width:=1080;expected_height:=1350;expected_platform:='Instagram';
   when 'ig-story' then expected_width:=1080;expected_height:=1920;expected_platform:='Instagram';
   when 'tt-vertical' then expected_width:=1080;expected_height:=1920;expected_platform:='TikTok';
   when 'yt-landscape' then expected_width:=1920;expected_height:=1080;expected_platform:='YouTube';
   when 'yt-short' then expected_width:=1080;expected_height:=1920;expected_platform:='YouTube';
   else return false;
  end case;
  if platform_name<>expected_platform or coalesce((item->>'width')::integer,0)<>expected_width or coalesce((item->>'height')::integer,0)<>expected_height then return false;end if;
 end loop;
 return true;
exception when others then return false;
end;$$;
revoke all on function public.editorial_media_valid(uuid,text,jsonb) from public,anon;
grant execute on function public.editorial_media_valid(uuid,text,jsonb) to authenticated;
alter table public.contents add column media jsonb not null default '[]' check(public.editorial_media_valid(owner_id,platform,media));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('editorial-media','editorial-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4']) on conflict(id) do nothing;
create policy media_read on storage.objects for select to authenticated using(bucket_id='editorial-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy media_upload on storage.objects for insert to authenticated with check(bucket_id='editorial-media' and (storage.foldername(name))[1]=(select auth.uid())::text and ((metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and coalesce((metadata->>'size')::bigint,0)<=5242880) or (metadata->>'mimetype'='video/mp4' and public.current_plan()='premium')));
create policy media_delete on storage.objects for delete to authenticated using(bucket_id='editorial-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
