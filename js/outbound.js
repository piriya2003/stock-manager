// ══════════════════════════════════════════════════════════════
//  OUTBOUND
// ══════════════════════════════════════════════════════════════
async function doOutbound() {
  const dt   = document.getElementById('o-date').value || today();
  const typ  = document.getElementById('o-type').value;
  const custId = document.getElementById('o-cust').value;
  const custObj = customers.find(c => c.id === custId);
  const custName = custObj ? custObj.name : '—';
  const sn   = filterBarcode(document.getElementById('o-sn').value, 'o-msg');
  if (!sn) { document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus(); return; }

  const item = stock.find(i => String(i.sn) === sn && i.status === 'Available');
  if (!item) { inlineMsg('o-msg', `❌ SN: ${sn} ไม่มีหรือไม่พร้อมใช้งาน`, false); document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus(); return; }

  try {
    if (!outSession.length) sessionDispatchTime = nowISO();  // เริ่มชุดใหม่
    const dispatchedAt = sessionDispatchTime;
    const { error } = await supaClient.from('inventory').update({ status: 'Sold', dispatched_at: dispatchedAt }).eq('id', item.id);
    if (error) throw error;
    item.status = 'Sold'; item.dispatched_at = dispatchedAt; item.dispatched_to = custName;
    recordDispatchTo([item.id], custName);
    outSession.push(item); persistOutSession();
    await logTransaction(dt, typ, item.name, item.code, sn, getBalance(item.code), `→ ${custName}`);
    document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus();
    inlineMsg('o-msg', `✅ ตัด: ${sn} → ${custName} (คงเหลือ: ${getBalance(item.code)} ชิ้น)`, true);
    renderOutSession(); renderOutboundHistory(); checkAlerts();
  } catch (err) { inlineMsg('o-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

// ตัดสต็อกหลายรายการทีเดียว จากรายการ SN (ไม่ต้องสแกน)
async function doOutboundBulk() {
  const dt   = document.getElementById('o-date').value || today();
  const typ  = document.getElementById('o-type').value;
  const custId = document.getElementById('o-cust').value;
  const custObj = customers.find(c => c.id === custId);
  const custName = custObj ? custObj.name : '—';

  const raw = document.getElementById('o-bulk').value || '';
  const list = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean))];
  if (!list.length) return inlineMsg('o-bulk-msg', '❌ กรุณาวาง/พิมพ์รายการ SN ก่อน', false);

  const toSell = [], notFound = [], notAvail = [];
  list.forEach(sn => {
    const item = stock.find(i => String(i.sn) === sn && i.status === 'Available');
    if (item) toSell.push(item);
    else if (stock.find(i => String(i.sn) === sn)) notAvail.push(sn);
    else notFound.push(sn);
  });

  if (!toSell.length) return inlineMsg('o-bulk-msg', `❌ ไม่มี SN ที่ตัดได้ (ไม่พบ ${notFound.length}, ไม่พร้อม ${notAvail.length})`, false);

  try {
    if (!outSession.length) sessionDispatchTime = nowISO();  // เริ่มชุดใหม่
    const dispatchedAt = sessionDispatchTime;
    const { error } = await supaClient.from('inventory')
      .update({ status: 'Sold', dispatched_at: dispatchedAt })
      .in('id', toSell.map(i => i.id));
    if (error) throw error;

    for (const item of toSell) {
      item.status = 'Sold'; item.dispatched_at = dispatchedAt; item.dispatched_to = custName;
      outSession.push(item);
      await logTransaction(dt, typ, item.name, item.code, item.sn, getBalance(item.code), `→ ${custName}`);
    }
    recordDispatchTo(toSell.map(i => i.id), custName);
    persistOutSession();
    renderOutSession(); renderOutboundHistory(); checkAlerts();
    document.getElementById('o-bulk').value = '';

    let msg = `✅ ตัดสต็อก ${toSell.length} รายการ → ${custName}`;
    if (notFound.length || notAvail.length) msg += `  (ข้าม: ไม่พบ ${notFound.length}, ไม่พร้อม ${notAvail.length})`;
    inlineMsg('o-bulk-msg', msg, true);
    toast(`ตัดสต็อก ${toSell.length} รายการสำเร็จ`, 'success');
    if (notFound.length) console.warn('SN ไม่พบในระบบ:', notFound.join(', '));
    if (notAvail.length) console.warn('SN ไม่พร้อมตัด (ขาย/ซ่อม/เคลมไปแล้ว):', notAvail.join(', '));
  } catch (err) { inlineMsg('o-bulk-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

function renderOutSession() {
  document.getElementById('o-session-count').textContent = outSession.length;
  document.getElementById('o-session').innerHTML = outSession.slice().reverse().map(i =>
    `<div class="scan-result"><span class="sn">${i.sn}</span><span style="color:var(--t2);font-size:11px">${i.name}</span><span class="badge b-orange" style="font-size:9px">📤 OUT</span></div>`
  ).join('');
}

// ── จำเซสชั่นการสแกนลง localStorage (กันหายเมื่อรีเฟรช) ──
function persistOutSession() {
  try {
    const slim = outSession.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn), dispatched_at: i.dispatched_at, dispatched_to: i.dispatched_to }));
    localStorage.setItem('shq_out_session', JSON.stringify(slim));
  } catch (e) { /* localStorage เต็ม/ปิด — ข้ามได้ */ }
}
function restoreOutSession() {
  try {
    const raw = localStorage.getItem('shq_out_session');
    outSession = raw ? (JSON.parse(raw) || []) : [];
  } catch (e) { outSession = []; }
  sessionDispatchTime = outSession[0] ? outSession[0].dispatched_at : null;
}
function clearOutSession() {
  if (outSession.length && !confirm(`ล้างรายการในเซสชั่น (${outSession.length} ชิ้น)?\n(ไม่กระทบสต็อก — แค่ล้างรายการที่รอออก DO)`)) return;
  outSession = []; sessionDispatchTime = null; persistOutSession(); renderOutSession();
}

