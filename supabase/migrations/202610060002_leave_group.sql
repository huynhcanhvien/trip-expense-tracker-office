-- Lock the membership while creating a share. This closes the race between a
-- concurrent expense/edit and leaving after the last outstanding share is paid.
create function public.require_share_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.group_members m join public.office_expenses e
 on e.group_id=m.group_id where e.id=new.expense_id and m.user_id=new.user_id
 for key share of m;
 if not found then raise exception 'Share member is not approved'; end if;
 return new;
end $$;
revoke execute on function public.require_share_membership() from public,anon,authenticated;
create trigger office_share_member before insert on public.office_shares
for each row execute function public.require_share_membership();

create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select owner_id into v_owner from public.office_groups where id=p_group_id for update;
 if not found then raise exception 'Group membership required'; end if;
 if v_owner=auth.uid() then raise exception 'Group owner cannot leave'; end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=auth.uid() for update;
 if not found then raise exception 'Group membership required'; end if;
 if exists(select 1 from public.office_shares s join public.office_expenses e
 on e.id=s.expense_id where e.group_id=p_group_id and e.status!='cancelled'
 and s.user_id=auth.uid() and s.amount>0 and s.payment_status in ('pending','reported')) then
  raise exception 'Outstanding group payments';
 end if;
 if exists(select 1 from public.office_shares s join public.office_expenses e
 on e.id=s.expense_id where e.group_id=p_group_id and e.status!='cancelled'
 and e.creator_id=auth.uid() and s.user_id!=auth.uid() and s.amount>0
 and s.payment_status in ('pending','reported')) then
  raise exception 'Outstanding group receivables';
 end if;
 delete from public.group_members where group_id=p_group_id and user_id=auth.uid();
 delete from public.join_requests where group_id=p_group_id and user_id=auth.uid();
 delete from public.notifications where group_id=p_group_id and user_id=auth.uid();
 -- Expenses, shares and payment events intentionally remain as historical records.
end $$;
revoke execute on function public.leave_group(uuid) from public,anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- Current members can still identify people in historical expenses after they leave.
create or replace function public.can_view_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_user_id
 or exists(select 1 from public.group_members a join public.group_members b using(group_id)
 where a.user_id=auth.uid() and b.user_id=p_user_id)
 or exists(select 1 from public.office_expenses e where public.is_group_member(e.group_id)
 and (e.creator_id=p_user_id
 or exists(select 1 from public.office_shares s where s.expense_id=e.id and s.user_id=p_user_id)
 or exists(select 1 from public.payment_events p where p.expense_id=e.id and p.actor_id=p_user_id)))
$$;
