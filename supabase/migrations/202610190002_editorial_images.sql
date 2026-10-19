begin;
alter table public.contents add column hook text not null default '' check(length(hook)<=1000);
alter table public.contents add column description text not null default '' check(length(description)<=10000);
alter table public.contents add column image_path text check(image_path is null or (length(image_path)<=500 and split_part(image_path,'/',1)=owner_id::text));
create function public.editorial_hashtags_valid(tags text[]) returns boolean language sql immutable set search_path='' as $$select cardinality(tags)<=5 and not exists(select 1 from unnest(tags) t where t is null or length(t) not between 1 and 80 or t ~ '[^[:alnum:]_]') and cardinality(tags)=(select count(distinct lower(t)) from unnest(tags)t)$$;
alter table public.contents add column hashtags text[] not null default '{}' check(public.editorial_hashtags_valid(hashtags));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('editorial-images','editorial-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy editorial_images_read on storage.objects for select to authenticated using(bucket_id='editorial-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy editorial_images_upload on storage.objects for insert to authenticated with check(bucket_id='editorial-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy editorial_images_delete on storage.objects for delete to authenticated using(bucket_id='editorial-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Existing import stays atomic and never trusts storage paths from backup files.
create or replace function public.import_workspace(payload jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare b jsonb;p jsonb;c jsonb;uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required';end if;
 if coalesce(jsonb_typeof(payload),'')<>'object' or coalesce(jsonb_typeof(payload->'brands'),'')<>'array' or coalesce(jsonb_typeof(payload->'profiles'),'')<>'array' or coalesce(jsonb_typeof(payload->'contents'),'')<>'array' then raise exception 'Invalid backup';end if;
 if jsonb_array_length(payload->'brands')>500 or jsonb_array_length(payload->'profiles')>2000 or jsonb_array_length(payload->'contents')>10000 then raise exception 'Backup too large';end if;
 for b in select value from jsonb_array_elements(payload->'brands') loop
 insert into public.brands(id,owner_id,name,description,tone) values((b->>'id')::uuid,uid,b->>'name',coalesce(b->>'description',''),coalesce(b->>'tone',''));
 end loop;
 for p in select value from jsonb_array_elements(payload->'profiles') loop
 insert into public.profiles(id,owner_id,brand_id,platform,handle) values((p->>'id')::uuid,uid,(p->>'brand_id')::uuid,p->>'platform',p->>'handle');
 end loop;
 for c in select value from jsonb_array_elements(payload->'contents') loop
 insert into public.contents(id,owner_id,brand_id,profile_id,title,platform,format,pillar,status,scheduled_at,script,notes,hook,description,hashtags)
 values((c->>'id')::uuid,uid,(c->>'brand_id')::uuid,(c->>'profile_id')::uuid,c->>'title',c->>'platform',coalesce(c->>'format',''),coalesce(c->>'pillar',''),c->>'status',(c->>'scheduled_at')::timestamptz,coalesce(c->>'script',''),coalesce(c->>'notes',''),coalesce(c->>'hook',''),coalesce(c->>'description',''),array(select jsonb_array_elements_text(coalesce(c->'hashtags','[]'::jsonb))));
 end loop;
end;$$;
commit;