// เลขชุดจ่ายจากเวลา: HHMM DD MM YYYY เช่น 16:30 04/09/2026 → 163004092026
function genBatchNo(iso) {
  if (!iso) return '';
  const n = new Date(iso), p = x => String(x).padStart(2, '0');
  return p(n.getHours()) + p(n.getMinutes()) + p(n.getDate()) + p(n.getMonth() + 1) + n.getFullYear();
}

// ── รายการสินค้าที่ขายออกแล้ว ตามที่ค้นหาอยู่ (ใช้ร่วมกับปุ่มสร้าง DO ย้อนหลัง) ──
function getFilteredSoldItems() {
  const q = (document.getElementById('o-hist-q')?.value || '').toLowerCase();
  const d = document.getElementById('o-hist-date')?.value || '';
  const cust = document.getElementById('o-hist-cust')?.value || '';
  let soldItems = stock.filter(i => i.status === 'Sold');
  if (d) soldItems = soldItems.filter(i => i.dispatched_at && new Date(i.dispatched_at).toLocaleDateString('en-CA') === d);
  if (cust) soldItems = soldItems.filter(i => i.dispatched_to === cust);
  if (q) soldItems = soldItems.filter(i => i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  return soldItems;
}

// บันทึกลูกค้าปลายทางลงสินค้า — ไม่ทำให้การตัดสต็อกพังถ้าล้มเหลว แต่ต้อง "ส่งเสียง" ด้วย
// เดิมกลืน error ทิ้งเงียบๆ พอคอลัมน์ dispatched_to ไม่มีอยู่จริง ประวัติเลยไม่รู้ว่าจ่ายให้ใครมาตลอดโดยไม่มีใครรู้ตัว
async function recordDispatchTo(ids, custName) {
  if (!ids.length) return;
  try {
    const { data, error } = await supaClient.from('inventory')
      .update({ dispatched_to: custName }).in('id', ids).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีแถวถูกแก้');
  } catch (err) {
    console.warn('บันทึกลูกค้าปลายทางไม่สำเร็จ:', err.message);
    toast('⚠️ ตัดสต็อกแล้ว แต่บันทึกลูกค้าปลายทางไม่สำเร็จ — ประวัติจะไม่รู้ว่าจ่ายให้ใคร', 'warning');
  }
}

function renderOutboundHistory() {
  const soldItems = getFilteredSoldItems();
  document.getElementById('o-hist-total').textContent = soldItems.length;

  // จัดกลุ่มเป็น "ชุดการจ่าย" ตามเลขชุด (นาทีที่จ่าย) + ลูกค้า
  // ใช้ความละเอียดระดับนาทีให้ตรงกับเลขชุดที่แสดง — ของเก่าที่สแกนทีละชิ้น (วินาทีต่างกัน) จะได้รวมเป็นชุดเดียว
  const batches = {};
  soldItems.forEach(item => {
    const no  = item.dispatched_at ? genBatchNo(item.dispatched_at) : '';
    const key = no ? no + '|' + (item.dispatched_to || '') : 'no-batch';
    if (!batches[key]) batches[key] = { no, at: item.dispatched_at || '', cust: item.dispatched_to || '', items: [] };
    batches[key].items.push(item);
  });
  outboundBatches = Object.values(batches).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const batchList = outboundBatches;

  const tbody = document.getElementById('o-hist-tbody');
  if (!tbody) return;
  if (!batchList.length) { tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">ยังไม่มีรายการโอน/ขายออก</td></tr>'; return; }

  let html = '';
  batchList.forEach((b, bi) => {
    const time = b.at ? (fmtDate(b.at) + ' ' + new Date(b.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })) : '';
    const head = b.at
      ? `🧾 ชุด #${b.no} · ${time} · 👤 ${b.cust || '—'} · ${b.items.length} ชิ้น`
      : `🧾 ของเก่า (ไม่มีเลขชุด) · ${b.items.length} ชิ้น`;
    html += `<tr><td colspan="4" style="background:var(--s2);border-top:2px solid var(--b2);padding:8px 12px">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span style="font-size:12px;font-weight:700;color:var(--t1)">${head}</span>
        <button onclick="openDOFromBatch(${bi})" class="btn btn-primary btn-sm">📄 สร้าง DO ชุดนี้</button>
      </div></td></tr>`;

    const prod = {};
    b.items.forEach(item => {
      const k = item.name + '|' + item.code;
      if (!prod[k]) prod[k] = { name: item.name, code: item.code, category: item.category, sns: [], lots: new Set() };
      prod[k].sns.push(item.sn);
      if (item.lot_no) prod[k].lots.add(item.lot_no);
    });
    Object.values(prod).forEach(g => {
      html += `<tr>
        <td style="color:var(--t1);font-weight:500">${g.name}</td>
        <td><div class="code-cell">${g.code}</div><div style="font-size:10px;color:var(--t3);margin-top:2px">${g.category}${g.lots.size ? ' · ล็อต: ' + [...g.lots].join(', ') : ''}</div></td>
        <td style="text-align:center;font-family:var(--mono);color:var(--orange);font-weight:700;font-size:14px">${g.sns.length}</td>
        <td style="font-size:11px;color:var(--t2);font-family:var(--mono);max-width:300px;line-height:1.6;white-space:normal">
          ${g.sns.map(sn => `<span style="display:inline-block;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin:2px 2px;border:1px solid var(--b1)">${sn}</span>`).join('')}
        </td></tr>`;
    });
  });
  tbody.innerHTML = html;
}
