// ══════════════════════════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════════════════════════
// ตัวคั่นค่าใน dropdown หมวดหมู่: "POS" = ทั้งหมวด, "POS⟩สลิม" = เจาะหมวดย่อย
const CAT_SEP = '⟩';

// ของที่รับเข้าตั้งแต่มีช่องหมวดหมู่ย่อย จะเก็บค่าไว้ที่ตัวสินค้าเอง
// ส่วนของเก่าที่รับเข้ามาก่อนหน้านั้นยังไม่มี ต้องโยงกลับไปดูที่ "ต้นแบบสินค้า" ด้วยชื่อ (หรือรหัส)
// ทำเป็น Map ครั้งเดียวแล้วใช้ซ้ำ ไม่ไล่หาทีละชิ้น
function subcatMap() {
  const m = new Map();
  masterProds.forEach(p => {
    if (!p.subcategory) return;
    m.set('n:' + p.name, p.subcategory);
    if (p.code && p.code !== '-') m.set('c:' + p.code, p.subcategory);
  });
  return m;
}
function subcatOf(item, m) {
  return item.subcategory || m.get('n:' + item.name) || (item.code ? m.get('c:' + item.code) : '') || '';
}

function populateCatFilter() {
  const menu = document.getElementById('s-cat-menu'); if (!menu) return;
  const cur = document.getElementById('s-cat').value;   // สลับแท็บไปมาแล้วตัวกรองเดิมต้องไม่หลุด
  const m = subcatMap();

  // หมวดหลัก → หมวดย่อยที่ "มีของอยู่จริงในคลัง" เท่านั้น (เลือกแล้วต้องไม่เจอตารางว่าง)
  const tree = new Map();
  stock.forEach(i => {
    if (!tree.has(i.category)) tree.set(i.category, new Set());
    const sub = subcatOf(i, m);
    if (sub) tree.get(i.category).add(sub);
  });

  const row = (val, label, cls = '') =>
    `<div class="cat-dd-item${cls}${cur === val ? ' active' : ''}" onclick="event.stopPropagation();pickCat(${jsArg(val)})">${escapeHtml(label)}</div>`;

  let html = row('', t('— ทุกหมวดหมู่ —'));
  [...tree.keys()].sort((a, b) => a.localeCompare(b, 'th')).forEach(cat => {
    const subs = [...tree.get(cat)].sort((a, b) => a.localeCompare(b, 'th'));
    if (!subs.length) { html += row(cat, cat); return; }
    // มีหมวดย่อย → กดที่ชื่อ = ทั้งหมวด, ชี้/กดลูกศร = บานเมนูย่อยออกทางขวา
    html += `<div class="cat-dd-item${cur === cat ? ' active' : ''}" onclick="event.stopPropagation();pickCat(${jsArg(cat)})">
        <span>${escapeHtml(cat)}</span>
        <span class="cat-dd-arrow" onclick="event.stopPropagation();this.parentNode.classList.toggle('show-sub')">›</span>
        <div class="cat-dd-sub">
          ${row(cat, cat + ' — ทั้งหมด', ' all')}
          ${subs.map(s => row(cat + CAT_SEP + s, s)).join('')}
        </div>
      </div>`;
  });
  menu.innerHTML = html;
  updateCatLabel();
}

function updateCatLabel() {
  const el = document.getElementById('s-cat-label'); if (!el) return;
  const v = document.getElementById('s-cat').value;
  const [c, s] = v.includes(CAT_SEP) ? v.split(CAT_SEP) : [v, ''];
  el.textContent = !c ? t('— ทุกหมวดหมู่ —') : (s ? `${c} → ${s}` : c);
}

function toggleCatMenu(e) {
  e.stopPropagation();
  const dd = document.getElementById('s-cat-dd');
  const willOpen = !dd.classList.contains('open');
  closeCatMenu();
  if (willOpen) dd.classList.add('open');
}

function closeCatMenu() {
  const dd = document.getElementById('s-cat-dd'); if (!dd) return;
  dd.classList.remove('open');
  dd.querySelectorAll('.show-sub').forEach(el => el.classList.remove('show-sub'));
}
document.addEventListener('click', closeCatMenu);   // คลิกที่อื่นแล้วเมนูปิดเอง

