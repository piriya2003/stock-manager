// ══════════════════════════════════════════════════════════════
//  GRN — ใบรับเข้าสินค้า (Goods Receive Note) — CREATE / SAVE / PRINT
// ══════════════════════════════════════════════════════════════
// เลขที่ GRN นับใหม่ทุกวัน ตามวันที่รับของ (ใบย้อนหลังจึงได้เลขของวันที่รับจริง)
function genGRNNo(day = today()) {
  const [y, m, d] = day.split('-');
  return nextDocNo(`GRN-${y.slice(-2)}${m}${d}-`, grnHistory.map(g => g.grnNo));
}

// ใบที่กำลังจะออก: รายการสแกนรอบนี้ หรือของที่เลือกจากปุ่มออกใบย้อนหลัง
let grnDraft = null;     // { items, day, fromSession }
let grnAutoNo = null;    // เลขที่ระบบตั้งให้ — ถ้าช่องเลขที่ยังเป็นค่านี้ แปลว่าผู้ใช้ไม่ได้พิมพ์เลขเอง
async function refreshGRNNoFromDB() {
  const shown = grnAutoNo;
  try {
    const fresh = await nextDocNoFromDB('grn_headers', 'grn_no', docPrefix(shown), grnHistory.map(g => g.grnNo));
    const el = document.getElementById('grn-no');
    if (fresh !== shown && grnAutoNo === shown && grnModalMode === 'create' && el.value === shown) { el.value = fresh; grnAutoNo = fresh; }
  } catch (e) { /* ถามไม่ได้ก็ใช้เลขจากประวัติบนจอไปก่อน ตอนบันทึกยังกันชนอีกชั้น */ }
}

// ค่าที่ทุกชิ้นในใบใช้ตรงกัน ไม่งั้นเว้นว่าง
function commonValue(items, key) {
  const vals = [...new Set(items.map(i => i[key] || ''))];
  return vals.length === 1 ? vals[0] : '';
}

function openGRNModal(picked, day) {
  const fromSession = !picked;
  const list = fromSession ? inSession : picked;
  if (!list.length) return toast('ไม่มีรายการในเซสชั่นนี้ ให้สแกนรับเข้าก่อน', 'error');
  grnDraft = { items: list.slice(), day: day || today(), fromSession };
  grnModalMode = 'create';
  document.getElementById('grn-modal-badge').style.display = 'none';
  document.getElementById('grn-modal-hint').textContent = 'กรอกข้อมูลและกด "บันทึก GRN" เพื่อบันทึกประวัติ';
  document.getElementById('grn-save-btn').style.display = 'inline-flex';
  document.getElementById('grn-no').readOnly = false;
  document.getElementById('grn-supplier').readOnly = false;
  document.getElementById('grn-po').readOnly = false;
  document.getElementById('grn-lot').readOnly = false;
  grnAutoNo = genGRNNo(grnDraft.day);
  document.getElementById('grn-no').value = grnAutoNo;
  refreshGRNNoFromDB();
  document.getElementById('grn-date').textContent = fmtDate(grnDraft.day);
  const g = id => document.getElementById(id).value.trim();
  document.getElementById('grn-supplier').value = fromSession ? g('i-supplier') : commonValue(list, 'supplier');
  document.getElementById('grn-po').value = fromSession ? g('i-po') : commonValue(list, 'po_no');
  document.getElementById('grn-lot').value = fromSession ? g('i-lot') : commonValue(list, 'lot_no');

  const items = document.getElementById('grn-items');
  const grp = {};
  list.forEach(i => {
    if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
    grp[i.name].qty++; grp[i.name].sns.push(i.sn);
  });
  items.innerHTML = Object.entries(grp).map(([name, v], i) => `
    <tr>
      <td style="padding:6px 8px;white-space:nowrap">${i+1}. ${escapeHtml(name)}</td>
      <td style="text-align:center;padding:6px 8px;font-weight:700">${v.qty}</td>
      <td style="padding:6px 8px;font-size:10px;color:#555;font-family:monospace">${
        v.sns.slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
             .map(s => `<span class="grn-sn">${escapeHtml(s)}</span>`).join('')}</td>
    </tr>`).join('');
  document.getElementById('grn-modal').classList.add('open');
}

