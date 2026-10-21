-- Categories, weighted splits, change log, payment reminders, recurring expenses,
-- web push delivery and one-round-trip inbox counts. Sized for free-tier hosting:
-- the daily cron does all scheduled work and the change log stores diffs only.

alter table public.office_expenses add column category text not null default 'other'
 check(category in ('food','transport','office','entertainment','utilities','gift','other'));
alter table public.office_shares add column weight integer check(weight is null or weight between 1 and 100);
alter table public.office_shares add column last_reminded_at timestamptz;
alter table public.notifications add column pushed_at timestamptz;
-- Existing rows predate push delivery and must never be sent.
update public.notifications set pushed_at=created_at;
create index notifications_unpushed on public.notifications(created_at) where pushed_at is null;

create table public.expense_changes (
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references public.office_expenses(id) on delete cascade,
 actor_id uuid references public.profiles(id),
 action text not null check(action in ('create','edit','metadata','approve','reject','cancel','recurring')),
 changes jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index expense_changes_expense on public.expense_changes(expense_id,created_at);
alter table public.expense_changes enable row level security;
create policy expense_changes_read on public.expense_changes for select to authenticated
 using(exists(select 1 from public.office_expenses e where e.id=expense_id and public.is_group_member(e.group_id)));

create table public.recurring_expenses (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.office_groups(id) on delete cascade,
 creator_id uuid not null references public.profiles(id),
 description text not null check(length(description) between 1 and 500),
 amount numeric(18,2) not null check(amount>0 and amount<=1000000000000),
 category text not null default 'other' check(category in ('food','transport','office','entertainment','utilities','gift','other')),
 split_mode text not null check(split_mode in ('even','custom','weight')),
 shares jsonb not null,
 cadence text not null check(cadence in ('weekly','monthly')),
 start_date date not null,
 runs integer not null default 0,
 next_date date not null,
 active boolean not null default true,
 last_error text,
 created_at timestamptz not null default now()
);
create index recurring_due on public.recurring_expenses(next_date) where active;
alter table public.recurring_expenses enable row level security;
create policy recurring_read on public.recurring_expenses for select to authenticated using(public.is_group_member(group_id));

create table public.push_subscriptions (
 endpoint text primary key check(endpoint ~ '^https://' and length(endpoint)<=1000),
 user_id uuid not null references public.profiles(id) on delete cascade,
 p256dh text not null check(length(p256dh) between 1 and 200),
 auth text not null check(length(auth) between 1 and 100),
 created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for select to authenticated using(user_id=auth.uid());

revoke all on public.expense_changes,public.recurring_expenses,public.push_subscriptions from anon,authenticated;
grant select on public.expense_changes,public.recurring_expenses,public.push_subscriptions to authenticated;
grant all on public.expense_changes,public.recurring_expenses,public.push_subscriptions to service_role;

create function public.log_expense_change(p_expense_id uuid,p_actor uuid,p_action text,p_changes jsonb default '{}'::jsonb) returns void
language sql security definer set search_path='' as $$
 insert into public.expense_changes(expense_id,actor_id,action,changes) values(p_expense_id,p_actor,p_action,coalesce(p_changes,'{}'::jsonb));
$$;

-- Only fields that changed, as {field: [old, new]}; shares as {userId: [old, new]}.
create function public.expense_diff(p_old jsonb,p_new jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(k,jsonb_build_array(p_old->k,p_new->k)),'{}'::jsonb)
 from (select jsonb_object_keys(coalesce(p_old,'{}'::jsonb)||coalesce(p_new,'{}'::jsonb)) k) keys
 where (p_old->k) is distinct from (p_new->k)
$$;

create function public.expense_snapshot(p_expense_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('description',e.description,'amount',e.amount::text,'expense_date',e.expense_date,'payer_id',e.payer_id,'category',e.category,
  'shares',coalesce((select jsonb_object_agg(s.user_id,s.amount::text) from public.office_shares s where s.expense_id=e.id),'{}'::jsonb))
 from public.office_expenses e where e.id=p_expense_id
$$;

-- Shared by user saves and the recurring job, which has no auth.uid().
create function public.save_expense_as(p_actor uuid,p_expense_id uuid,p_group_id uuid,p_description text,p_amount text,p_expense_date date,p_split_mode text,p_shares jsonb,p_receipt_upload_id uuid,p_payer_id uuid,p_category text,p_action text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_old public.office_expenses;v_amount numeric;v_dp integer;v_count integer;v_total numeric;v_base numeric;v_remaining numeric;v_row record;v_receipt uuid;v_payer uuid;v_awaiting boolean;v_weights integer;v_before jsonb;v_after jsonb;
begin
 if p_actor is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=p_actor) then raise exception 'Group membership required'; end if;
 select case when currency in ('VND','JPY','KRW') then 0 else 2 end into v_dp from public.office_groups where id=p_group_id;
 if p_amount !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid amount'; end if;
 v_amount:=p_amount::numeric;
 if v_amount<=0 or v_amount>1000000000000 or v_amount!=round(v_amount,v_dp) then raise exception 'Invalid currency amount'; end if;
 if coalesce(p_category,'other') not in ('food','transport','office','entertainment','utilities','gift','other') then raise exception 'Invalid category'; end if;
 if p_split_mode is null or p_split_mode not in ('even','custom','weight') or p_shares is null or jsonb_typeof(p_shares)!='array' or jsonb_array_length(p_shares)=0 then raise exception 'Invalid shares'; end if;
 v_count:=jsonb_array_length(p_shares);
 if (select count(distinct (j->>'userId')::uuid) from jsonb_array_elements(p_shares) j)!=v_count then raise exception 'Duplicate share members'; end if;
 if exists(select 1 from jsonb_array_elements(p_shares) j where not exists(select 1 from public.group_members m where m.group_id=p_group_id and m.user_id=(j->>'userId')::uuid)) then raise exception 'Share member is not approved'; end if;
 if p_split_mode='custom' then
  if exists(select 1 from jsonb_array_elements(p_shares) j where j->>'amount' is null or j->>'amount' !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'Invalid share amount'; end if;
  if exists(select 1 from jsonb_array_elements(p_shares) j where (j->>'amount')::numeric!=round((j->>'amount')::numeric,v_dp) or (j->>'amount')::numeric>1000000000000) then raise exception 'Invalid share precision'; end if;
  select sum((j->>'amount')::numeric) into v_total from jsonb_array_elements(p_shares) j;
  if v_total!=v_amount then raise exception 'Shares must sum to expense amount'; end if;
 elsif p_split_mode='weight' then
  if exists(select 1 from jsonb_array_elements(p_shares) j where coalesce(j->>'weight','') !~ '^[0-9]{1,3}$' or (j->>'weight')::integer not between 1 and 100) then raise exception 'Invalid share weight'; end if;
  select sum((j->>'weight')::integer) into v_weights from jsonb_array_elements(p_shares) j;
 end if;
 if p_expense_id is not null then
  select * into v_old from public.office_expenses where id=p_expense_id for update;
  if not found or v_old.creator_id!=p_actor or v_old.group_id!=p_group_id then raise exception 'Expense creator required'; end if;
  if v_old.has_reported or v_old.status='cancelled' then raise exception 'Expense shares are locked'; end if;
  v_id:=p_expense_id;v_receipt:=v_old.receipt_upload_id;v_payer:=coalesce(p_payer_id,v_old.payer_id);
  v_before:=public.expense_snapshot(v_id);
 else v_id:=gen_random_uuid();v_payer:=coalesce(p_payer_id,p_actor); end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=v_payer for key share;
 if not found then raise exception 'Payer is not approved'; end if;
 v_awaiting:=v_payer!=p_actor;
 if p_receipt_upload_id is not null then
  perform 1 from public.uploads where id=p_receipt_upload_id and user_id=p_actor and group_id=p_group_id and kind='receipt' and deleting_at is null and preview_path is not null for update;
  if not found then raise exception 'Invalid receipt upload'; end if;
  if exists(select 1 from public.office_expenses where receipt_upload_id=p_receipt_upload_id and id!=v_id) then raise exception 'Receipt already attached'; end if;
  v_receipt:=p_receipt_upload_id;
  if v_old.receipt_upload_id is not null and v_old.receipt_upload_id!=v_receipt then update public.uploads set attached=false where id=v_old.receipt_upload_id; end if;
  update public.uploads set attached=true where id=v_receipt;
 end if;
 if p_expense_id is null then
  insert into public.office_expenses(id,group_id,creator_id,payer_id,description,amount,expense_date,receipt_upload_id,category,status,approved_at)
  values(v_id,p_group_id,p_actor,v_payer,trim(p_description),v_amount,p_expense_date,v_receipt,coalesce(p_category,'other'),case when v_awaiting then 'awaiting_payer' else 'active' end,case when v_awaiting then null else now() end);
 else
  -- Any change to an expense paid by someone else needs that payer's approval again.
  update public.office_expenses set description=trim(p_description),amount=v_amount,expense_date=p_expense_date,receipt_upload_id=v_receipt,payer_id=v_payer,revision=revision+1,
   category=coalesce(p_category,v_old.category),
   status=case when v_awaiting then 'awaiting_payer' else 'active' end,approved_at=case when v_awaiting then null else now() end,reject_reason=null where id=v_id;
  delete from public.office_shares where expense_id=v_id;
 end if;
 v_base:=trunc(v_amount/v_count,v_dp);v_remaining:=v_amount;
 -- Even and weighted splits round down per person; the last member (by id) takes the remainder.
 for v_row in select (j->>'userId')::uuid as user_id,
   case when p_split_mode='custom' then (j->>'amount')::numeric else null end as amount,
   case when p_split_mode='weight' then (j->>'weight')::integer else null end as weight,
   row_number() over(order by (j->>'userId')::uuid) as position
  from jsonb_array_elements(p_shares) j order by (j->>'userId')::uuid loop
  v_total:=case when p_split_mode='custom' then v_row.amount
   when v_row.position=v_count then v_remaining
   when p_split_mode='weight' then trunc(v_amount*v_row.weight/v_weights,v_dp)
   else v_base end;
  v_remaining:=v_remaining-v_total;
  insert into public.office_shares(expense_id,user_id,amount,weight,payment_status) values(v_id,v_row.user_id,v_total,v_row.weight,case when v_row.user_id=v_payer or v_total=0 then 'self' else 'pending' end);
 end loop;
 v_after:=public.expense_snapshot(v_id);
 perform public.log_expense_change(v_id,p_actor,p_action,case when v_before is null then v_after else public.expense_diff(v_before,v_after) end);
 if v_awaiting then
  insert into public.notifications(user_id,group_id,expense_id,title) values(v_payer,p_group_id,v_id,'Có khoản chi cần bạn xác nhận');
  return v_id;
 end if;
 if not exists(select 1 from public.office_shares where expense_id=v_id and payment_status='pending') then update public.office_expenses set status='completed' where id=v_id; end if;
 insert into public.notifications(user_id,group_id,expense_id,title) select user_id,p_group_id,v_id,case when p_expense_id is null then 'Bạn có khoản chia tiền mới' else 'Khoản chia tiền đã được cập nhật' end from public.office_shares where expense_id=v_id and user_id!=p_actor;
 return v_id;
end $$;

drop function public.save_expense(uuid,uuid,text,text,date,text,jsonb,uuid,uuid);
create function public.save_expense(p_expense_id uuid,p_group_id uuid,p_description text,p_amount text,p_expense_date date,p_split_mode text,p_shares jsonb,p_receipt_upload_id uuid default null,p_payer_id uuid default null,p_category text default 'other')
returns uuid language sql security definer set search_path='' as $$
 select public.save_expense_as(auth.uid(),p_expense_id,p_group_id,p_description,p_amount,p_expense_date,p_split_mode,p_shares,p_receipt_upload_id,p_payer_id,p_category,case when p_expense_id is null then 'create' else 'edit' end)
$$;

create or replace function public.edit_expense_metadata(p_expense_id uuid,p_description text,p_expense_date date) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
 v_before:=public.expense_snapshot(p_expense_id);
 update public.office_expenses set description=trim(p_description),expense_date=p_expense_date,revision=revision+1
 where id=p_expense_id and status!='cancelled'
 and (auth.uid()=payer_id or (auth.uid()=creator_id and (creator_id=payer_id or status in ('awaiting_payer','rejected'))));
 if not found then raise exception 'Active expense creator required'; end if;
 perform public.log_expense_change(p_expense_id,auth.uid(),'metadata',public.expense_diff(v_before,public.expense_snapshot(p_expense_id)));
end $$;

create or replace function public.approve_expense(p_expense_id uuid,p_approve boolean,p_reason text default null,p_revision integer default null) returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.office_expenses;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_expense from public.office_expenses where id=p_expense_id for update;
 if not found or v_expense.payer_id!=auth.uid() or not public.is_group_member(v_expense.group_id) then raise exception 'Expense payer required'; end if;
 if v_expense.status!='awaiting_payer' then raise exception 'Expense is not awaiting approval'; end if;
 if p_revision is distinct from v_expense.revision then raise exception 'Expense changed since you opened it'; end if;
 if p_approve then
  update public.office_expenses set status=case when exists(select 1 from public.office_shares where expense_id=p_expense_id and payment_status='pending') then 'active' else 'completed' end,approved_at=now(),reject_reason=null where id=p_expense_id;
  insert into public.notifications(user_id,group_id,expense_id,title)
  select v_expense.creator_id,v_expense.group_id,p_expense_id,'Người trả tiền đã xác nhận khoản chi'
  union select user_id,v_expense.group_id,p_expense_id,'Bạn có khoản chia tiền mới' from public.office_shares where expense_id=p_expense_id and payment_status='pending' and user_id not in (auth.uid(),v_expense.creator_id);
  perform public.log_expense_change(p_expense_id,auth.uid(),'approve');
 else
  if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Rejection reason required'; end if;
  update public.office_expenses set status='rejected',reject_reason=trim(p_reason) where id=p_expense_id;
  insert into public.notifications(user_id,group_id,expense_id,title) values(v_expense.creator_id,v_expense.group_id,p_expense_id,'Người trả tiền đã từ chối khoản chi');
  perform public.log_expense_change(p_expense_id,auth.uid(),'reject',jsonb_build_object('reason',trim(p_reason)));
 end if;
end $$;

create or replace function public.cancel_expense(p_expense_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.office_expenses;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_expense from public.office_expenses where id=p_expense_id for update;
 if not found or auth.uid() not in (v_expense.creator_id,v_expense.payer_id) then raise exception 'Expense creator required'; end if;
 if length(trim(p_reason)) not between 1 and 500 or p_reason is null then raise exception 'Cancellation reason required'; end if;
 if v_expense.status='cancelled' then return; end if;
 update public.office_expenses set status='cancelled',cancel_reason=trim(p_reason) where id=p_expense_id;
 insert into public.payment_events(expense_id,actor_id,action) values(p_expense_id,auth.uid(),'cancel');
 perform public.log_expense_change(p_expense_id,auth.uid(),'cancel',jsonb_build_object('reason',trim(p_reason)));
 insert into public.notifications(user_id,group_id,expense_id,title)
 select user_id,v_expense.group_id,p_expense_id,'Khoản chi đã bị hủy; kiểm tra đối soát' from public.office_shares where expense_id=p_expense_id and user_id!=auth.uid()
 union select u,v_expense.group_id,p_expense_id,'Khoản chi đã bị hủy; kiểm tra đối soát' from unnest(array[v_expense.creator_id,v_expense.payer_id]) u where u!=auth.uid();
end $$;

-- Payment reminders: the payer nudges at most once per 20 hours per share; the
-- daily cron nudges shares unpaid for 3+ days at most every 3 days.
create function public.remind_payment(p_expense_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.office_expenses;v_share public.office_shares;
begin
 select * into v_expense from public.office_expenses where id=p_expense_id;
 if not found or v_expense.payer_id is distinct from auth.uid() or not public.is_group_member(v_expense.group_id) then raise exception 'Expense payer required'; end if;
 if v_expense.status!='active' then raise exception 'Expense is not approved'; end if;
 select * into v_share from public.office_shares where expense_id=p_expense_id and user_id=p_user_id for update;
 if not found or v_share.payment_status!='pending' then raise exception 'No payable share'; end if;
 if v_share.last_reminded_at>now()-interval '20 hours' then raise exception 'Reminder sent recently'; end if;
 update public.office_shares set last_reminded_at=now() where expense_id=p_expense_id and user_id=p_user_id;
 insert into public.notifications(user_id,group_id,expense_id,title) values(p_user_id,v_expense.group_id,p_expense_id,'Nhắc: bạn còn khoản cần trả');
end $$;

create function public.auto_remind_payments(p_now timestamptz default now(),p_limit integer default 500) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 with due as (
  select s.expense_id,s.user_id,e.group_id from public.office_shares s join public.office_expenses e on e.id=s.expense_id
  where e.status='active' and s.payment_status='pending' and s.amount>0
  and coalesce(e.approved_at,e.created_at)<p_now-interval '3 days'
  and (s.last_reminded_at is null or s.last_reminded_at<p_now-interval '3 days')
  order by e.created_at limit least(greatest(p_limit,1),1000)
  for update of s skip locked
 ), marked as (
  update public.office_shares s set last_reminded_at=p_now from due where s.expense_id=due.expense_id and s.user_id=due.user_id returning due.*
 )
 insert into public.notifications(user_id,group_id,expense_id,title) select user_id,group_id,expense_id,'Nhắc: bạn còn khoản cần trả' from marked;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

-- Recurring expenses are paid by their creator and split like the saved template.
create function public.save_recurring(p_group_id uuid,p_description text,p_amount text,p_category text,p_split_mode text,p_shares jsonb,p_cadence text,p_start_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_group_member(p_group_id) then raise exception 'Group membership required'; end if;
 if p_cadence not in ('weekly','monthly') then raise exception 'Invalid cadence'; end if;
 if p_start_date is null or p_start_date<current_date-1 then raise exception 'Start date must not be in the past'; end if;
 if p_description is null or length(trim(p_description)) not between 1 and 500 then raise exception 'Description required'; end if;
 if p_amount !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid amount'; end if;
 insert into public.recurring_expenses(group_id,creator_id,description,amount,category,split_mode,shares,cadence,start_date,next_date)
 values(p_group_id,auth.uid(),trim(p_description),p_amount::numeric,coalesce(p_category,'other'),p_split_mode,p_shares,p_cadence,p_start_date,p_start_date)
 returning id into v_id;
 return v_id;
end $$;

create function public.stop_recurring(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.recurring_expenses r set active=false where r.id=p_id and r.active
 and (r.creator_id=auth.uid() or exists(select 1 from public.office_groups g where g.id=r.group_id and g.owner_id=auth.uid()));
 if not found then raise exception 'Recurring expense creator required'; end if;
end $$;

-- Creates every occurrence due on or before p_today (catching up missed days, at
-- most 5 per template per run). A failing template is paused and its creator told.
create function public.run_recurring(p_today date default current_date,p_limit integer default 200) returns integer language plpgsql security definer set search_path='' as $$
declare v_row public.recurring_expenses;v_created integer:=0;v_occurrences integer;
begin
 for v_row in select * from public.recurring_expenses where active and next_date<=p_today order by next_date limit least(greatest(p_limit,1),1000) for update skip locked loop
  v_occurrences:=0;
  while v_row.active and v_row.next_date<=p_today and v_occurrences<5 loop
   begin
    perform public.save_expense_as(v_row.creator_id,null,v_row.group_id,v_row.description,v_row.amount::text,v_row.next_date,v_row.split_mode,
     -- Members who left are dropped; an even or weighted split still works without them.
     (select coalesce(jsonb_agg(j),'[]'::jsonb) from jsonb_array_elements(v_row.shares) j where exists(select 1 from public.group_members m where m.group_id=v_row.group_id and m.user_id=(j->>'userId')::uuid)),
     null,v_row.creator_id,v_row.category,'recurring');
    v_created:=v_created+1;
    v_row.runs:=v_row.runs+1;
    v_row.next_date:=case v_row.cadence when 'weekly' then v_row.start_date+7*v_row.runs else (v_row.start_date+make_interval(months=>v_row.runs))::date end;
   exception when others then
    v_row.active:=false;v_row.last_error:=left(sqlerrm,200);
    insert into public.notifications(user_id,group_id,title) values(v_row.creator_id,v_row.group_id,'Khoản chi định kỳ đã tạm dừng do lỗi');
   end;
   v_occurrences:=v_occurrences+1;
  end loop;
  update public.recurring_expenses set runs=v_row.runs,next_date=v_row.next_date,active=v_row.active,last_error=v_row.last_error where id=v_row.id;
 end loop;
 return v_created;
end $$;

-- Web push: browsers register here; the server claims unsent notifications in batches.
create function public.save_push_subscription(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if (select count(*) from public.push_subscriptions where user_id=auth.uid() and endpoint!=p_endpoint)>=10 then raise exception 'Too many devices'; end if;
 insert into public.push_subscriptions(endpoint,user_id,p256dh,auth) values(p_endpoint,auth.uid(),p_p256dh,p_auth)
 on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,created_at=now();
end $$;

create function public.delete_push_subscription(p_endpoint text) returns void language sql security definer set search_path='' as $$
 delete from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
$$;

create function public.claim_push_notifications(p_limit integer default 100) returns table(id uuid,user_id uuid,title text,expense_id uuid,group_id uuid,endpoint text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $$
begin
 return query with claimed as (
  update public.notifications n set pushed_at=now() where n.id in (
   select x.id from public.notifications x where x.pushed_at is null and x.created_at>now()-interval '1 day'
   order by x.created_at limit least(greatest(p_limit,1),500) for update skip locked)
  returning n.id,n.user_id,n.title,n.expense_id,n.group_id
 ) select c.id,c.user_id,c.title,c.expense_id,c.group_id,p.endpoint,p.p256dh,p.auth from claimed c join public.push_subscriptions p on p.user_id=c.user_id;
end $$;

-- Navigation badges in a single round trip per page.
create function public.inbox_counts() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'unread',(select count(*) from public.notifications where user_id=auth.uid() and read_at is null),
  'toPay',(select count(*) from public.office_shares s join public.office_expenses e on e.id=s.expense_id
    where s.user_id=auth.uid() and s.payment_status='pending' and s.amount>0 and e.status='active'),
  'approvals',(select count(*) from public.office_expenses where payer_id=auth.uid() and status='awaiting_payer'))
$$;
create index office_shares_user_pending on public.office_shares(user_id) where payment_status='pending';

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('log_expense_change','expense_snapshot','save_expense_as','auto_remind_payments','run_recurring','claim_push_notifications') loop
  execute 'revoke execute on function '||f.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('save_expense','edit_expense_metadata','approve_expense','cancel_expense','remind_payment','save_recurring','stop_recurring','save_push_subscription','delete_push_subscription','inbox_counts','expense_diff') loop
  execute 'revoke execute on function '||f.signature||' from public,anon';
  execute 'grant execute on function '||f.signature||' to authenticated';
 end loop;
end $$;