function pickCat(v) {
  document.getElementById('s-cat').value = v;
  closeCatMenu();
  populateCatFilter();   // อัปเดตแถบไฮไลต์ + ป้ายบนปุ่ม
  filterStock();
}

function sortStock(col) {
  if (stockSortCol === col) { stockSortDir = stockSortDir === 'asc' ? 'desc' : 'asc'; }
  else { stockSortCol = col; stockSortDir = 'asc'; }
  ['cat', 'name', 'sn', 'status'].forEach(c => {
    const th = document.getElementById('th-' + c);
    if (th) th.classList.remove('asc', 'desc');
  });
  const colMap = { category: 'cat', name: 'name', sn: 'sn', status: 'status' };
  const thEl = document.getElementById('th-' + colMap[col]);
  if (thEl) thEl.classList.add(stockSortDir);
  filterStock();
}

function snCellHTML(item) {
  const timeSub = `<div style="font-size:9px;color:var(--t3);margin-top:2px;font-family:var(--mono)">📥 ${fmtISO(item.received_at)}${item.dispatched_at ? ' · 📤 ' + fmtISO(item.dispatched_at) : ''}</div>`;
  if (item.prev_sn && item.prev_sn !== item.sn) {
    return `<td class="sn-cell"><div class="sn-arrow-wrap"><span class="sn-old">${escapeHtml(item.prev_sn)}</span><span class="sn-arrow">↓ สลับ SN</span><span class="sn-new">${escapeHtml(item.sn)} <span class="sn-swap-badge">เคลม</span></span></div>${timeSub}</td>`;
  }
  return `<td class="sn-cell">${escapeHtml(item.sn)}${timeSub}</td>`;
}

// คืนรายการสินค้าที่ผ่านการกรอง + เรียงลำดับตามที่เลือกบนหน้าจอ (ใช้ร่วมกับ export)
function getFilteredStock() {
  const q   = (document.getElementById('s-q').value || '').trim().toLowerCase();
  const st = document.getElementById('s-status').value;
  const catVal = document.getElementById('s-cat').value;
  const [cat, subCat] = catVal.includes(CAT_SEP) ? catVal.split(CAT_SEP) : [catVal, ''];
  const sm = subcatMap();
  let data = stock.filter(i =>
    (!st || i.status === st) &&
    (!cat || i.category === cat) &&
    (!subCat || subcatOf(i, sm) === subCat) &&
    (!q || i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q) || (i.prev_sn && String(i.prev_sn).toLowerCase().includes(q)) || i.category.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.lot_no && i.lot_no.toLowerCase().includes(q)) || (i.supplier && i.supplier.toLowerCase().includes(q)) || (i.dispatched_to && i.dispatched_to.toLowerCase().includes(q)) || subcatOf(i, sm).toLowerCase().includes(q))
  );
  data.sort((a, b) => {
    let va = String(a[stockSortCol] || '').toLowerCase();
    let vb = String(b[stockSortCol] || '').toLowerCase();
    if (stockSortCol === 'sn') {
      const numA = va.replace(/\D/g, ''), numB = vb.replace(/\D/g, '');
      if (numA && numB) { const diff = Number(numA) - Number(numB); if (diff !== 0) return stockSortDir === 'asc' ? diff : -diff; }
    }
    return stockSortDir === 'asc' ? va.localeCompare(vb, 'th') : vb.localeCompare(va, 'th');
  });
  return data;
}

