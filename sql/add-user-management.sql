-- ════════════════════════════════════════════════════════════════════════
--  จัดการผู้ใช้จากในเว็บ (หน้า "จัดการผู้ใช้") — ใช้ได้คนเดียว: piriya
--    • ตั้งรหัสใหม่ให้คนที่ลืมรหัส          admin_set_password()
--    • เปลี่ยนสิทธิ์ แอดมิน ↔ พนักงาน         admin_set_role()
--    • เพิ่มผู้ใช้ใหม่พร้อมรหัสผ่าน            admin_create_user()
--  (เพิ่ม 9 ต.ค. 2569 — แทน add-admin-reset-password.sql และรวมอยู่ใน stockhq_schema.sql หัวข้อ 3.1 แล้ว)
--
--  วิธีใช้: ก๊อปทั้งไฟล์ไปวางใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้ ไม่พัง)
--  รันเสร็จ ตารางสุดท้ายต้องขึ้น "พร้อมใช้" 3 แถว
--
--  ทำไมต้องเป็นฟังก์ชันในฐานข้อมูล: งานพวกนี้ต้องใช้สิทธิ์ระดับสูง ซึ่งห้ามใส่ไว้ในหน้าเว็บ
--  (ใครเปิดดูโค้ดก็เห็น) ฟังก์ชันรันด้วยสิทธิ์ของฐานข้อมูลเอง แต่เช็คก่อนทุกครั้งว่าคนกดคือ piriya
--  จะเปลี่ยนคน: แก้ 'piriya' ใน is_user_admin_owner() ด้านล่าง + USER_ADMIN_OWNER ใน js/config.js แล้วรันใหม่
-- ════════════════════════════════════════════════════════════════════════

-- คนที่กดคือ piriya และเป็นแอดมิน — ที่เดียวในฐานข้อมูลที่ระบุชื่อนี้
-- ตาราง users ไม่มี update policy ใครก็แก้ชื่อตัวเองเป็น piriya ไม่ได้ และชื่อซ้ำกันไม่ได้ (unique)
create or replace function public.is_user_admin_owner()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and lower(username) = 'piriya'
  );
$$;


-- ── ตั้งรหัสใหม่ให้คนที่ลืมรหัส ──
create or replace function public.admin_set_password(target_user uuid, new_password text)
returns text
language plpgsql
security definer
set search_path = extensions          -- crypt() / gen_salt() ของ pgcrypto อยู่ใน schema นี้บน Supabase
as $$
declare
  uname text;
begin
  if not public.is_user_admin_owner() then
    raise exception 'เฉพาะ piriya เท่านั้นที่ตั้งรหัสให้คนอื่นได้' using errcode = '42501';
  end if;
  if new_password is null or length(new_password) < 6 then
    raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = target_user;
  if not found then
    raise exception 'ไม่พบบัญชีผู้ใช้นี้' using errcode = 'P0002';
  end if;

  select username into uname from public.users where id = target_user;
  return uname;
end;
$$;


