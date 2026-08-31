// ══════════════════════════════════════════════════════════════
//  I18N — สลับภาษาไทย / อังกฤษ
//
//  คีย์ของคำแปลคือ "ข้อความไทย" ตรงๆ ไม่ต้องคิดชื่อคีย์ใหม่ และถ้าลืมแปลคำไหน
//  ก็แค่โชว์ภาษาไทยตามเดิม ไม่พังและไม่ขึ้นเป็นคีย์ประหลาดให้ผู้ใช้เห็น
//
//  ข้อความในหน้าเว็บ (index.html) ไม่ต้องแก้ทีละจุด — ตอนโหลดจะจำข้อความไทยเดิม
//  ของทุก text node ไว้ก่อน แล้วสลับไปมาได้ ส่วนข้อความที่ JS สร้างเองต้องครอบ t() เอง
//
//  สิ่งที่ "ไม่" แปล และตั้งใจให้เป็นแบบนั้น:
//   - ข้อมูลที่ผู้ใช้คีย์เอง (ชื่อสินค้า ชื่อลูกค้า ประเภทอะไหล่ หมายเหตุ)
//   - ใบ DO / ใบ GRN ที่ปริ้นให้ลูกค้า — เป็นเอกสารส่งลูกค้าไทย ต้องเป็นไทยเสมอ
//   - toast / confirm / ข้อความ error ระหว่างทำรายการ (เฟสถัดไป)
// ══════════════════════════════════════════════════════════════
let currentLang = 'th';

