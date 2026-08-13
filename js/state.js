// ══════════════════════════════════════════════════════════════
//  STATE (แคชในหน่วยความจำ — เติมข้อมูลจาก Supabase ตอน login)
// ══════════════════════════════════════════════════════════════
let stock       = [];
let txns        = [];
let masterProds = [];
let customers   = [];
let repairJobs  = [];
let doHistory   = [];
let grnHistory  = [];

let currentUser    = null;  // username (แสดงผล)
let currentRole    = null;  // 'admin' | 'staff'
let currentPosition = null; // ตำแหน่งงาน (เช่น HR, Executive) — แสดงแทน role label ถ้ามี
let currentUserId  = null;  // uuid จาก auth.users
let loginTime      = null;
let sessionTimerInterval = null;

let inSession  = [];
let outSession = [];
let sessionDispatchTime = null;  // เวลาเริ่มชุดจ่ายปัจจุบัน — สินค้าชุดเดียวกันใช้เวลาเดียวกัน (คีย์ของ "ชุดการจ่าย")
let outboundBatches     = [];    // ชุดการจ่ายที่แสดงอยู่ในหน้าประวัติ (ใช้อ้างอิงตอนกดสร้าง DO ของชุดนั้น)
let currentRepairJobId = null;
let currentViewDOId    = null;
let dovGroups          = [];    // กลุ่มสินค้า (ตามชื่อ) ที่กำลังดู/แก้ราคาอยู่ในหน้าประวัติ DO
let currentViewGRNId   = null;
let currentSwapJobId   = null;
let swapMode           = 'new';  // 'new' = เปลี่ยน SN ใหม่ | 'same' = ใช้ SN เดิม
let doModalMode        = 'create';
let doItems            = [];      // รายการสินค้าที่กำลังจะออก DO (จากเซสชั่นสด หรือจากประวัติ)
let doFromLiveSession  = true;    // true = มาจากเซสชั่นสแกนสด, false = มาจากประวัติที่ขายไปแล้ว
let grnModalMode       = 'create';

let txnsAllLoaded = false;   // true = ดึงประวัติการเคลื่อนไหวมาครบทุกรายการแล้ว

let impRows = [];
let stockSortCol = 'sn';
let stockSortDir = 'desc';
