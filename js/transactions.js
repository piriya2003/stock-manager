// ══════════════════════════════════════════════════════════════
//  TRANSACTIONS LOG
// ══════════════════════════════════════════════════════════════
const TX_PAGE = 500;   // จำนวนที่ดึงต่อรอบ (ตอน login ดึงชุดแรกชุดเดียว ให้เข้าระบบไว)

// แปลงแถวจากฐานข้อมูลเป็นรูปแบบที่หน้าจอใช้ — ใช้ร่วมกันทั้งตอนโหลดครั้งแรกและตอนโหลดเพิ่ม
function mapTxRow(t) {
  return { id: t.id, date: t.tx_date, type: t.type, name: t.item_name, code: t.item_code,
           sn: t.sn, balance: t.balance, note: t.note, user: t.performed_by, createdAt: t.created_at };
}

// โหลดประวัติเก่าเพิ่มทีละหน้า — เดิมดึงแค่ 500 รายการล่าสุดแล้วจบ ของเก่ากว่านั้นหายไปจากหน้ารายงาน
async function loadMoreTxns() {
  if (txnsAllLoaded) return;
  const btn = document.getElementById('rp-more-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังโหลด...'; }
  try {
    const { data, error } = await supaClient.from('transactions')
      .select('*').order('created_at', { ascending: false })
      .range(txns.length, txns.length + TX_PAGE - 1);
    if (error) throw error;
    // ระหว่างนี้อาจมีรายการใหม่แทรกเข้ามาจนหน้าต่างเลื่อน — กันซ้ำด้วย id
    const seen = new Set(txns.map(t => t.id));
    const rows = (data || []).filter(t => !seen.has(t.id)).map(mapTxRow);
    txns.push(...rows);
    if (!data || data.length < TX_PAGE) txnsAllLoaded = true;
    renderReport();
    toast(rows.length ? `โหลดเพิ่ม ${rows.length} รายการ (รวม ${txns.length})` : 'ครบทุกรายการแล้ว', 'success');
  } catch (err) {
    toast('โหลดประวัติเพิ่มล้มเหลว: ' + err.message, 'error');
  } finally { updateTxMoreBtn(); }
}

function updateTxMoreBtn() {
  const btn = document.getElementById('rp-more-btn');
  if (!btn) return;
  btn.disabled = txnsAllLoaded;
  btn.style.display = txnsAllLoaded ? 'none' : 'inline-flex';
  btn.textContent = '⬇ โหลดประวัติเก่าเพิ่ม';
}

async function logTransaction(date, type, name, code, sn, balance, note) {
  const row = { tx_date: date, type, item_name: name, item_code: code, sn, balance, note, performed_by: currentUserId };
  const local = { date, type, name, code, sn, balance, note, user: currentUserId, createdAt: nowISO() };
  txns.unshift(local);
  try {
    const { data, error } = await supaClient.from('transactions').insert(row).select().single();
    if (error) throw error;
    if (data) local.id = data.id;   // เก็บ id ไว้กันโหลดซ้ำตอนกดโหลดประวัติเก่าเพิ่ม
  } catch (err) { console.error('logTransaction failed:', err); showSync('error', '✗ บันทึก log ล้มเหลว'); }
}