function filterStock() {
  const data = getFilteredStock();
  const sm = subcatMap();
  const tbody = document.getElementById('stock-tbody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">${t('ไม่พบสินค้า')}</td></tr>`; document.getElementById('rec-count').textContent = 0; return; }
  tbody.innerHTML = data.map((item, idx) => `<tr>
      <td style="text-align:center;color:var(--t3);font-family:var(--mono);font-size:11px">${idx + 1}</td>
      <td style="color:var(--blue);font-weight:500">${escapeHtml(item.category)}${subcatOf(item, sm) ? `<div style="font-size:10px;color:var(--purple);margin-top:2px">→ ${escapeHtml(subcatOf(item, sm))}</div>` : ''}</td>
      <td style="color:var(--t1)">${escapeHtml(item.name)}</td>
      <td class="code-cell">${escapeHtml(item.code)}</td>
      <td class="mono" style="font-size:11px;color:var(--t2)">${escapeHtml(item.lot_no) || '—'}</td>
      ${snCellHTML(item)}
      <td>${statusBadge(item.status)}${item.dispatched_to ? `<div style="font-size:10px;color:var(--t3);margin-top:3px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.dispatched_to)}">👤 ${escapeHtml(item.dispatched_to)}</div>` : ''}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:5px;justify-content:center">
          ${item.status === 'Sold' ? `<button onclick="returnToStock('${item.id}')" class="btn btn-ghost btn-icon btn-sm" title="คืนเป็นพร้อมใช้">${icon('undo')}</button>` : ''}
          ${item.status === 'Repair' ? `<button onclick="openRepairDetailBySN(${jsArg(item.sn)})" class="btn btn-orange btn-icon btn-sm" title="ดูรายการซ่อม">${icon('wrench')}</button>` : ''}
          <button onclick="openEdit('${item.id}')" class="btn btn-ghost btn-icon btn-sm" title="แก้ไข">${icon('edit')}</button>
          ${currentRole === 'admin' ? `<button onclick="delItem('${item.id}')" class="btn btn-red btn-icon btn-sm" title="ลบ">${icon('trash')}</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
  document.getElementById('rec-count').textContent = data.length;
}

async function returnToStock(id) {
  const item = stock.find(i => i.id === id); if (!item) return;
  const old = item.status;
  try {
    // ของกลับเข้าคลังแล้ว ต้องล้างปลายทางด้วย ไม่งั้นในตารางจะยังขึ้นชื่อลูกค้าทั้งที่ของอยู่กับเรา
    const back = { status: 'Available', dispatched_at: null, dispatched_to: null };
    const { error } = await supaClient.from('inventory').update(back).eq('id', id);
    if (error) throw error;
    Object.assign(item, back);
    await logTransaction(today(), '♻️ คืนสต็อก', item.name, item.code, item.sn, getBalance(item.code), `คืนจากสถานะ: ${old}`);
    filterStock(); checkAlerts();
    toast(`คืนสต็อก SN: ${item.sn} สำเร็จ`, 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

function openEdit(id) {
  const i = stock.find(x => x.id === id); if (!i) return;
  document.getElementById('edit-idx').value = id;
  document.getElementById('edit-cat').value = i.category;
  document.getElementById('edit-name').value = i.name;
  document.getElementById('edit-code').value = i.code;
  document.getElementById('edit-sn').value = i.sn;
  document.getElementById('edit-lot').value = i.lot_no || '';
  document.getElementById('edit-status').value = i.status;
  document.getElementById('edit-cust').value = i.dispatched_to || '';
  // ตัวเลือกลูกค้าสร้างด้วย DOM ไม่ใช่ innerHTML — ชื่อลูกค้ามี & " ' ปนได้
  const dl = document.getElementById('customer-dl');
  dl.innerHTML = '';
  customers.forEach(c => { const o = document.createElement('option'); o.value = c.name; dl.appendChild(o); });
  onEditStatusChange();
  document.getElementById('edit-modal').classList.add('open');
}

// ช่องลูกค้าปลายทางมีความหมายเฉพาะของที่จ่ายออกไปแล้ว — สถานะอื่นซ่อนไว้ไม่ให้กรอกมั่ว
function onEditStatusChange() {
  const isSold = document.getElementById('edit-status').value === 'Sold';
  document.getElementById('edit-cust-row').style.display = isSold ? 'block' : 'none';
}

async function saveEdit() {
  const id = document.getElementById('edit-idx').value;
  const item = stock.find(x => x.id === id); if (!item) return;
  const oldSN = item.sn;
  const newSN = document.getElementById('edit-sn').value.trim();
  const newStatus = document.getElementById('edit-status').value;
  const oldCust = item.dispatched_to || '';
  const payload = {
    category: document.getElementById('edit-cat').value,
    name: document.getElementById('edit-name').value,
    code: document.getElementById('edit-code').value,
    sn: newSN,
    lot_no: document.getElementById('edit-lot').value.trim() || null,
    status: newStatus,
  };
  if (newSN !== oldSN) payload.prev_sn = oldSN;

  if (newStatus === 'Sold') {
    payload.dispatched_to = document.getElementById('edit-cust').value.trim() || null;
    // ของที่เพิ่งถูกตั้งเป็นจ่ายออกจากหน้านี้ยังไม่มีเวลาจ่าย ถ้าไม่ใส่จะไม่โผล่ในตัวกรองวันไหนเลย
    if (!item.dispatched_at) payload.dispatched_at = nowISO();
  } else {
    // เลิกเป็นของที่จ่ายออกแล้ว ต้องล้างปลายทางทิ้งเหมือนตอนกดคืนสต็อก ไม่งั้นตารางยังขึ้นชื่อลูกค้าค้าง
    payload.dispatched_to = null;
    payload.dispatched_at = null;
  }
  const newCust = payload.dispatched_to || '';

  try {
    // เช็คว่าแก้โดนจริง — RLS ที่ไม่มี update policy จะคืน 200 พร้อม 0 แถว ไม่ใช่ error
    const { data, error } = await supaClient.from('inventory').update(payload).eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีสิทธิ์แก้ไขรายการนี้');
    Object.assign(item, payload);
    if (newSN !== oldSN) {
      await logTransaction(today(), '✏️ เปลี่ยน SN', item.name, item.code, newSN, getBalance(item.code), `เปลี่ยน SN: ${oldSN} → ${newSN}`);
    }
    if (newCust !== oldCust) {
      await logTransaction(today(), '✏️ แก้ลูกค้าปลายทาง', item.name, item.code, item.sn, getBalance(item.code),
                           `${oldCust || '(ไม่ระบุ)'} → ${newCust || '(ไม่ระบุ)'}`);
    }
    closeModal('edit-modal');
    filterStock(); refreshCustomerSelects(); renderOutboundHistory(); checkAlerts();
    toast('แก้ไขสำเร็จ', 'success');
  } catch (err) {
    if (err.code === '23505') toast('SN นี้มีอยู่ในระบบแล้ว (ซ้ำ)', 'error');
    else toast('บันทึกล้มเหลว: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  เปลี่ยนชื่อสินค้าทีเดียวทั้งคลัง (ไม่ต้องไล่แก้ทีละ SN)
// ══════════════════════════════════════════════════════════════
function openBulkRename() {
  const sel = document.getElementById('rn-old');
  const counts = new Map();
  stock.forEach(i => counts.set(i.name, (counts.get(i.name) || 0) + 1));
  if (!counts.size) return toast('ยังไม่มีสินค้าในคลัง', 'error');
  // สร้าง option ด้วย DOM ไม่ใช่ innerHTML — ชื่อสินค้ามี & : / " ปนอยู่บ่อย
  sel.innerHTML = '';
  [...counts.keys()].sort((a, b) => a.localeCompare(b, 'th')).forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = `${n}  (${counts.get(n)} ชิ้น)`;
    sel.appendChild(o);
  });
  // ถ้าหน้าคลังกรองไว้จนเหลือชื่อเดียว ถือว่านั่นคือชื่อที่ตั้งใจจะแก้
  const shown = [...new Set(getFilteredStock().map(i => i.name))];
  if (shown.length === 1) sel.value = shown[0];
  document.getElementById('rn-new').value = '';
  previewBulkRename();
  document.getElementById('rename-modal').classList.add('open');
}

function previewBulkRename() {
  const oldName = document.getElementById('rn-old').value;
  const newName = document.getElementById('rn-new').value.trim();
  const n = stock.filter(i => i.name === oldName).length;
  const box = document.getElementById('rn-preview');
  const btn = document.getElementById('rn-apply');
  box.innerHTML = '';
  const ready = newName && newName !== oldName;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '' : '.5';
  if (!ready) {
    box.textContent = newName ? 'ชื่อใหม่ซ้ำกับชื่อเดิม' : `เลือกชื่อเดิมแล้วพิมพ์ชื่อใหม่ — ชื่อนี้มีอยู่ ${n} รายการ`;
    return;
  }
  const head = document.createElement('div');
  head.innerHTML = `จะเปลี่ยนทั้งหมด <b style="color:var(--blue)">${n}</b> รายการ`;
  const from = document.createElement('div'); from.style.cssText = 'color:var(--t3);text-decoration:line-through'; from.textContent = oldName;
  const to   = document.createElement('div'); to.style.cssText   = 'color:var(--green);font-weight:600'; to.textContent = '↓ ' + newName;
  box.append(head, from, to);
}

async function applyBulkRename() {
  const oldName = document.getElementById('rn-old').value;
  const newName = document.getElementById('rn-new').value.trim();
  if (!newName) return toast('กรุณาใส่ชื่อใหม่', 'error');
  if (newName === oldName) return toast('ชื่อใหม่ซ้ำกับชื่อเดิม', 'error');
  const targets = stock.filter(i => i.name === oldName);
  if (!targets.length) return toast('ไม่พบสินค้าชื่อนี้ในคลัง', 'error');
  if (!confirm(`เปลี่ยนชื่อสินค้า ${targets.length} รายการ\n\n${oldName}\n↓\n${newName}\n\nยืนยันหรือไม่?`)) return;

  const btn = document.getElementById('rn-apply');
  btn.disabled = true;
  showSync('syncing', 'กำลังเปลี่ยนชื่อสินค้า...');
  try {
    const { error } = await supaClient.from('inventory').update({ name: newName }).eq('name', oldName);
    if (error) throw error;
    targets.forEach(i => { i.name = newName; });
    await renameMasterProduct(oldName, newName);
    await logTransaction(today(), '🏷️ เปลี่ยนชื่อสินค้า', newName, targets[0].code, `${targets.length} รายการ`,
                         getBalance(targets[0].code), `เปลี่ยนชื่อ: ${oldName} → ${newName}`);
    closeModal('rename-modal');
    populateCatFilter(); filterStock(); updateDataLists(); renderMasterProducts();
    showSync('success', '✓ เปลี่ยนชื่อสำเร็จ');
    toast(`เปลี่ยนชื่อ ${targets.length} รายการเป็น "${newName}" สำเร็จ`, 'success');
  } catch (err) {
    showSync('error', '✗ เปลี่ยนชื่อล้มเหลว');
    toast('เปลี่ยนชื่อล้มเหลว: ' + err.message, 'error');
  } finally { btn.disabled = false; }
}

// ต้นแบบสินค้าไม่มีสิทธิ์ UPDATE บน Supabase (มีแค่ insert/delete) — เลยใช้ลบตัวเก่าแล้วเพิ่มตัวใหม่แทน
async function renameMasterProduct(oldName, newName) {
  const olds = masterProds.filter(p => p.name === oldName);
  if (!olds.length) return;
  const ids = olds.map(p => p.id);
  const { error: dErr } = await supaClient.from('master_products').delete().in('id', ids);
  if (dErr) throw dErr;
  masterProds = masterProds.filter(p => !ids.includes(p.id));
  if (masterProds.some(p => p.name === newName)) return;   // มีต้นแบบชื่อใหม่อยู่แล้ว ไม่ต้องเพิ่มซ้ำ
  const { data, error } = await supaClient.from('master_products')
    .insert({ category: olds[0].category || 'ไม่ระบุ', name: newName, code: olds[0].code }).select().single();
  if (error) throw error;
  masterProds.push(data);
}

async function delItem(id) {
  const item = stock.find(x => x.id === id); if (!item) return;
  // งานซ่อมผูกกับตัวสินค้าด้วย foreign key — บอกไปเลยว่าติดอะไร ดีกว่าปล่อยให้เด้ง error ดิบของฐานข้อมูล
  const jobs = repairJobs.filter(j => String(j.sn) === String(item.sn)).length;
  if (jobs) return toast(`ลบ SN: ${item.sn} ไม่ได้ — ยังมีประวัติงานซ่อม/เคลม ${jobs} รายการอ้างถึงอยู่`, 'error');
  if (!confirm(`ลบสินค้า SN: ${item.sn}?\n(ไม่สามารถกู้คืนได้)`)) return;
  try {
    const { error } = await supaClient.from('inventory').delete().eq('id', id);
    if (error) throw error;
    stock = stock.filter(x => x.id !== id);
    filterStock(); checkAlerts();
    toast(`ลบ SN: ${item.sn} สำเร็จ`, 'success');
  } catch (err) {
    if (err.code === '23503') toast(`ลบ SN: ${item.sn} ไม่ได้ — ยังมีประวัติงานซ่อม/เคลมอ้างถึงอยู่`, 'error');
    else toast('ลบล้มเหลว: ' + err.message, 'error');
  }
}
