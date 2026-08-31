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

let userNames      = {};    // id ของผู้ใช้ → ชื่อผู้ใช้ (เอกสารเก็บแต่ id ต้องแปลงกลับตอนแสดง)

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
let selectedBatchKeys   = new Set();  // ชุดที่ติ๊กไว้เพื่อรวมออกเป็นใบ DO ใบเดียว
let selectedDOIds       = new Set();  // ใบ DO ที่ติ๊กไว้เพื่อรวมเป็นใบเดียว
let currentRepairJobId = null;
let currentViewDOId    = null;
let dovGroups          = [];    // กลุ่มสินค้า (ตามชื่อ) ที่กำลังดู/แก้ราคาอยู่ในหน้าประวัติ DO
let currentViewGRNId   = null;
let currentSwapJobId   = null;
let swapMode           = 'new';  // 'new' = เปลี่ยน SN ใหม่ | 'same' = ใช้ SN เดิม
let doModalMode        = 'create';
let doItems            = [];      // รายการสินค้าที่กำลังจะออก DO (จากเซสชั่นสด หรือจากประวัติ)
let doFromLiveSession  = true;    // true = มาจากเซสชั่นสแกนสด, false = มาจากประวัติที่ขายไปแล้ว
let doCustId           = null;    // id ลูกค้าของใบ DO ที่กำลังกรอก (ชุดเก่าอาจไม่ใช่คนที่เลือกค้างไว้หน้าสแกน)
let grnModalMode       = 'create';

let txnsAllLoaded = false;   // true = ดึงประวัติการเคลื่อนไหวมาครบทุกรายการแล้ว

// ── อะไหล่ (นับเป็นจำนวน ไม่ผูก SN) ──
let parts            = [];     // อะไหล่แต่ละชนิด พร้อมยอดคงเหลือ
let partMoves        = [];     // ประวัติรับเข้า/เบิกใช้
let partsTableMissing = false; // true = ยังไม่ได้รัน sql/add-parts.sql — เมนูอะไหล่จะบอกให้ไปรันก่อน
let editingPartId    = null;   // ไม่ null = ฟอร์มอะไหล่กำลังอยู่ในโหมดแก้ไข
let partMovesAllLoaded = false; // true = ดึงประวัติอะไหล่มาครบทุกรายการแล้ว
let partTotals       = {};     // part_id → { in, out } ยอดรับเข้า/เบิกสะสมทั้งชีวิตของอะไหล่ตัวนั้น
                               // นับจากประวัติ "ทุกแถว" ไม่ใช่แค่ partMoves ที่โหลดมาแสดง

let impRows = [];
let impHeaders = [];   // หัวคอลัมน์จากไฟล์ที่อัปโหลด
let impMap = {};       // ฟิลด์ในระบบ → เลขคอลัมน์ในไฟล์ (-1 = ไม่ใช้)
let stockSortCol = 'sn';
let stockSortDir = 'desc';
