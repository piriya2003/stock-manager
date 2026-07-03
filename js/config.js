// ══════════════════════════════════════════════════════════════
//  CONFIG — แก้ 2 ค่านี้ให้ตรงกับโปรเจกต์ Supabase ของคุณ
//  หาได้จาก Supabase Dashboard > Project Settings > API
// ══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://zjxwedonekouxalnwxvu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YfIIsSy9uuIHgOohnGNnMQ_1zvK_Ifa';

// pseudo-email domain สำหรับ login ด้วย username แบบเดิม
// (Supabase Auth ต้องการ email ภายใน แต่ผู้ใช้ยังพิมพ์แค่ username ตามปกติ)
const USERNAME_DOMAIN = '@stockhq.local';

const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
