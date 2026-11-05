-- One transfer covers every pending share a member owes one payer in one currency.
-- A VietQR memo holds at most 25 characters, so the QR carries only the batch
-- code; both sides look the code up to see which expenses the transfer covers.
create table public.payment_batches (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-HJ-NP-Z2-9]{6}$'),
 member_id uuid not null references public.profiles(id),
 receiver_id uuid not null references public.profiles(id),
 currency text not null,
 amount numeric(18,2) not null check(amount>0),
 status text not null default 'open' check(status in ('open','reported','superseded')),
 created_at timestamptz not null default now(),
 reported_at timestamptz
);
create index payment_batches_member_open on public.payment_batches(member_id) where status='open';
create index payment_batches_receiver on public.payment_batches(receiver_id,created_at desc);
create table public.payment_batch_items (
 batch_id uuid not null references public.payment_batches(id) on delete cascade,
 expense_id uuid not null references public.office_expenses(id) on delete cascade,
 amount numeric(18,2) not null check(amount>0),
 primary key(batch_id,expense_id)
);
create index payment_batch_items_expense on public.payment_batch_items(expense_id);
alter table public.notifications add column payment_batch_id uuid references public.payment_batches(id) on delete set null;

alter table public.payment_batches enable row level security;
alter table public.payment_batch_items enable row level security;
create policy payment_batches_read on public.payment_batches for select to authenticated using(auth.uid() in (member_id,receiver_id));
create policy payment_batch_items_read on public.payment_batch_items for select to authenticated
 using(exists(select 1 from public.payment_batches b where b.id=batch_id and auth.uid() in (b.member_id,b.receiver_id)));
revoke all on public.payment_batches,public.payment_batch_items from anon,authenticated;
grant select on public.payment_batches,public.payment_batch_items to authenticated;
grant all on public.payment_batches,public.payment_batch_items to service_role;

-- Unambiguous alphabet (no 0/O/1/I) so codes survive being read off a bank statement.
create function public.payment_batch_code() returns text language plpgsql volatile set search_path='' as $$
declare v_alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';v_code text;
begin
 loop
  select string_agg(substr(v_alphabet,1+floor(random()*32)::int,1),'') into v_code from generate_series(1,6);
  exit when not exists(select 1 from public.payment_batches where code=v_code);
 end loop;
 return v_code;
end $$;

-- The caller's open batch per payer and currency, matching exactly what they still owe.
-- Reuses the batch while nothing changed so reloading keeps the same QR and code.
create function public.open_payment_batches()
returns table(batch_id uuid,code text,receiver_id uuid,currency text,amount numeric)
language plpgsql security definer set search_path='' as $$
declare v_due record;v_batch uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 for v_due in
  select e.payer_id as receiver,g.currency as cur,sum(s.amount) as total,
   jsonb_agg(jsonb_build_object('expense_id',s.expense_id,'amount',s.amount) order by s.expense_id) as items
  from public.office_shares s join public.office_expenses e on e.id=s.expense_id join public.office_groups g on g.id=e.group_id
  where s.user_id=auth.uid() and s.payment_status='pending' and s.amount>0 and e.status='active' and e.payer_id!=auth.uid()
  group by e.payer_id,g.currency order by e.payer_id,g.currency
 loop
  select b.id into v_batch from public.payment_batches b
  where b.member_id=auth.uid() and b.receiver_id=v_due.receiver and b.currency=v_due.cur and b.status='open'
  and (select jsonb_agg(jsonb_build_object('expense_id',i.expense_id,'amount',i.amount) order by i.expense_id) from public.payment_batch_items i where i.batch_id=b.id)=v_due.items
  order by b.created_at desc limit 1 for update;
  if not found then
   update public.payment_batches b set status='superseded'
   where b.member_id=auth.uid() and b.receiver_id=v_due.receiver and b.currency=v_due.cur and b.status='open';
   insert into public.payment_batches(code,member_id,receiver_id,currency,amount)
   values(public.payment_batch_code(),auth.uid(),v_due.receiver,v_due.cur,v_due.total) returning id into v_batch;
   insert into public.payment_batch_items(batch_id,expense_id,amount)
   select v_batch,(x->>'expense_id')::uuid,(x->>'amount')::numeric from jsonb_array_elements(v_due.items) x;
  end if;
 end loop;
 -- Batches for debts that were since settled or cancelled can no longer be paid.
 update public.payment_batches b set status='superseded' where b.member_id=auth.uid() and b.status='open'
 and not exists(select 1 from public.office_shares s join public.office_expenses e on e.id=s.expense_id join public.office_groups g on g.id=e.group_id
  where s.user_id=auth.uid() and s.payment_status='pending' and s.amount>0 and e.status='active' and e.payer_id=b.receiver_id and g.currency=b.currency);
 return query select b.id,b.code,b.receiver_id,b.currency,b.amount from public.payment_batches b
  where b.member_id=auth.uid() and b.status='open' order by b.receiver_id,b.currency;
end $$;

-- Reports every still-pending share in the batch at once; the payer gets one notification.
create function public.report_payment_batch(p_batch_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare v_batch public.payment_batches;v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_batch from public.payment_batches where id=p_batch_id for update;
 if not found or v_batch.member_id!=auth.uid() then raise exception 'Payment batch not found'; end if;
 if v_batch.status='reported' then return 0; end if;
 if v_batch.status!='open' then raise exception 'Payment batch is out of date'; end if;
 perform 1 from public.office_expenses e join public.payment_batch_items i on i.expense_id=e.id where i.batch_id=p_batch_id order by e.id for update of e;
 with reported as (
  update public.office_shares s set payment_status='reported',reported_at=now(),confirmed_at=null
  from public.payment_batch_items i join public.office_expenses e on e.id=i.expense_id
  where i.batch_id=p_batch_id and s.expense_id=i.expense_id and s.user_id=auth.uid() and s.payment_status='pending' and e.status='active'
  returning s.expense_id
 ), flagged as (
  update public.office_expenses e set has_reported=true from reported r where e.id=r.expense_id
 ), events as (
  insert into public.payment_events(expense_id,actor_id,user_id,action) select expense_id,auth.uid(),auth.uid(),'report' from reported
 )
 select count(*) into v_count from reported;
 update public.payment_batches set status='reported',reported_at=now() where id=p_batch_id;
 if v_count>0 then
  insert into public.notifications(user_id,title,payment_batch_id) values(v_batch.receiver_id,'Thành viên đã báo chuyển tiền cho nhiều khoản',p_batch_id);
 end if;
 return v_count;
end $$;

revoke execute on function public.payment_batch_code() from public,anon,authenticated;
revoke execute on function public.open_payment_batches() from public,anon;
grant execute on function public.open_payment_batches() to authenticated;
revoke execute on function public.report_payment_batch(uuid) from public,anon;
grant execute on function public.report_payment_batch(uuid) to authenticated;
