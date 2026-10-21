-- Expenses can be recorded on behalf of the member who actually paid. That payer
-- approves the expense before it counts and confirms every reported transfer.
alter table public.office_expenses add column payer_id uuid references public.profiles(id);
update public.office_expenses set payer_id=creator_id;
alter table public.office_expenses alter column payer_id set not null;
alter table public.office_expenses add column approved_at timestamptz;
update public.office_expenses set approved_at=created_at;
alter table public.office_expenses add column reject_reason text check(reject_reason is null or length(reject_reason) between 1 and 500);
alter table public.office_expenses drop constraint office_expenses_status_check;
alter table public.office_expenses add constraint office_expenses_status_check
 check(status in ('awaiting_payer','active','completed','rejected','cancelled'));
-- Bumped on every edit so a payer never approves a version they have not seen.
alter table public.office_expenses add column revision integer not null default 0;
create index office_expenses_payer on public.office_expenses(payer_id,status);

-- VietQR needs the NAPAS bank BIN; bank_name stays free text for display.
alter table public.bank_profiles add column bank_bin text check(bank_bin is null or bank_bin ~ '^[0-9]{6}$');

-- Bank details are only revealed through expenses the payer has accepted, so
-- nobody can expose a member's account by naming them as payer.
create or replace function public.can_view_bank(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_user_id or exists(select 1 from public.office_expenses e join public.group_members m on m.group_id=e.group_id
 where e.payer_id=p_user_id and e.approved_at is not null and m.user_id=auth.uid())
$$;

create or replace function public.can_view_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_user_id
 or exists(select 1 from public.group_members a join public.group_members b using(group_id)
 where a.user_id=auth.uid() and b.user_id=p_user_id)
 or exists(select 1 from public.office_expenses e where public.is_group_member(e.group_id)
 and (e.creator_id=p_user_id or e.payer_id=p_user_id
 or exists(select 1 from public.office_shares s where s.expense_id=e.id and s.user_id=p_user_id)
 or exists(select 1 from public.payment_events p where p.expense_id=e.id and p.actor_id=p_user_id)))
$$;

drop function public.save_bank_profile(text,text,text,text,uuid);
create function public.save_bank_profile(p_bank_name text,p_account_number text,p_account_holder text,p_transfer_template text,p_qr_upload_id uuid default null,p_bank_bin text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_bin text:=nullif(trim(coalesce(p_bank_bin,'')),'');
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if v_bin is not null and v_bin !~ '^[0-9]{6}$' then raise exception 'Invalid bank BIN'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select qr_upload_id into v_old from public.bank_profiles where user_id=auth.uid() for update;
 if p_qr_upload_id is not null then
  perform 1 from public.uploads where id=p_qr_upload_id and user_id=auth.uid() and kind='qr' and deleting_at is null and preview_path is not null for update;
  if not found then raise exception 'Invalid QR upload'; end if;
  update public.uploads set attached=true where id=p_qr_upload_id;
 end if;
 insert into public.bank_profiles(user_id,bank_name,account_number,account_holder,transfer_template,qr_upload_id,bank_bin)
 values(auth.uid(),trim(p_bank_name),trim(p_account_number),trim(p_account_holder),coalesce(p_transfer_template,''),p_qr_upload_id,v_bin)
 on conflict(user_id) do update set bank_name=excluded.bank_name,account_number=excluded.account_number,account_holder=excluded.account_holder,transfer_template=excluded.transfer_template,qr_upload_id=excluded.qr_upload_id,bank_bin=excluded.bank_bin,updated_at=now();
 if v_old is not null and v_old is distinct from p_qr_upload_id then update public.uploads set attached=false where id=v_old; end if;
end $$;

drop function public.save_expense(uuid,uuid,text,text,date,text,jsonb,uuid);
create function public.save_expense(p_expense_id uuid,p_group_id uuid,p_description text,p_amount text,p_expense_date date,p_split_mode text,p_shares jsonb,p_receipt_upload_id uuid default null,p_payer_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_old public.office_expenses;v_amount numeric;v_dp integer;v_count integer;v_total numeric;v_base numeric;v_remaining numeric;v_row record;v_receipt uuid;v_payer uuid;v_awaiting boolean;
begin
 if not public.is_group_member(p_group_id) then raise exception 'Group membership required'; end if;
 select case when currency in ('VND','JPY','KRW') then 0 else 2 end into v_dp from public.office_groups where id=p_group_id;
 if p_amount !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Invalid amount'; end if;
 v_amount:=p_amount::numeric;
 if v_amount<=0 or v_amount>1000000000000 or v_amount!=round(v_amount,v_dp) then raise exception 'Invalid currency amount'; end if;
 if p_split_mode is null or p_split_mode not in ('even','custom') or p_shares is null or jsonb_typeof(p_shares)!='array' or jsonb_array_length(p_shares)=0 then raise exception 'Invalid shares'; end if;
 v_count:=jsonb_array_length(p_shares);
 if (select count(distinct (j->>'userId')::uuid) from jsonb_array_elements(p_shares) j)!=v_count then raise exception 'Duplicate share members'; end if;
 if exists(select 1 from jsonb_array_elements(p_shares) j where not exists(select 1 from public.group_members m where m.group_id=p_group_id and m.user_id=(j->>'userId')::uuid)) then raise exception 'Share member is not approved'; end if;
 if p_split_mode='custom' then
  if exists(select 1 from jsonb_array_elements(p_shares) j where j->>'amount' is null or j->>'amount' !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'Invalid share amount'; end if;
  if exists(select 1 from jsonb_array_elements(p_shares) j where (j->>'amount')::numeric!=round((j->>'amount')::numeric,v_dp) or (j->>'amount')::numeric>1000000000000) then raise exception 'Invalid share precision'; end if;
  select sum((j->>'amount')::numeric) into v_total from jsonb_array_elements(p_shares) j;
  if v_total!=v_amount then raise exception 'Shares must sum to expense amount'; end if;
 end if;
 if p_expense_id is not null then
  select * into v_old from public.office_expenses where id=p_expense_id for update;
  if not found or v_old.creator_id!=auth.uid() or v_old.group_id!=p_group_id then raise exception 'Expense creator required'; end if;
  if v_old.has_reported or v_old.status='cancelled' then raise exception 'Expense shares are locked'; end if;
  v_id:=p_expense_id;v_receipt:=v_old.receipt_upload_id;v_payer:=coalesce(p_payer_id,v_old.payer_id);
 else v_id:=gen_random_uuid();v_payer:=coalesce(p_payer_id,auth.uid()); end if;
 perform 1 from public.group_members where group_id=p_group_id and user_id=v_payer for key share;
 if not found then raise exception 'Payer is not approved'; end if;
 v_awaiting:=v_payer!=auth.uid();
 if p_receipt_upload_id is not null then
  perform 1 from public.uploads where id=p_receipt_upload_id and user_id=auth.uid() and group_id=p_group_id and kind='receipt' and deleting_at is null and preview_path is not null for update;
  if not found then raise exception 'Invalid receipt upload'; end if;
  if exists(select 1 from public.office_expenses where receipt_upload_id=p_receipt_upload_id and id!=v_id) then raise exception 'Receipt already attached'; end if;
  v_receipt:=p_receipt_upload_id;
  if v_old.receipt_upload_id is not null and v_old.receipt_upload_id!=v_receipt then update public.uploads set attached=false where id=v_old.receipt_upload_id; end if;
  update public.uploads set attached=true where id=v_receipt;
 end if;
 if p_expense_id is null then
  insert into public.office_expenses(id,group_id,creator_id,payer_id,description,amount,expense_date,receipt_upload_id,status,approved_at)
  values(v_id,p_group_id,auth.uid(),v_payer,trim(p_description),v_amount,p_expense_date,v_receipt,case when v_awaiting then 'awaiting_payer' else 'active' end,case when v_awaiting then null else now() end);
 else
  -- Any change to an expense paid by someone else needs that payer's approval again.
  update public.office_expenses set description=trim(p_description),amount=v_amount,expense_date=p_expense_date,receipt_upload_id=v_receipt,payer_id=v_payer,revision=revision+1,
   status=case when v_awaiting then 'awaiting_payer' else 'active' end,approved_at=case when v_awaiting then null else now() end,reject_reason=null where id=v_id;
  delete from public.office_shares where expense_id=v_id;
 end if;
 v_base:=trunc(v_amount/v_count,v_dp);v_remaining:=v_amount;
 for v_row in select (j->>'userId')::uuid as user_id,case when p_split_mode='custom' then (j->>'amount')::numeric else null end as amount,row_number() over(order by (j->>'userId')::uuid) as position from jsonb_array_elements(p_shares) j order by (j->>'userId')::uuid loop
  v_total:=case when p_split_mode='custom' then v_row.amount when v_row.position=v_count then v_remaining else v_base end;
  v_remaining:=v_remaining-v_total;
  insert into public.office_shares(expense_id,user_id,amount,payment_status) values(v_id,v_row.user_id,v_total,case when v_row.user_id=v_payer or v_total=0 then 'self' else 'pending' end);
 end loop;
 if v_awaiting then
  insert into public.notifications(user_id,group_id,expense_id,title) values(v_payer,p_group_id,v_id,'Có khoản chi cần bạn xác nhận');
  return v_id;
 end if;
 if not exists(select 1 from public.office_shares where expense_id=v_id and payment_status='pending') then update public.office_expenses set status='completed' where id=v_id; end if;
 insert into public.notifications(user_id,group_id,expense_id,title) select user_id,p_group_id,v_id,case when p_expense_id is null then 'Bạn có khoản chia tiền mới' else 'Khoản chia tiền đã được cập nhật' end from public.office_shares where expense_id=v_id and user_id!=auth.uid();
 return v_id;
end $$;

create function public.approve_expense(p_expense_id uuid,p_approve boolean,p_reason text default null,p_revision integer default null) returns void language plpgsql security definer set search_path='' as $$
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
 else
  if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Rejection reason required'; end if;
  update public.office_expenses set status='rejected',reject_reason=trim(p_reason) where id=p_expense_id;
  insert into public.notifications(user_id,group_id,expense_id,title) values(v_expense.creator_id,v_expense.group_id,p_expense_id,'Người trả tiền đã từ chối khoản chi');
 end if;
end $$;

create or replace function public.payment_action(p_expense_id uuid,p_action text,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.office_expenses;v_share public.office_shares;v_next text;v_recipient uuid;
begin
 select * into v_expense from public.office_expenses where id=p_expense_id for update;
 if not found or not public.is_group_member(v_expense.group_id) then raise exception 'Group membership required'; end if;
 if v_expense.status='cancelled' then raise exception 'Expense cancelled'; end if;
 if v_expense.status in ('awaiting_payer','rejected') then raise exception 'Expense is not approved'; end if;
 select * into v_share from public.office_shares where expense_id=p_expense_id and user_id=p_user_id;
 if not found or v_share.payment_status='self' then raise exception 'No payable share'; end if;
 if p_action='report' then
  if auth.uid()!=p_user_id then raise exception 'Can only report your own payment'; end if;
  if v_share.payment_status in ('reported','confirmed') then return; end if;
  v_next:='reported';v_recipient:=v_expense.payer_id;
 elsif p_action in ('confirm','reject') then
  if auth.uid()!=v_expense.payer_id then raise exception 'Expense payer required'; end if;
  if p_action='confirm' and v_share.payment_status='confirmed' then return; end if;
  if p_action='reject' and v_share.payment_status='pending' then return; end if;
  if v_share.payment_status!='reported' then raise exception 'Payment must first be reported'; end if;
  v_next:=case when p_action='confirm' then 'confirmed' else 'pending' end;v_recipient:=p_user_id;
 else raise exception 'Invalid payment action'; end if;
 update public.office_shares set payment_status=v_next,reported_at=case when v_next='reported' then now() when v_next='pending' then null else reported_at end,confirmed_at=case when v_next='confirmed' then now() else null end where expense_id=p_expense_id and user_id=p_user_id;
 update public.office_expenses set has_reported=true where id=p_expense_id;
 insert into public.payment_events(expense_id,actor_id,user_id,action) values(p_expense_id,auth.uid(),p_user_id,p_action);
 insert into public.notifications(user_id,group_id,expense_id,title) values(v_recipient,v_expense.group_id,p_expense_id,case p_action when 'report' then 'Thành viên đã báo chuyển tiền' when 'confirm' then 'Khoản chuyển tiền đã được xác nhận' else 'Khoản chuyển tiền chưa được xác nhận' end);
 if not exists(select 1 from public.office_shares where expense_id=p_expense_id and payment_status in ('pending','reported')) then update public.office_expenses set status='completed' where id=p_expense_id; end if;
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
 insert into public.notifications(user_id,group_id,expense_id,title)
 select user_id,v_expense.group_id,p_expense_id,'Khoản chi đã bị hủy; kiểm tra đối soát' from public.office_shares where expense_id=p_expense_id and user_id!=auth.uid()
 union select u,v_expense.group_id,p_expense_id,'Khoản chi đã bị hủy; kiểm tra đối soát' from unnest(array[v_expense.creator_id,v_expense.payer_id]) u where u!=auth.uid();
end $$;

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
 if exists(select 1 from public.office_expenses e where e.group_id=p_group_id and e.status='awaiting_payer'
 and (auth.uid() in (e.payer_id,e.creator_id)
 or exists(select 1 from public.office_shares s where s.expense_id=e.id and s.user_id=auth.uid() and s.amount>0))) then
  raise exception 'Pending expense approvals';
 end if;
 if exists(select 1 from public.office_shares s join public.office_expenses e
 on e.id=s.expense_id where e.group_id=p_group_id and e.status not in ('cancelled','rejected')
 and s.user_id=auth.uid() and s.amount>0 and s.payment_status in ('pending','reported')) then
  raise exception 'Outstanding group payments';
 end if;
 if exists(select 1 from public.office_shares s join public.office_expenses e
 on e.id=s.expense_id where e.group_id=p_group_id and e.status not in ('cancelled','rejected')
 and e.payer_id=auth.uid() and s.user_id!=auth.uid() and s.amount>0
 and s.payment_status in ('pending','reported')) then
  raise exception 'Outstanding group receivables';
 end if;
 delete from public.group_members where group_id=p_group_id and user_id=auth.uid();
 delete from public.join_requests where group_id=p_group_id and user_id=auth.uid();
 delete from public.notifications where group_id=p_group_id and user_id=auth.uid();
 -- Expenses, shares and payment events intentionally remain as historical records.
end $$;

create or replace function public.edit_expense_metadata(p_expense_id uuid,p_description text,p_expense_date date) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.office_expenses set description=trim(p_description),expense_date=p_expense_date,revision=revision+1
 where id=p_expense_id and status!='cancelled'
 and (auth.uid()=payer_id or (auth.uid()=creator_id and (creator_id=payer_id or status in ('awaiting_payer','rejected'))));
 if not found then raise exception 'Active expense creator required'; end if;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_view_bank','can_view_profile','save_bank_profile','save_expense','approve_expense','edit_expense_metadata','payment_action','cancel_expense','leave_group') loop
  execute 'revoke execute on function '||f.signature||' from public,anon';
  execute 'grant execute on function '||f.signature||' to authenticated';
 end loop;
end $$;
