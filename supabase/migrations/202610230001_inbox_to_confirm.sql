-- Adds transfers awaiting the payer's confirmation to the navigation badge counts.
-- No table data is touched.
create or replace function public.inbox_counts() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'unread',(select count(*) from public.notifications where user_id=auth.uid() and read_at is null),
  'toPay',(select count(*) from public.office_shares s join public.office_expenses e on e.id=s.expense_id
    where s.user_id=auth.uid() and s.payment_status='pending' and s.amount>0 and e.status='active'),
  'toConfirm',(select count(*) from public.office_shares s join public.office_expenses e on e.id=s.expense_id
    where e.payer_id=auth.uid() and e.status='active' and s.payment_status='reported'),
  'approvals',(select count(*) from public.office_expenses where payer_id=auth.uid() and status='awaiting_payer'))
$$;
revoke execute on function public.inbox_counts() from public,anon;
grant execute on function public.inbox_counts() to authenticated;

-- Live UI updates: stream new notifications to their recipient (RLS applies).
-- Guarded so plain PostgreSQL test databases without Supabase Realtime still migrate.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;
