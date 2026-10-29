-- A reported transfer the payer leaves unanswered for 48 hours is confirmed
-- automatically, so members are not stuck waiting on an inactive payer.
alter table public.payment_events drop constraint payment_events_action_check;
alter table public.payment_events add constraint payment_events_action_check
 check(action in ('report','confirm','reject','cancel','auto_confirm'));
create index office_shares_reported on public.office_shares(reported_at) where payment_status='reported';

-- Service job (daily cron). p_expense_id/p_member narrow the work for on-page settling.
create function public.auto_confirm_payments(p_now timestamptz default now(),p_limit integer default 500,p_expense_id uuid default null,p_member uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;v_expenses uuid[];
begin
 with due as (
  select s.expense_id,s.user_id,e.group_id,e.payer_id from public.office_shares s join public.office_expenses e on e.id=s.expense_id
  where e.status='active' and s.payment_status='reported' and s.reported_at<p_now-interval '48 hours'
  and (p_expense_id is null or s.expense_id=p_expense_id)
  and (p_member is null or exists(select 1 from public.group_members m where m.group_id=e.group_id and m.user_id=p_member))
  order by s.reported_at limit least(greatest(p_limit,1),1000)
  for update of s skip locked
 ), confirmed as (
  update public.office_shares s set payment_status='confirmed',confirmed_at=p_now
  from due where s.expense_id=due.expense_id and s.user_id=due.user_id and s.payment_status='reported' returning due.*
 ), events as (
  insert into public.payment_events(expense_id,actor_id,user_id,action) select expense_id,payer_id,user_id,'auto_confirm' from confirmed
 ), notified as (
  insert into public.notifications(user_id,group_id,expense_id,title)
  select payer_id,group_id,expense_id,'Khoản chuyển tiền đã được tự động xác nhận sau 48 giờ' from confirmed
  union all select user_id,group_id,expense_id,'Khoản chuyển tiền của bạn đã được tự động xác nhận' from confirmed
 )
 select count(*),coalesce(array_agg(distinct expense_id),'{}') into v_count,v_expenses from confirmed;
 update public.office_expenses e set status='completed' where e.id=any(v_expenses) and e.status='active'
  and not exists(select 1 from public.office_shares s where s.expense_id=e.id and s.payment_status in ('pending','reported'));
 return v_count;
end $$;

-- Called when a member opens an expense or their inbox so the 48 hours hold
-- between daily cron runs. The outcome depends only on time, not on the caller.
-- An expense the caller cannot see settles nothing, like the page's 404.
create function public.settle_overdue_payments(p_expense_id uuid default null) returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Group membership required'; end if;
 if p_expense_id is not null and not exists(select 1 from public.office_expenses e where e.id=p_expense_id and public.is_group_member(e.group_id)) then
  return 0;
 end if;
 return public.auto_confirm_payments(now(),100,p_expense_id,auth.uid());
end $$;

revoke execute on function public.auto_confirm_payments(timestamptz,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.auto_confirm_payments(timestamptz,integer,uuid,uuid) to service_role;
revoke execute on function public.settle_overdue_payments(uuid) from public,anon;
grant execute on function public.settle_overdue_payments(uuid) to authenticated;