const EN = {
  // ── หน้าเข้าสู่ระบบ ──
  'เข้าสู่ระบบ': 'Sign in',
  'ลืมรหัสผ่าน?': 'Forgot password?',
  'อีเมลที่ใช้สมัคร': 'Registered email',
  'ส่งลิงก์รีเซ็ตรหัสผ่าน': 'Send reset link',
  '← กลับไปเข้าสู่ระบบ': '← Back to sign in',
  'ชื่อผู้ใช้': 'Username',
  'รหัสผ่าน': 'Password',

  // ── เมนูข้าง ──
  '📍 ชลบุรี': '📍 Chonburi',
  'ภาพรวม': 'Overview',
  'แดชบอร์ด': 'Dashboard',
  'ข้อมูลหลัก': 'Master data',
  'สินค้า & ลูกค้า': 'Products & customers',
  'จัดการสต็อก': 'Stock',
  'สินค้าคงคลัง': 'Inventory',
  'รับเข้าสินค้า': 'Goods receipt',
  'โอน / ขาย': 'Transfer / sell',
  'สร้างใบ DO': 'Create DO',
  'อะไหล่': 'Spare parts',
  'ซ่อม': 'Repairs',
  'เคลม': 'Claims',
  'รายงาน & ระบบ': 'Reports & system',
  'ประวัติใบ DO': 'DO history',
  'ประวัติใบรับเข้า (GRN)': 'GRN history',
  'ประวัติการเคลื่อนไหว': 'Movement log',
  'ประวัติอะไหล่': 'Parts history',
  '⏱ เซสชัน: --:--': '⏱ Session: --:--',
  '🚪 ออกจากระบบ': '🚪 Sign out',

  // ── แถบบน ──
  'รับเข้า': 'Receive',
  'โอน/ขาย': 'Transfer/sell',
  'กำลัง Sync...': 'Syncing...',

  // ── แดชบอร์ด ──
  'ภาพรวมคลัง': 'Warehouse overview',
  'รีเฟรช': 'Refresh',
  'คลิกเพื่อดูรายการ': 'Click to view items',
  'สินค้าทั้งหมด': 'All items',
  'พร้อมใช้งาน': 'Available',
  'โอน / ขายออก': 'Transferred / sold',
  'รับซ่อม': 'In repair',
  'เคลม / ชำรุด': 'Claimed / damaged',
  'ของเข้า–ออก 7 วันล่าสุด': 'In / out, last 7 days',
  'เข้า': 'In',
  'ออก': 'Out',
  'รายการเคลื่อนไหวล่าสุด': 'Recent movements',
  'ดูทั้งหมด →': 'View all →',
  'สินค้าตามหมวดหมู่': 'Items by category',
  'ใบ DO ล่าสุด': 'Recent DOs',

  // ── หัวตาราง / คำที่ใช้ร่วมกันหลายหน้า ──
  'เวลา': 'Time',
  'วันที่': 'Date',
  'ประเภท': 'Type',
  'สินค้า': 'Item',
  'หมายเหตุ': 'Note',
  'หมวดหมู่': 'Category',
  'ชื่อสินค้า': 'Item name',
  'รหัส': 'Code',
  'ล็อต': 'Lot',
  'สถานะ': 'Status',
  'จัดการ': 'Actions',
  'แสดง': 'Showing',
  'รายการ': 'items',
  'ลูกค้า': 'Customer',
  'จำนวน': 'Qty',
  'คงเหลือ': 'On hand',
  'ชิ้น': 'pcs',
  'ใบ': 'docs',
  'ราย': 'customers',
  'จาก': 'From',
  'ถึง': 'To',
  'ปิด': 'Close',
  'บันทึก': 'Save',
  'ยกเลิก': 'Cancel',
  'ล้างตัวกรอง': 'Clear filters',
  'ผู้ทำรายการ': 'Done by',
  'ผู้จำหน่าย': 'Supplier',
  'เลขที่': 'No.',
  'เลขล็อต': 'Lot no.',
  'ชิ้น)': 'pcs)',
  'ดูประวัติ': 'View history',
  'ถ้ามี': 'optional',
  'ไม่บังคับ': 'Optional',
  '🔍 ค้นหา...': '🔍 Search...',
  '⬇ โหลดประวัติเก่าเพิ่ม': '⬇ Load older records',

  // ── สินค้าคงคลัง ──
  '— ทุกหมวดหมู่ —': '— All categories —',
  '— ทุกสถานะ —': '— All statuses —',
  'โอน/ขายแล้ว': 'Transferred/sold',
  'เคลม/ชำรุด': 'Claimed/damaged',
  '🏷️ เปลี่ยนชื่อสินค้า': '🏷️ Rename item',
  '🔍 ค้นหา ชื่อ / SN / รหัส / หมวดหมู่ / ล็อต...': '🔍 Search name / SN / code / category / lot...',
  '🔍 ค้นหา ชื่อ / SN / รหัส...': '🔍 Search name / SN / code...',

  // ── สินค้า & ลูกค้า ──
  '📦 เพิ่มต้นแบบสินค้า': '📦 Add product template',
  'หมวดหมู่หลัก': 'Main category',
  'หมวดหมู่ย่อย': 'Sub-category',
  'ชื่อสินค้า *': 'Item name *',
  'รหัสสินค้า': 'Item code',
  '+ บันทึกต้นแบบ': '+ Save template',
  '👥 ลูกค้า / สาขา': '👥 Customers / branches',
  'ชื่อลูกค้า / สาขา *': 'Customer / branch name *',
  'ที่อยู่ / เลขผู้เสียภาษี *': 'Address / tax ID *',
  '+ เพิ่มลูกค้า': '+ Add customer',
  'เช่น POS, ปริ้นเตอร์': 'e.g. POS, printer',
  'เช่น สลิม, ตั้งโต๊ะ (ไม่ใส่ก็ได้)': 'e.g. slim, desktop (optional)',
  'เช่น POS-001': 'e.g. POS-001',
  'เช่น TOPS สาขาชลบุรี': 'e.g. TOPS Chonburi branch',
  'ที่อยู่ที่จะพิมพ์บนใบ DO\nเช่น 52 ซ.ชลบุรี 42 อ.เมือง จ.ชลบุรี 11000\nเลขประจำตัวผู้เสียภาษี : 0105540047132':
    'Address printed on the DO\ne.g. 52 Soi Chonburi 42, Mueang, Chonburi 11000\nTax ID: 0105540047132',

  // ── Import ──
  'Import ข้อมูล Excel / CSV': 'Import from Excel / CSV',
  'คลิกหรือลากไฟล์มาวาง': 'Click or drop a file here',
  'รองรับ .xlsx .xls .csv — สูงสุด 10MB': 'Supports .xlsx .xls .csv — up to 10MB',
  '📋 คอลัมน์ที่รองรับ': '📋 Supported columns',
  '💡 ใส่ชื่อหัวคอลัมน์ไว้แถวแรก ระบบจะจับคู่ให้เอง (ไทยหรืออังกฤษก็ได้) — สลับลำดับคอลัมน์ได้ ไม่ต้องเรียงตามนี้':
    '💡 Put column headers in the first row and they are matched automatically (Thai or English) — any column order works',
  'ตัวอย่างข้อมูล (Preview)': 'Data preview',
  '✕ ยกเลิก': '✕ Cancel',
  '✅ นำเข้าข้อมูล': '✅ Import',
  '🔗 จับคู่คอลัมน์': '🔗 Column mapping',
  'ตรวจให้ตรงก่อนกดนำเข้า — ถ้าจับคู่ผิด ข้อมูลจะเข้าผิดช่อง':
    'Check the mapping before importing — a wrong match puts data in the wrong field',

  // ── รับเข้าสินค้า ──
  '💡 ตั้งค่าชื่อสินค้าไว้ครั้งเดียว แล้วสแกน SN ต่อเนื่องได้เลย ระบบบันทึกอัตโนมัติเมื่อกด Enter':
    '💡 Set the item details once, then keep scanning SNs — each one saves when you press Enter',
  'วันที่รับ': 'Received on',
  'คงเหลือ (Available)': 'On hand (available)',
  'ชิ้นพร้อมใช้งาน': 'pcs available',
  'ผู้จำหน่าย (Supplier)': 'Supplier',
  'เลขที่ PO': 'PO no.',
  'เลขล็อต (Lot No.)': 'Lot no.',
  'สแกน Serial Number': 'Scan serial number',
  'เพื่อบันทึก': 'to save',
  '📥 บันทึกรับเข้า': '📥 Save receipt',
  '📋 หรือ': '📋 Or',
  'รับเข้าหลายรายการทีเดียว': 'receive many at once',
  'โดยไม่ต้องสแกน — วาง/พิมพ์ Serial Number (คัดลอกจาก Excel ได้) แล้วกดรับเข้าทั้งหมด':
    'without scanning — paste or type serial numbers (straight from Excel), then receive them all',
  'ใช้ชื่อสินค้า/หมวดหมู่/ล็อต/ผู้จำหน่ายจากช่องด้านบน': 'Uses the item, category, lot and supplier from the fields above',
  'รายการ SN หลายตัว — คั่นด้วยขึ้นบรรทัด / เว้นวรรค / คอมมา': 'Serial numbers — one per line, or separated by spaces / commas',
  '📥 รับเข้าทั้งหมด (ไม่ต้องสแกน)': '📥 Receive all (no scanning)',
  '📋 รับเข้าเซสชั่นนี้': '📋 Received this session',
  '📄 บันทึก GRN': '📄 Save GRN',
  'คลิกที่นี่แล้วยิงบาร์โค้ด...': 'Click here, then scan...',
  'เลขที่ใบสั่งซื้อ (ถ้ามี)': 'Purchase order no. (optional)',
  'เลขล็อต/รุ่นการผลิต (ถ้ามี)': 'Lot / batch no. (optional)',
  'เช่น บริษัท ABC จำกัด': 'e.g. ABC Co., Ltd.',
  'รหัส (ถ้ามี)': 'Code (optional)',
  'เช่น\nSK46025110001\nSK46025110002\nSK46025110003': 'e.g.\nSK46025110001\nSK46025110002\nSK46025110003',
  'ยิงบาร์โค้ดต่อกันได้เลย หรือวางหลาย SN คั่นด้วยเว้นวรรค / ขึ้นบรรทัดใหม่':
    'Keep scanning, or paste several SNs separated by spaces / new lines',

  // ── โอน / ขาย ──
  'โอน / ขายสินค้า': 'Transfer / sell',
  '💡 เลือกลูกค้าปลายทางแล้วสแกน SN ต่อเนื่องเพื่อตัดสต็อกอย่างรวดเร็ว':
    '💡 Pick the destination customer, then scan SNs to draw them out of stock',
  '📤 โอนสินค้า (Transfer)': '📤 Transfer',
  '💰 ขายสินค้า (Sell)': '💰 Sell',
  '📦 เบิกสินค้า (Withdraw)': '📦 Withdraw',
  '🔴 สินค้าเคลม / ส่งซ่อม (Claim/Repair)': '🔴 Claim / send for repair',
  'ลูกค้า / สาขาปลายทาง *': 'Destination customer / branch *',
  'ลูกค้า / สาขาปลายทาง': 'Destination customer / branch',
  'สแกน SN เพื่อตัดสต็อก': 'Scan SN to draw from stock',
  '📤 ตัดสต็อก': '📤 Draw from stock',
  '📄 สร้าง DO': '📄 Create DO',
  'ตัดหลายรายการทีเดียว': 'draw many at once',
  'โดยไม่ต้องสแกน — วาง/พิมพ์ Serial Number (คัดลอกจาก Excel ได้) แล้วกดตัดสต็อกทั้งหมด':
    'without scanning — paste or type serial numbers (straight from Excel), then draw them all',
  '📤 ตัดสต็อกทั้งหมด (ไม่ต้องสแกน)': '📤 Draw all (no scanning)',
  'รายการโอน/ขายในเซสชั่นนี้ (': 'Drawn this session (',
  'รายการ)': ' items)',
  '🗑 ล้างเซสชั่น': '🗑 Clear session',
  'ยิงบาร์โค้ดตรงนี้...': 'Scan here...',
  'โอนสินค้า': 'Transfer',
  'ขายสินค้า': 'Sell',
  'เบิกสินค้า': 'Withdraw',
  'สินค้าเคลม/ส่งซ่อม': 'Claim / repair',

  // ── สร้างใบ DO ──
  'สร้าง DO จากเลข SN โดยตรง': 'Create a DO straight from serial numbers',
  '— วาง/พิมพ์/สแกน Serial Number ที่จ่ายออกไปแล้ว (คนละวัน/คนละรอบสแกนก็รวมใบเดียวได้) ระบบจะข้าม SN ที่ไม่พบหรือยังไม่ได้จ่ายออกให้อัตโนมัติ':
    '— paste, type or scan SNs that already went out (different days or scan rounds can share one DO). SNs not found or still in stock are skipped automatically',
  'รายการ SN — คั่นด้วยขึ้นบรรทัด / เว้นวรรค / คอมมา': 'Serial numbers — one per line, or separated by spaces / commas',
  '📄 สร้าง DO จากรายการนี้': '📄 Create DO from this list',
  'รายการสินค้าที่โอน/ขายออกไปแล้วทั้งหมด': 'Everything already transferred or sold',
  'วันที่จ่ายออก': 'Dispatched on',
  '— ทุกลูกค้า —': '— All customers —',
  '📄 สร้าง DO จากชุดที่เลือก': '📄 Create DO from selected',
  '💡 เลือก "วันที่จ่ายออก" + "ลูกค้า" เพื่อแยกใบ DO ให้ตรง — วันเดียวมีหลายใบ (หลายลูกค้า) ก็แยกได้':
    '💡 Pick a dispatch date and a customer to split DOs correctly — one day can hold several DOs for different customers',
  'สรุปจำนวนรวม:': 'Total:',
  'รหัส / หมวดหมู่': 'Code / category',
  'จำนวนที่ออก (ชิ้น)': 'Qty out (pcs)',
  'สร้างใบ DO เฉพาะรายการที่กรองอยู่ (วันที่/ค้นหา)': 'Create a DO from the filtered rows only (date / search)',
  'รวมชุดที่ติ๊กเลือกไว้เป็นใบ DO ใบเดียว': 'Merge the ticked batches into one DO',

  // ── อะไหล่ ──
  'นับเป็นจำนวน ไม่ต้องยิง SN รายชิ้น — เช่น RAM, จอ, คีย์บอร์ด':
    'Counted by quantity, no per-piece SN — RAM, monitors, keyboards and so on',
  'ชนิดอะไหล่': 'Part types',
  'รวมทุกชิ้น': 'Total pieces',
  'ใกล้หมด': 'Running low',
  '➕ เพิ่ม / แก้ไขอะไหล่': '➕ Add / edit a part',
  'ชื่ออะไหล่ *': 'Part name *',
  'รหัสอะไหล่': 'Part code',
  'หน่วยนับ': 'Unit',
  'จำนวนตั้งต้น': 'Opening qty',
  'วันที่รับเข้า': 'Received on',
  'เตือนเมื่อเหลือต่ำกว่า': 'Warn below',
  '+ เพิ่มอะไหล่': '+ Add part',
  '— ทุกประเภท —': '— All types —',
  'เฉพาะที่ใกล้หมด': 'Running low only',
  'วันที่ทำรายการ': 'Movement date',
  '⚠️ ย้อนหลัง': '⚠️ Backdated',
  'เช่น RAM DDR4 8GB Kingston': 'e.g. RAM DDR4 8GB Kingston',
  'เช่น RAM / จอ / คีย์บอร์ด': 'e.g. RAM / monitor / keyboard',
  'ชิ้น / ตัว / เส้น': 'pcs / units / cables',
  'ใส่ 0 = ไม่ต้องเตือน': '0 means no warning',
  'วันที่ของยอดตั้งต้น — ใส่ย้อนหลังได้ถ้าของมาถึงก่อนหน้านี้': 'Date of the opening quantity — backdate it if the stock arrived earlier',
  'วันที่ที่จะบันทึกลงประวัติ ตอนกดรับเข้า/เบิก': 'The date written to history when you receive or withdraw',
  '🔍 ค้นหา ชื่อ / รหัส / ประเภท...': '🔍 Search name / code / type...',
  '📜 ประวัติอะไหล่:': '📜 Part history:',

  // ── ประวัติอะไหล่ ──
  'รับเข้า/เบิกใช้ของอะไหล่ทุกตัวรวมกัน — กรองแล้ว Export ได้':
    'Every part receipt and withdrawal in one place — filter it, then export',
  'รายการที่แสดง': 'Rows shown',
  'รับเข้ารวม': 'Total received',
  'เบิกใช้รวม': 'Total withdrawn',
  '➕ รับเข้า': '➕ Received',
  '➖ เบิกใช้': '➖ Withdrawn',
  '— ทุกอะไหล่ —': '— All parts —',
  '— ทุกคน —': '— Everyone —',
  '🔍 ค้นหา ชื่อ / รหัส / หมายเหตุ...': '🔍 Search name / code / note...',

  // ── ซ่อม ──
  '0 รอ': '0 waiting',
  '0 กำลังซ่อม': '0 in progress',
  '0 เสร็จวันนี้': '0 done today',
  '📥 รับเครื่อง': '📥 Check in',
  '📋 รายการซ่อม': '📋 Repair jobs',
  '💡 สแกน SN เครื่องที่ต้องการส่งซ่อม กรอกอาการเสีย แล้วกด บันทึก — เครื่องจะอยู่ในสถานะ':
    '💡 Scan the SN, describe the fault and save — the unit then sits in status',
  'รอซ่อม': 'Waiting',
  'กำลังซ่อม': 'In progress',
  'ซ่อมเสร็จ': 'Repaired',
  'สแกน SN เครื่องที่มีปัญหา *': 'Scan the faulty unit SN *',
  'ลูกค้า / โปรเจกต์': 'Customer / project',
  'ช่างซ่อม / ผู้รับผิดชอบ': 'Technician / owner',
  'อาการเสีย / สาเหตุ *': 'Fault / cause *',
  '🔧 บันทึกรับซ่อม': '🔧 Save check-in',
  '🟡 รอซ่อม': '🟡 Waiting',
  '🔵 กำลังซ่อม': '🔵 In progress',
  '🟢 ซ่อมเสร็จ': '🟢 Repaired',
  'ยิงบาร์โค้ดหรือพิมพ์ SN...': 'Scan or type an SN...',
  'ชื่อช่าง (ถ้ามี)': 'Technician name (optional)',
  'เช่น บอร์ดพัง, เปิดไม่ติด, จอดับ, สายไฟขาด...': 'e.g. dead board, will not power on, blank screen, broken cable...',
  '🔍 ค้นหา SN / ชื่อสินค้า...': '🔍 Search SN / item name...',
  '🔧 รายละเอียดการซ่อม': '🔧 Repair details',
  'เคลมเครื่อง': 'Claim unit',
  '📦 ข้อมูลสินค้า': '📦 Item details',
  'ช่างซ่อม': 'Technician',
  '⏱ เวลา': '⏱ Timeline',
  'รับเครื่อง': 'Checked in',
  'เริ่มซ่อม': 'Started',
  'ระยะเวลา': 'Duration',
  '🚨 อาการเสีย / สาเหตุ': '🚨 Fault / cause',
  '🔩 บันทึกการซ่อม / เปลี่ยนอะไหล่': '🔩 Repair notes / parts replaced',
  'บันทึกสิ่งที่ซ่อม...': 'What was repaired...',

  // ── เคลม ──
  'รายการเคลม': 'Claims',
  '0 รายการ': '0 items',
  'SN เดิม (รับเคลม)': 'Original SN (claimed)',
  'SN ทดแทน': 'Replacement SN',
  'เหตุผลที่เคลม': 'Claim reason',
  'วันที่เคลม': 'Claimed on',
  '🔍 ค้นหา SN เดิม / SN ทดแทน / สินค้า / ลูกค้า...': '🔍 Search original SN / replacement SN / item / customer...',
  '🔄 เคลมเครื่อง / สลับ Serial Number': '🔄 Claim / swap serial number',
  '⚠️ ใช้เมื่อ': '⚠️ Use this when a unit',
  'ซ่อมไม่ได้': 'cannot be repaired',
  'แล้วเคลมเครื่อง — เลือกได้ว่าจะ': 'and is claimed — you can either',
  'เปลี่ยนเป็น SN ใหม่': 'issue a new SN',
  'หรือ': 'or',
  'ใช้ SN เดิม': 'keep the same SN',
  '📦 เครื่องที่ส่งมาเคลม (SN เดิม)': '📦 Unit sent for claim (original SN)',
  '🔄 เปลี่ยน SN ใหม่': '🔄 New SN',
  '📍 ใช้ SN เดิม': '📍 Same SN',
  'สแกน SN เครื่องใหม่ที่จะส่งให้ลูกค้าแทน *': 'Scan the replacement unit SN *',
  'เหตุผลในการเคลม *': 'Claim reason *',
  '🔄 ยืนยันสลับ SN': '🔄 Confirm SN swap',
  'สแกนหรือพิมพ์ SN เครื่องใหม่...': 'Scan or type the new SN...',
  'เช่น บอร์ดไหม้ ซ่อมไม่ได้ / เครื่องชำรุดถาวร...': 'e.g. burnt board, beyond repair / permanently damaged...',

  // ── ประวัติใบ DO / GRN ──
  '🔗 รวมใบที่เลือก': '🔗 Merge selected',
  '📤 โอนสินค้า': '📤 Transfer',
  '💰 ขายสินค้า': '💰 Sell',
  '📦 เบิกสินค้า': '📦 Withdraw',
  '🔴 สินค้าเคลม / ส่งซ่อม': '🔴 Claim / repair',
  'ใบ DO ทั้งหมด': 'Total DOs',
  'รายการสินค้ารวม': 'Total line items',
  'ลูกค้าที่รับสินค้า': 'Receiving customers',
  'เลขที่ DO': 'DO no.',
  'วันที่ออก': 'Issued on',
  'ลูกค้า / สาขา': 'Customer / branch',
  'ผู้สร้าง': 'Created by',
  'ใบ GRN ทั้งหมด': 'Total GRNs',
  'ผู้จำหน่ายทั้งหมด': 'Suppliers',
  'เลขที่ GRN': 'GRN no.',
  '🔍 ค้นหา เลขที่ / ลูกค้า / สินค้า...': '🔍 Search no. / customer / item...',
  '🔍 ค้นหา เลขที่ / ผู้จำหน่าย / ล็อต / สินค้า...': '🔍 Search no. / supplier / lot / item...',
  'รวมใบที่ติ๊กเลือกไว้เป็นใบเดียว': 'Merge the ticked documents into one',

  // ── ประวัติการเคลื่อนไหว ──
  '📥 รับเข้า': '📥 Received',
  '📤 โอน': '📤 Transferred',
  '💰 ขาย': '💰 Sold',
  '📦 เบิก': '📦 Withdrawn',
  '🔴 เคลม / ส่งซ่อม': '🔴 Claim / repair',
  '🔧 รับซ่อม': '🔧 Repair in',
  '♻️ คืนสต็อก': '♻️ Returned to stock',
  'คืนสต็อก': 'Returned to stock',

  // ── Backup ──
  'ข้อมูลที่จะ Export:': 'What gets exported:',
  '✅ สินค้าคงคลังทั้งหมด': '✅ All inventory',
  '✅ ประวัติการเคลื่อนไหว': '✅ Movement log',
  '✅ ต้นแบบสินค้า': '✅ Product templates',
  '✅ รายชื่อลูกค้า': '✅ Customer list',
  '✅ ประวัติซ่อมทั้งหมด': '✅ All repair jobs',
  '✅ ประวัติใบ DO ทั้งหมด': '✅ All DOs',
  '✅ เลขที่ DO ปัจจุบัน': '✅ Current DO number',
  '📊 Export ทั้งหมดเป็น CSV': '📊 Export everything as CSV',
  '💡 เก็บไฟล์ที่ได้ไว้ที่ปลอดภัย — การกู้คืนข้อมูลกลับเข้าระบบต้องทำผ่าน Supabase SQL Editor โดยผู้ดูแลระบบ':
    '💡 Keep the file somewhere safe — restoring data goes through the Supabase SQL editor and needs an admin',
  '📋 สถิติข้อมูลปัจจุบัน': '📋 Current data',

  // ── หน้าต่างต่างๆ (ตัวเอกสาร DO/GRN เป็นไทยเสมอ แปลเฉพาะปุ่ม/หัวข้อรอบๆ) ──
  '📄 ใบส่งของ (DO)': '📄 Delivery order',
  '💾 บันทึก DO': '💾 Save DO',
  '📋 ประเภท / รายการ': '📋 Type / items',
  '✏️ แก้ไขใบนี้': '✏️ Edit this document',
  '💾 บันทึกการแก้ไข': '💾 Save changes',
  '🖨️ พิมพ์': '🖨️ Print',
  '📦 ใบรับเข้าสินค้า (GRN)': '📦 Goods receive note',
  '💾 บันทึก GRN': '💾 Save GRN',
  '✏️ แก้ไขสินค้า': '✏️ Edit item',
  '✅ พร้อมใช้งาน': '✅ Available',
  '📤 โอน/ขายออกแล้ว': '📤 Transferred/sold',
  '🔴 เคลม/ชำรุด': '🔴 Claimed/damaged',
  '💡 ใช้แก้ตอนตัดสต็อกเลือกลูกค้าผิด หรือของเก่าที่ไม่รู้ว่าจ่ายให้ใคร — พิมพ์เองได้ ไม่ต้องมีในทะเบียน':
    '💡 Use this when the wrong customer was picked, or for old stock with no recorded recipient — type any name, it need not be registered',
  '🏷️ เปลี่ยนชื่อสินค้าทั้งหมด': '🏷️ Rename item everywhere',
  'ชื่อเดิม (เลือกจากที่มีในคลัง)': 'Current name (from inventory)',
  'ชื่อใหม่': 'New name',
  '* เปลี่ยนชื่อในคลังสินค้าทุกชิ้นที่ใช้ชื่อเดิม (รวมของที่ขาย/ซ่อม/เคลมไปแล้ว) และชื่อในต้นแบบสินค้า':
    '* Renames every piece using the old name (including sold, repaired and claimed ones) and the product template',
  '* ใบ DO / GRN ที่ออกไปแล้วยังเก็บชื่อเดิมไว้ตามที่พิมพ์จริง ไม่ถูกแก้ย้อนหลัง':
    '* DOs and GRNs already issued keep the name as printed — they are not rewritten',
  'เปลี่ยนชื่อ': 'Rename',
  'พิมพ์ชื่อใหม่ที่ต้องการ...': 'Type the new name...',
  '📄 รายละเอียดใบ DO': '📄 DO details',
  '📋 ข้อมูลใบ DO (แก้ไขได้)': '📋 DO details (editable)',
  'เลขที่ (No.)': 'Number',
  'ลูกค้า (TO)': 'Customer (to)',
  'ที่อยู่ / เลขผู้เสียภาษี': 'Address / tax ID',
  'พนักงานขาย (Staff)': 'Salesperson',
  'วันที่บนใบ (Date Issued)': 'Date issued',
  'สร้างเมื่อ': 'Created',
  '📦 สรุปรายการ': '📦 Line summary',
  '📝 หมายเหตุ (แก้ไขได้)': '📝 Note (editable)',
  '➕ เพิ่มสินค้าเข้าใบนี้ (ตัดสต็อกให้ทันทีตอนเพิ่ม)': '➕ Add an item to this DO (drawn from stock immediately)',
  '➕ เพิ่ม & ตัดสต็อก': '➕ Add & draw',
  'รายการสินค้าทั้งหมด (': 'All line items (',
  'ชิ้น) — แก้ไขแล้วกด "บันทึกการแก้ไข"': ' pcs) — after editing, press "Save changes"',
  'สินค้า (SN)': 'Item (SN)',
  'ราคาต่อหน่วย': 'Unit price',
  'รวม:': 'Subtotal:',
  'สุทธิ:': 'Net:',
  '🖨️ เปิด & พิมพ์ใบ DO': '🖨️ Open & print the DO',
  '📦 รายละเอียดใบรับเข้า (GRN)': '📦 GRN details',
  '📋 ข้อมูลใบ GRN': '📋 GRN details',
  '🖨️ เปิด & พิมพ์ใบ GRN': '🖨️ Open & print the GRN',
  'ประเภทใบ และเพิ่ม/ถอดรายการสินค้า (2 อย่างนี้ไม่ได้พิมพ์บนใบ)':
    'Document type and adding/removing items (neither is printed on the document)',
  'เว้นว่างไว้ = ไม่ระบุ': 'Leave blank for none',
  'ที่อยู่ลูกค้าที่พิมพ์บนใบ DO': 'Customer address printed on the DO',
  'หมายเหตุที่จะแสดงบนใบ DO': 'Note shown on the DO',
  'เช่น 21-Aug-2026': 'e.g. 21-Aug-2026',

  // ── ข้อความที่ JS วาดเอง: ป้ายสถานะ ──
  '● พร้อมใช้': '● Available',
  '● โอน/ขาย': '● Transferred/sold',
  '● รับซ่อม': '● In repair',
  '🔴 เคลมเครื่อง': '🔴 Claimed',
  '🔴 เคลม/ส่งซ่อม': '🔴 Claim/repair',
  '🔧 ซ่อม': '🔧 Repair',
  '♻️ คืน': '♻️ Returned',
  'โอน': 'Transfer',

  // ── ข้อความที่ JS วาดเอง: ตารางอะไหล่ ──
  'ชื่ออะไหล่': 'Part name',
  'รับเข้าทั้งหมด': 'Total received',
  'เบิกไปแล้ว': 'Withdrawn',
  'ขั้นต่ำ': 'Min',
  'รับเข้า / เบิกใช้': 'Receive / withdraw',
  '⚠️ ใกล้หมด': '⚠️ Low',
  '➕ เข้า': '➕ In',
  '➖ เบิก': '➖ Out',
  'เบิกไปใช้': 'Withdraw for use',
  'แก้ไข': 'Edit',
  'ลบ': 'Delete',
  'ไม่พบอะไหล่ตามที่ค้นหา': 'No parts match your search',
  'ยังไม่มีอะไหล่ — เพิ่มรายการแรกได้จากฟอร์มด้านบน': 'No parts yet — add the first one with the form above',

  // ── ข้อความที่ JS วาดเอง: ประวัติอะไหล่ ──
  'คงเหลือหลังทำ': 'Balance after',
  'หมายเหตุ / เบิกไปทำอะไร': 'Note / what it was used for',
  '(ลบไปแล้ว)': '(deleted)',
  'ไม่พบรายการตามที่กรอง': 'No rows match these filters',
  'ยังไม่มีประวัติรับเข้า/เบิกใช้': 'No receipts or withdrawals yet',
  'โหลดประวัติมาครบทุกรายการแล้ว': 'All records loaded',
  'โหลดมาแล้ว': 'Loaded',
  'ของเก่ากว่านี้กดปุ่มโหลดประวัติเก่าเพิ่ม': 'press "Load older records" for anything older',

  // ── ข้อความที่ JS วาดเอง: ตารางว่างของหน้าอื่น ──
  'ยังไม่มีประวัติ': 'No history yet',
  'ยังไม่มีประวัติใบ DO': 'No DOs yet',
  'ยังไม่มีประวัติใบรับเข้า': 'No GRNs yet',
  'ยังไม่มีรายการ': 'Nothing here yet',
  'ยิงบาร์โค้ดเพื่อเริ่มได้เลย': 'Scan a barcode to start',
  'ยังไม่มีรายการโอน/ขายออก': 'Nothing transferred or sold yet',
  'ยังไม่มีรายการเคลม': 'No claims yet',
  'ไม่พบสินค้า': 'No items found',
};

