-- Members typed placeholders like "XXXX" to hide their account number, which
-- produced VietQR codes banking apps cannot look up. Mirrors
-- isPayableAccountNumber in src/lib/vietqr.ts: separators are ignored, at most
-- 19 letters/digits and at least one digit.
create or replace function public.save_bank_profile(p_bank_name text,p_account_number text,p_account_holder text,p_transfer_template text,p_qr_upload_id uuid default null,p_bank_bin text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_old uuid;v_bin text:=nullif(trim(coalesce(p_bank_bin,'')),'');v_account text:=regexp_replace(coalesce(p_account_number,''),'[^0-9A-Za-z]','','g');
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if v_bin is not null and v_bin !~ '^[0-9]{6}$' then raise exception 'Invalid bank BIN'; end if;
 if v_account !~ '^[0-9A-Za-z]{1,19}$' or v_account !~ '[0-9]' then raise exception 'Invalid account number'; end if;
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
