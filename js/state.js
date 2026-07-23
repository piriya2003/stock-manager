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
let currentUserId  = null;  // uuid จาก auth.users
let loginTime      = null;
let sessionTimerInterval = null;

let inSession  = [];
let outSession = [];
let currentRepairJobId = null;
let currentViewDOId    = null;
let currentViewGRNId   = null;
let currentSwapJobId   = null;
let swapMode           = 'new';  // 'new' = เปลี่ยน SN ใหม่ | 'same' = ใช้ SN เดิม
let doModalMode        = 'create';
let doItems            = [];      // รายการสินค้าที่กำลังจะออก DO (จากเซสชั่นสด หรือจากประวัติ)
let doFromLiveSession  = true;    // true = มาจากเซสชั่นสแกนสด, false = มาจากประวัติที่ขายไปแล้ว
let grnModalMode       = 'create';

let impRows = [];
let stockSortCol = 'sn';
let stockSortDir = 'desc';