-- ── เปลี่ยนสิทธิ์ แอดมิน ↔ พนักงาน ──
create or replace function public.admin_set_role(target_user uuid, new_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text;
begin
  if not public.is_user_admin_owner() then
    raise exception 'เฉพาะ piriya เท่านั้นที่เปลี่ยนสิทธิ์ได้' using errcode = '42501';
  end if;
  if new_role not in ('admin', 'staff') then
    raise exception 'สิทธิ์ต้องเป็น admin หรือ staff' using errcode = '22023';
  end if;
  -- กันลดสิทธิ์ตัวเองจนเข้าหน้านี้ไม่ได้อีก (ไม่มีใครเปลี่ยนกลับให้ได้นอกจากเข้า SQL Editor)
  if target_user = auth.uid() then
    raise exception 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' using errcode = '22023';
  end if;

  update public.users set role = new_role::public.user_role
   where id = target_user
  returning username into uname;
  if uname is null then
    raise exception 'ไม่พบบัญชีผู้ใช้นี้' using errcode = 'P0002';
  end if;
  return uname;
end;
$$;


-- ── เพิ่มผู้ใช้ใหม่พร้อมรหัสผ่าน ──
-- สมัครเองจากหน้าเว็บถูกปิดไว้ (กันคนนอกสมัคร) เลยสร้างบัญชีตรงในฐานข้อมูลแทน
-- อีเมลสร้างจากชื่อผู้ใช้ที่นี่เอง (<ชื่อ>@stockhq.local แบบเดียวกับ USERNAME_DOMAIN ใน js/config.js)
-- ช่อง token ทั้ง 4 ต้องเป็น '' ไม่ใช่ null — ไม่งั้นล็อกอินแล้วขึ้น "Database error querying schema"
create or replace function public.admin_create_user(
  new_username text, new_password text, new_role text default 'staff', new_position text default null)
returns uuid
language plpgsql
security definer
set search_path = extensions
as $$
declare
  uname text := lower(trim(new_username));
  uemail text;
  uid uuid := gen_random_uuid();
begin
  if not public.is_user_admin_owner() then
    raise exception 'เฉพาะ piriya เท่านั้นที่เพิ่มผู้ใช้ได้' using errcode = '42501';
  end if;
  if uname !~ '^[a-z0-9._-]{1,30}$' then
    raise exception 'ชื่อผู้ใช้ใช้ได้แค่ a-z 0-9 . _ - (ไม่เกิน 30 ตัว ไม่มีช่องว่าง)' using errcode = '22023';
  end if;
  if new_password is null or length(new_password) < 6 then
    raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' using errcode = '22023';
  end if;
  if new_role not in ('admin', 'staff') then
    raise exception 'สิทธิ์ต้องเป็น admin หรือ staff' using errcode = '22023';
  end if;

  uemail := uname || '@stockhq.local';
  if exists (select 1 from auth.users where lower(email) = uemail)
     or exists (select 1 from public.users where lower(username) = uname) then
    raise exception 'ชื่อผู้ใช้ % มีอยู่แล้ว', uname using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    uemail, crypt(new_password, gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', uname), now(), now(),
    '', '', '', '');

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid::text, uid,
          jsonb_build_object('sub', uid::text, 'email', uemail, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  -- trigger handle_new_user สร้างแถวใน public.users เป็น staff ให้แล้ว — ตั้งสิทธิ์/ตำแหน่งตามที่เลือก
  update public.users
     set role = new_role::public.user_role,
         position = nullif(trim(new_position), '')
   where id = uid;
  return uid;
end;
$$;


-- เรียกได้เฉพาะคนที่ล็อกอินแล้ว (และในฟังก์ชันยังเช็คซ้ำว่าเป็น piriya)
revoke all on function public.is_user_admin_owner() from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_create_user(text, text, text, text) from public, anon;
grant execute on function public.is_user_admin_owner() to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;


-- ── ตรวจผล ──
select 'ฟังก์ชันจัดการผู้ใช้ 4 ตัว' as รายการ,
       case when (select count(distinct proname) from pg_proc
                  where proname in ('is_user_admin_owner','admin_set_password','admin_set_role','admin_create_user')) = 4
            then 'พร้อมใช้' else '❌ ไม่ครบ' end as ผล
union all
select 'pgcrypto (ใช้เข้ารหัสรหัสผ่าน)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where p.proname = 'gen_salt' and n.nspname = 'extensions') then 'พร้อมใช้' else '❌ ไม่อยู่ใน schema extensions' end
union all
select 'บัญชี piriya เป็นแอดมิน (คนเดียวที่ใช้เมนูนี้ได้)',
       case when exists (select 1 from public.users where lower(username) = 'piriya' and role = 'admin') then 'พร้อมใช้'
            when exists (select 1 from public.users where lower(username) = 'piriya') then '❌ มีบัญชี แต่ยังไม่ใช่แอดมิน'
            else '❌ ไม่พบบัญชีชื่อ piriya' end;