// ชิ้นที่มีใบ GRN อยู่แล้วในฐานข้อมูล — เช่นอีกคนเพิ่งออกใบย้อนหลังให้ของที่ค้างอยู่ในรายการสแกนของเรา
async function idsAlreadyOnGRN(ids) {
  const taken = new Set();
  for (let k = 0; k < ids.length; k += 150) {
    const { data, error } = await supaClient.from('inventory').select('id, grn_header_id').in('id', ids.slice(k, k + 150));
    if (error) throw error;
    (data || []).forEach(r => { if (r.grn_header_id) taken.add(r.id); });
  }
  return taken;
}

async function saveGRN() {
  let grnNo      = document.getElementById('grn-no').value.trim();
  const supplier = document.getElementById('grn-supplier').value.trim();
  const poNo     = document.getElementById('grn-po').value.trim();
  const lotNo    = document.getElementById('grn-lot').value.trim();

  if (!grnNo) return toast('กรุณาระบุเลขที่ GRN', 'error');
  if (!grnDraft || !grnDraft.items.length) return toast('ไม่มีรายการสินค้าในเซสชั่น', 'error');

  try {
    const taken = await idsAlreadyOnGRN(grnDraft.items.map(i => i.id));
    if (taken.size) {
      grnDraft.items = grnDraft.items.filter(i => !taken.has(i.id));
      if (grnDraft.fromSession) { inSession = inSession.filter(i => !taken.has(i.id)); persistInSession(); renderInSession(); }
      toast(`ข้าม ${taken.size} ชิ้นที่มีใบ GRN อยู่แล้ว`, 'warning');
      if (!grnDraft.items.length) return closeGRNModal();
    }
    const list = grnDraft.items;

    const insertHeader = no => supaClient.from('grn_headers').insert({
      grn_no: no, grn_date: grnDraft.day, supplier: supplier || null, po_no: poNo || null, lot_no: lotNo || null, created_by: currentUserId,
    }).select().single();
    let { data: header, error: hErr } = await insertHeader(grnNo);
    // เลขที่ระบบตั้งให้ถูกเครื่องอื่นใช้ไปก่อน — ขยับเป็นเลขถัดไปจากฐานข้อมูลเอง (เลขที่พิมพ์เองไม่ขยับ)
    for (let tries = 0; hErr?.code === '23505' && grnNo === grnAutoNo && tries < 3; tries++) {
      const next = await nextDocNoFromDB('grn_headers', 'grn_no', docPrefix(grnNo), grnHistory.map(g => g.grnNo)).catch(() => null);
      if (!next || next === grnNo) break;
      toast(`เลขที่ ${grnNo} มีเครื่องอื่นใช้ไปแล้ว — บันทึกเป็น ${next} แทน`, 'warning');
      grnNo = grnAutoNo = next;
      document.getElementById('grn-no').value = next;
      ({ data: header, error: hErr } = await insertHeader(grnNo));
    }
    if (hErr) {
      if (hErr.code === '23505') return toast(`เลขที่ GRN: ${grnNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }

    const itemRows = list.map(i => ({
      grn_header_id: header.id, item_name: i.name, item_code: i.code, item_category: i.category, sn: String(i.sn),
    }));
    const { error: iErr } = await supaClient.from('grn_items').insert(itemRows);
    if (iErr) throw iErr;

    // ช่องที่เว้นว่างไม่เขียนทับ — ใบย้อนหลังรวมของคนละล็อตได้ ล็อตเดิมของแต่ละชิ้นต้องไม่หาย
    const patch = { grn_header_id: header.id };
    if (supplier) patch.supplier = supplier;
    if (poNo) patch.po_no = poNo;
    if (lotNo) patch.lot_no = lotNo;
    const ids = list.map(i => i.id);
    const { error: uErr } = await supaClient.from('inventory').update(patch).in('id', ids);
    if (uErr) throw uErr;
    list.forEach(i => Object.assign(i, patch));

    grnHistory.unshift({
      id: header.id, grnNo, date: grnDraft.day, supplier, poNo, lotNo,
      items: list.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) })),
      createdAt: header.created_at, createdBy: currentUserId,
    });
    updateGRNBadge();

    const saveBtn = document.getElementById('grn-save-btn');
    saveBtn.textContent = '✅ บันทึกแล้ว';
    saveBtn.style.background = '#2dd4a0';
    toast(`บันทึกใบ GRN: ${grnNo} สำเร็จ`, 'success');
    setTimeout(() => { saveBtn.textContent = '💾 บันทึก GRN'; saveBtn.style.background = '#22d3ee'; }, 3000);
    const saved = new Set(ids);
    inSession = inSession.filter(i => !saved.has(i.id)); persistInSession(); renderInSession();
    grnDraft = null;
    filterStock(); renderGRNHistory();
  } catch (err) { toast('บันทึก GRN ล้มเหลว: ' + err.message, 'error'); }
}

function closeGRNModal() { document.getElementById('grn-modal').classList.remove('open'); }
function printGRN() { window.print(); }

function renderGRNHistory() {
  const q = (document.getElementById('grnh-q')?.value || '').trim().toLowerCase();
  let data = [...grnHistory];
  if (q) data = data.filter(d =>
    d.grnNo.toLowerCase().includes(q) ||
    (d.supplier||'').toLowerCase().includes(q) ||
    (d.lotNo||'').toLowerCase().includes(q) ||
    (d.items||[]).some(i => i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q))
  );

  const totalItems = grnHistory.reduce((s, d) => s + (d.items||[]).length, 0);
  const uniqueSuppliers = new Set(grnHistory.map(d => d.supplier).filter(Boolean)).size;
  document.getElementById('grnh-total').textContent = grnHistory.length;
  document.getElementById('grnh-items').textContent = totalItems;
  document.getElementById('grnh-suppliers').textContent = uniqueSuppliers;
  document.getElementById('grnh-count').textContent = data.length;
  const pending = grnlessItems().length;
  const pendEl = document.getElementById('grn-backfill-count');
  if (pendEl) pendEl.textContent = pending ? `(${pending})` : '';

  const tbody = document.getElementById('grn-history-tbody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="7" class="tbl-empty">${t('ยังไม่มีประวัติใบรับเข้า')}</td></tr>`; return; }
  tbody.innerHTML = data.map(d => `
    <tr class="do-row" onclick="openGRNView('${d.id}')">
      <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--cyan)">${escapeHtml(d.grnNo)}</span></td>
      <td class="mono" style="font-size:11px">${fmtDate(d.date || d.createdAt)}</td>
      <td style="color:var(--t1);font-weight:500">${escapeHtml(d.supplier) || '—'}</td>
      <td class="mono" style="font-size:11px">${escapeHtml(d.lotNo) || '—'}</td>
      <td style="text-align:center"><span class="do-summary-chip">${(d.items||[]).length} ชิ้น</span></td>
      <td style="font-size:11px;color:var(--t3)">${escapeHtml(userName(d.createdBy))}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="event.stopPropagation();openGRNView('${d.id}')" class="btn btn-ghost btn-icon btn-sm">${icon('eye')}</button>
          <button onclick="event.stopPropagation();reopenGRNForPrint('${d.id}')" class="btn btn-primary btn-icon btn-sm">${icon('print')}</button>
          ${currentRole === 'admin' ? `<button onclick="event.stopPropagation();deleteGRN('${d.id}')" class="btn btn-red btn-icon btn-sm">${icon('trash')}</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function openGRNView(id) {
  const d = grnHistory.find(x => x.id === id); if (!d) return;
  currentViewGRNId = id;
  document.getElementById('grnv-no').textContent = 'เลขที่: ' + d.grnNo;
  document.getElementById('grnv-no2').textContent = d.grnNo;
  // ใบย้อนหลัง: วันที่รับของกับวันที่กดออกใบคนละวัน — บอกทั้งสองอย่าง
  const backdated = d.date && d.date !== new Date(d.createdAt).toLocaleDateString('en-CA');
  document.getElementById('grnv-date').textContent = backdated
    ? `${fmtDate(d.date)} (ออกใบย้อนหลังเมื่อ ${fmtISO(d.createdAt)})`
    : fmtDate(d.createdAt) + ' ' + new Date(d.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('grnv-supplier').textContent = d.supplier || '—';
  document.getElementById('grnv-po').textContent = d.poNo || '—';
  document.getElementById('grnv-lot').textContent = d.lotNo || '—';
  document.getElementById('grnv-user').textContent = userName(d.createdBy);

  const grp = {};
  (d.items||[]).forEach(i => { grp[i.name] = (grp[i.name] || 0) + 1; });
  document.getElementById('grnv-summary').innerHTML = Object.entries(grp).map(([name, qty]) => `
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:var(--t2)">${escapeHtml(name)}</span>
      <span style="font-family:var(--mono);font-weight:700;color:var(--cyan)">${qty} ชิ้น</span>
    </div>`).join('');

  document.getElementById('grnv-item-count').textContent = (d.items||[]).length;
  document.getElementById('grnv-items-tbody').innerHTML = (d.items||[]).map((item, i) => `
    <tr>
      <td style="text-align:center;font-size:11px;color:var(--t3)">${i+1}</td>
      <td style="color:var(--t1)">${escapeHtml(item.name)}</td>
      <td style="color:var(--blue)">${escapeHtml(item.category)||'—'}</td>
      <td class="code-cell">${escapeHtml(item.code)}</td>
      <td class="sn-cell">${escapeHtml(item.sn)}</td>
    </tr>`).join('');
  document.getElementById('grn-view-modal').classList.add('open');
}

function reopenGRNForPrint(id) {
  const d = grnHistory.find(x => x.id === id); if (!d) return;
  closeModal('grn-view-modal'); grnModalMode = 'view';
  document.getElementById('grn-modal-badge').style.display = 'inline';
  document.getElementById('grn-modal-hint').textContent = '';
  document.getElementById('grn-save-btn').style.display = 'none';
  ['grn-no','grn-supplier','grn-po','grn-lot'].forEach(id => { document.getElementById(id).readOnly = true; });
  document.getElementById('grn-no').value = d.grnNo;
  document.getElementById('grn-supplier').value = d.supplier || '';
  document.getElementById('grn-po').value = d.poNo || '';
  document.getElementById('grn-lot').value = d.lotNo || '';
  document.getElementById('grn-date').textContent = fmtDate(d.date || d.createdAt);

  const grp = {};
  (d.items||[]).forEach(i => {
    if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
    grp[i.name].qty++; grp[i.name].sns.push(i.sn);
  });
  document.getElementById('grn-items').innerHTML = Object.entries(grp).map(([name, v], i) => `
    <tr>
      <td style="padding:6px 8px;white-space:nowrap">${i+1}. ${escapeHtml(name)}</td>
      <td style="text-align:center;padding:6px 8px;font-weight:700">${v.qty}</td>
      <td style="padding:6px 8px;font-size:10px;color:#555;font-family:monospace">${
        v.sns.slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
             .map(s => `<span class="grn-sn">${escapeHtml(s)}</span>`).join('')}</td>
    </tr>`).join('');
  document.getElementById('grn-modal').classList.add('open');
}

async function deleteGRN(id) {
  const d = grnHistory.find(x => x.id === id); if (!d) return;
  if (!confirm(`ลบใบ GRN เลขที่: ${d.grnNo}?\n(สินค้าที่รับเข้าจะยังอยู่ในระบบ แค่ตัดการเชื่อมโยงเอกสาร)`)) return;
  try {
    // ต้องตัดการเชื่อมโยงที่ตัวสินค้าก่อน ไม่งั้น foreign key จะกันไม่ให้ลบหัวใบเลย
    // (สินค้ายังอยู่ครบตามที่บอกในข้อความยืนยัน — แค่ไม่ผูกกับใบนี้แล้ว)
    const { error: unlinkErr } = await supaClient.from('inventory').update({ grn_header_id: null }).eq('grn_header_id', id);
    if (unlinkErr) throw unlinkErr;
    stock.forEach(i => { if (i.grn_header_id === id) i.grn_header_id = null; });

    const { error } = await supaClient.from('grn_headers').delete().eq('id', id); // grn_items ลบตามด้วย cascade
    if (error) throw error;
    grnHistory = grnHistory.filter(x => x.id !== id);
    renderGRNHistory(); updateGRNBadge();
    toast('ลบใบ GRN สำเร็จ (สินค้ายังอยู่ในคลังครบ)', 'info');
  } catch (err) {
    if (err.code === '23503') toast('ลบใบ GRN ไม่ได้ — ยังมีข้อมูลอื่นอ้างถึงใบนี้อยู่', 'error');
    else toast('ลบล้มเหลว: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  ออกใบ GRN ย้อนหลัง — ของที่รับเข้าแล้วแต่ไม่มีใบ (ลืมกดบันทึก GRN, นำเข้าจาก Excel, ลบใบไปแล้ว)
//  เลือกทีละวันที่รับ ใบหนึ่งจึงมีวันที่รับวันเดียว และได้เลข GRN ของวันนั้น
// ══════════════════════════════════════════════════════════════
// ของในรายการสแกนของเราเองไม่นับ — รอออกใบจากหน้ารับเข้าตามปกติ
function grnlessItems() {
  const mine = new Set(inSession.map(i => i.id));
  return stock.filter(i => !i.grn_header_id && !mine.has(i.id));
}
function receivedDay(i) { return new Date(i.received_at || i.created_at || Date.now()).toLocaleDateString('en-CA'); }

let gbfGroups = [];
function openGRNBackfill() {
  const items = grnlessItems();
  if (!items.length) return toast('ของทุกชิ้นมีใบ GRN แล้ว', 'info');
  const perDay = {};
  items.forEach(i => { const d = receivedDay(i); perDay[d] = (perDay[d] || 0) + 1; });
  const sel = document.getElementById('gbf-day');
  sel.innerHTML = Object.keys(perDay).sort().reverse()
    .map(d => `<option value="${d}">${fmtDate(d)} — ${perDay[d]} ${t('ชิ้น')}</option>`).join('');
  renderGRNBackfill();
  document.getElementById('grn-backfill-modal').classList.add('open');
}

function renderGRNBackfill() {
  const day = document.getElementById('gbf-day').value;
  const byKey = {};
  grnlessItems().filter(i => receivedDay(i) === day).forEach(i => {
    const k = [i.name, i.lot_no || '', i.supplier || ''].join('|');
    (byKey[k] ||= { name: i.name, lot: i.lot_no || '', supplier: i.supplier || '', items: [] }).items.push(i);
  });
  gbfGroups = Object.values(byKey).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  document.getElementById('gbf-list').innerHTML = gbfGroups.map((g, gi) => {
    const sns = g.items.map(i => String(i.sn)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const extra = [g.lot ? `${t('ล็อต')} ${escapeHtml(g.lot)}` : '', g.supplier ? escapeHtml(g.supplier) : ''].filter(Boolean).join(' · ');
    return `<label class="gbf-row">
      <input type="checkbox" data-gi="${gi}" checked onchange="updateGRNBackfillCount()">
      <span style="min-width:0;flex:1">
        <b style="color:var(--t1)">${escapeHtml(g.name)}</b>
        <span class="mono" style="color:var(--blue);font-weight:700;margin-left:6px">${g.items.length} ${t('ชิ้น')}</span>
        ${extra ? `<div style="font-size:11px;color:var(--t3)">${extra}</div>` : ''}
        <div class="mono" style="font-size:11px;color:var(--t2);overflow-wrap:anywhere">${sns.slice(0, 12).map(escapeHtml).join(', ')}${sns.length > 12 ? ` … +${sns.length - 12}` : ''}</div>
      </span>
    </label>`;
  }).join('');
  updateGRNBackfillCount();
}

function pickedBackfillItems() {
  return [...document.querySelectorAll('#gbf-list input[data-gi]:checked')].flatMap(el => gbfGroups[+el.dataset.gi].items);
}
function updateGRNBackfillCount() {
  const n = pickedBackfillItems().length;
  const btn = document.getElementById('gbf-go');
  btn.disabled = !n;
  btn.textContent = `${t('ออกใบ GRN')} (${n} ${t('ชิ้น')})`;
}

function confirmGRNBackfill() {
  const items = pickedBackfillItems();
  if (!items.length) return;
  const day = document.getElementById('gbf-day').value;
  closeModal('grn-backfill-modal');
  openGRNModal(items, day);
}
