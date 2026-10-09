// ══════════════════════════════════════════════════════════════
//  CONFIG — แก้ 2 ค่านี้ให้ตรงกับโปรเจกต์ Supabase ของคุณ
//  หาได้จาก Supabase Dashboard > Project Settings > API
// ══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://zjxwedonekouxalnwxvu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YfIIsSy9uuIHgOohnGNnMQ_1zvK_Ifa';

// pseudo-email domain สำหรับ login ด้วย username แบบเดิม
// (Supabase Auth ต้องการ email ภายใน แต่ผู้ใช้ยังพิมพ์แค่ username ตามปกติ)
//
// ⚠️ ห้ามแก้ค่านี้ตามชื่อแอป — บัญชีทุกคนใน Supabase Auth ถูกสร้างเป็น <ชื่อเล่น>@stockhq.local ไว้แล้ว
// เปลี่ยนเมื่อไหร่ ทุกคนล็อกอินไม่ได้ทันที เพราะระบบจะไปหาอีเมลที่ไม่มีอยู่จริง
// (ตอนเปลี่ยนชื่อแอปเป็น StockSG จึงคงบรรทัดนี้ไว้เหมือนเดิม — ผู้ใช้ไม่เห็นค่านี้อยู่แล้ว)
const USERNAME_DOMAIN = '@stockhq.local';

// คนเดียวที่เห็นเมนู "จัดการผู้ใช้" (ตั้งรหัสใหม่ให้คนที่ลืมรหัส) — แอดมินคนอื่นก็ไม่เห็น
// บรรทัดนี้แค่ซ่อนเมนู ตัวล็อกจริงอยู่ในฐานข้อมูล: admin_set_password() ใน stockhq_schema.sql
// จะเปลี่ยนคน ต้องแก้ทั้งสองที่ (แล้วรัน SQL ใหม่) ไม่งั้นเห็นเมนูแต่กดแล้วโดนปฏิเสธ
const USER_ADMIN_OWNER = 'piriya';

const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
