// ══════════════════════════════════════════════════════════════
//  STATE (แคชในหน่วยความจำ — เติมข้อมูลจาก Supabase ตอน login)
// ══════════════════════════════════════════════════════════════
let stock       = [];
let txns        = [];
let masterProds = [];
let customers   = [];
let repairJobs  = [];
let doHistory   = [];

let currentUser    = null;  // username (แสดงผล)
let currentRole    = null;  // 'admin' | 'staff'
let currentUserId  = null;  // uuid จาก auth.users
let loginTime      = null;
let sessionTimerInterval = null;

let inSession  = [];
let outSession = [];
let currentRepairJobId = null;
let currentViewDOId    = null;
let currentSwapJobId   = null;
let doModalMode        = 'create';

let impRows = [];
let stockSortCol = 'sn';
let stockSortDir = 'desc';
