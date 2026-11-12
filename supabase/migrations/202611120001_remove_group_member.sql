-- The group owner can remove a member under the same rules as leaving: nothing may
-- still be owed either way and no expense may await approval, so removing someone
-- never strands money. Functions only; no table or data changes.

-- Why p_user_id cannot exit p_group_id yet, or null. Callers lock the membership first.
create function public.group_exit_blocker(p_group_id uuid,p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select case
  when exists(select 1 from public.office_expenses e where e.group_id=p_group_id and e.status='awaiting_payer'
   and (p_user_id in (e.payer_id,e.creator_id)
   or exists(select 1 from public.office_shares s where s.expense_id=e.id and s.user_id=p_user_id and s.amount>0)))
   then 'approvals'
  when exists(select 1 from public.office_shares s join public.office_expenses e
   on e.id=s.expense_id where e.group_id=p_group_id and e.status not in ('cancelled','rejected')
   and s.user_id=p_user_id and s.amount>0 and s.payment_status in ('pending','reported'))
   then 'payments'
  when exists(select 1 from public.office_shares s join public.office_expenses e
   on e.id=s.expense_id where e.group_id=p_group_id and e.status not in ('cancelled','rejected')
   and e.payer_id=p_user_id and s.user_id!=p_user_id and s.amount>0
   and s.payment_status in ('pending','reported'))
   then 'receivables'
 end
$$;
revoke execute on function public.group_exit_blocker(uuid,uuid) from public,anon,authenticated;

-- Same behaviour and messages as before, now sharing the checks with removal.
create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid;v_blocker text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select owner_id into v_owner from public.office_groups where id=p_group_id for update;
 if not found then raise exception 'Group membership required'; end if;
 if v_owner=auth.uid() then raise exception 'Group owner cannot leave'; end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=auth.uid() for update;
 if not found then raise exception 'Group membership required'; end if;
 v_blocker:=public.group_exit_blocker(p_group_id,auth.uid());
 if v_blocker='approvals' then raise exception 'Pending expense approvals'; end if;
 if v_blocker='payments' then raise exception 'Outstanding group payments'; end if;
 if v_blocker='receivables' then raise exception 'Outstanding group receivables'; end if;
 delete from public.group_members where group_id=p_group_id and user_id=auth.uid();
 delete from public.join_requests where group_id=p_group_id and user_id=auth.uid();
 delete from public.notifications where group_id=p_group_id and user_id=auth.uid();
 -- Expenses, shares and payment events intentionally remain as historical records.
end $$;

create function public.remove_group_member(p_group_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_group public.office_groups;v_blocker text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_group from public.office_groups where id=p_group_id for update;
 if not found or v_group.owner_id!=auth.uid() then raise exception 'Group owner required'; end if;
 if p_user_id=auth.uid() then raise exception 'Group owner cannot be removed'; end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=p_user_id for update;
 if not found then raise exception 'Member not found'; end if;
 v_blocker:=public.group_exit_blocker(p_group_id,p_user_id);
 if v_blocker='approvals' then raise exception 'Member has pending expense approvals'; end if;
 if v_blocker='payments' then raise exception 'Member has outstanding payments'; end if;
 if v_blocker='receivables' then raise exception 'Member has outstanding receivables'; end if;
 delete from public.group_members where group_id=p_group_id and user_id=p_user_id;
 delete from public.join_requests where group_id=p_group_id and user_id=p_user_id;
 delete from public.notifications where group_id=p_group_id and user_id=p_user_id;
 -- No group link: the removed member can no longer open the group.
 insert into public.notifications(user_id,title) values(p_user_id,'Bạn đã bị xóa khỏi nhóm: '||v_group.name);
 -- Expenses, shares and payment events intentionally remain as historical records.
end $$;

revoke execute on function public.leave_group(uuid) from public,anon;
grant execute on function public.leave_group(uuid) to authenticated;
revoke execute on function public.remove_group_member(uuid,uuid) from public,anon;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
