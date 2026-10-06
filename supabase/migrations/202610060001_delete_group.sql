-- Keep receipt paths until Storage cleanup succeeds, even after the group is gone.
alter table public.uploads drop constraint uploads_group_id_fkey;
alter table public.uploads add constraint uploads_group_id_fkey
 foreign key(group_id) references public.office_groups(id) on delete set null;
alter table public.uploads drop constraint uploads_check;
alter table public.uploads add constraint uploads_group_kind_check check (
 (kind='receipt' and (group_id is not null or deleting_at is not null))
 or (kind='qr' and group_id is null)
);

create or replace function public.can_view_upload(p_upload_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.uploads u where u.id=p_upload_id
 and u.deleting_at is null
 and (u.user_id=auth.uid()
 or (u.kind='receipt' and u.attached and public.is_group_member(u.group_id))
 or (u.kind='qr' and exists(select 1 from public.bank_profiles b
 where b.qr_upload_id=u.id and public.can_view_bank(b.user_id)))))
$$;

create function public.delete_group(p_group_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select name into v_name from public.office_groups
 where id=p_group_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Group owner required'; end if;
 if p_confirmation is null or btrim(p_confirmation)!=v_name then
  raise exception 'Group name confirmation required';
 end if;

 -- All relational changes commit together. No Storage objects are orphaned:
 -- tombstoned paths remain available to the existing retryable cleanup worker.
 update public.uploads set attached=false,deleting_at=coalesce(deleting_at,now())
 where group_id=p_group_id and kind='receipt';
 delete from public.notifications where group_id=p_group_id
 or expense_id in (select id from public.office_expenses where group_id=p_group_id);
 delete from public.payment_events where expense_id in
 (select id from public.office_expenses where group_id=p_group_id);
 delete from public.office_expenses where group_id=p_group_id;
 -- Shares, memberships, requests cascade; upload paths become group-less tombstones.
 delete from public.office_groups where id=p_group_id;
end $$;
revoke execute on function public.delete_group(uuid,text) from public,anon;
grant execute on function public.delete_group(uuid,text) to authenticated;

create or replace function public.claim_cleanup_uploads(p_before timestamptz,p_limit integer default 100)
returns setof public.uploads language plpgsql security definer set search_path='' as $$
begin
 if p_limit not between 1 and 1000 then raise exception 'Invalid cleanup batch size'; end if;
 return query with candidates as (
 select u.id from public.uploads u where not u.attached
 -- Keep the existing grace period so an in-flight signed upload cannot recreate
 -- an object after its tracking record has already been deleted.
 and u.created_at<p_before
 and not exists(select 1 from public.ocr_runs r where r.upload_id=u.id
 and r.finished_at is null and r.started_at>now()-interval '45 seconds')
 order by u.created_at,u.id limit p_limit for update skip locked
 ) update public.uploads u set deleting_at=coalesce(u.deleting_at,now())
 from candidates c where u.id=c.id returning u.*;
end $$;