// ── แปลข้อความหนึ่งก้อน — ไม่มีคำแปลก็คืนภาษาไทยเดิม ──
function t(s) {
  if (currentLang !== 'en') return s;
  return EN[s] ?? EN[String(s).trim()] ?? s;
}

// ── จำข้อความไทยเดิมของหน้าเว็บไว้ตอนโหลด แล้วสลับไปมาได้ ──
// เก็บ node จริงไว้เลย ไม่ใช่ค้นหาใหม่ทุกครั้ง — ของที่ JS วาดทับทีหลังจะไม่โดนแตะ
// (ส่วนนั้นครอบ t() ในโค้ดเอาเอง) จึงไม่มีทางแปลทับ "ข้อมูล" ของผู้ใช้
let langNodes = [];
function snapshotLangNodes() {
  const TH = /[฀-๿]/;
  langNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const tag = n.parentElement?.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    if (TH.test(n.nodeValue)) langNodes.push({ node: n, th: n.nodeValue });
  }
  document.querySelectorAll('[placeholder], [title]').forEach(el => {
    ['placeholder', 'title'].forEach(a => {
      const v = el.getAttribute(a);
      if (v && TH.test(v)) langNodes.push({ el, attr: a, th: v });
    });
  });
}

function applyLang() {
  langNodes.forEach(item => {
    // ข้อความไทยเดิมมักมีเว้นวรรค/ขึ้นบรรทัดห่อไว้ — แปลเฉพาะแก่นแล้วใส่ช่องว่างเดิมกลับ
    const trimmed = item.th.trim();
    const translated = currentLang === 'en' ? (EN[trimmed] ?? trimmed) : trimmed;
    const out = item.th.replace(trimmed, translated);
    if (item.attr) item.el.setAttribute(item.attr, out);
    else item.node.nodeValue = out;
  });
  document.documentElement.lang = currentLang;
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = currentLang === 'en' ? 'ไทย' : 'EN';
    btn.title = currentLang === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English';
  }
}

function initLang() {
  currentLang = localStorage.getItem('shq_lang') === 'en' ? 'en' : 'th';
  snapshotLangNodes();
  applyLang();
}

function toggleLang() {
  currentLang = currentLang === 'en' ? 'th' : 'en';
  localStorage.setItem('shq_lang', currentLang);  // เก็บแค่ภาษา ไม่ใช่ข้อมูลธุรกิจ
  applyLang();
  // ตารางกับการ์ดต่างๆ JS วาดเอง ต้องวาดใหม่ถึงจะเปลี่ยนภาษาตาม
  const active = document.querySelector('.nav-item.active');
  const id = active?.id?.replace(/^nav-/, '');
  if (id && typeof tab === 'function' && currentUser) tab(id);
  if (typeof updateClock === 'function') updateClock();
}
