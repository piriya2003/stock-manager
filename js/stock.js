// ══════════════════════════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════════════════════════
function populateCatFilter() {
  const sel = document.getElementById('s-cat');
  const cats = [...new Set(stock.map(i => i.category))].sort();
  sel.innerHTML = '<option value="">— ทุกหมวดหมู่ —</option>' + cats.map(c => `<option>${c}</option>`).join('');
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
    return `<td class="sn-cell"><div class="sn-arrow-wrap"><span class="sn-old">${item.prev_sn}</span><span class="sn-arrow">↓ สลับ SN</span><span class="sn-new">${item.sn} <span class="sn-swap-badge">เคลม</span></span></div>${timeSub}</td>`;
  }
  return `<td class="sn-cell">${item.sn}${timeSub}</td>`;
}

// คืนรายการสินค้าที่ผ่านการกรอง + เรียงลำดับตามที่เลือกบนหน้าจอ (ใช้ร่วมกับ export)
function getFilteredStock() {
  const q   = (document.getElementById('s-q').value || '').toLowerCase();
  const st = document.getElementById('s-status').value;
  const cat = document.getElementById('s-cat').value;
  let data = stock.filter(i =>
    (!st || i.status === st) &&
    (!cat || i.category === cat) &&
    (!q || i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q) || (i.prev_sn && String(i.prev_sn).toLowerCase().includes(q)) || i.category.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.lot_no && i.lot_no.toLowerCase().includes(q)) || (i.supplier && i.supplier.toLowerCase().includes(q)) || (i.dispatched_to && i.dispatched_to.toLowerCase().includes(q)))
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
  const tbody = document.getElementById('stock-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="tbl-empty">ไม่พบสินค้า</td></tr>'; document.getElementById('rec-count').textContent = 0; return; }
  tbody.innerHTML = data.map((item, idx) => `<tr>
      <td style="text-align:center;color:var(--t3);font-family:var(--mono);font-size:11px">${idx + 1}</td>
      <td style="color:var(--blue);font-weight:500">${item.category}</td>
      <td style="color:var(--t1)">${item.name}</td>
      <td class="code-cell">${item.code}</td>
      <td class="mono" style="font-size:11px;color:var(--t2)">${item.lot_no || '—'}</td>
      ${snCellHTML(item)}
      <td>${statusBadge(item.status)}${item.dispatched_to ? `<div style="font-size:10px;color:var(--t3);margin-top:3px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${item.dispatched_to}">👤 ${item.dispatched_to}</div>` : ''}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:5px;justify-content:center">
          ${item.status === 'Sold' ? `<button onclick="returnToStock('${item.id}')" class="btn btn-ghost btn-sm" title="คืนเป็น Available">♻️</button>` : ''}
          ${item.status === 'Repair' ? `<button onclick="openRepairDetailBySN('${item.sn}')" class="btn btn-orange btn-sm" title="ดูรายการซ่อม">🔧</button>` : ''}
          <button onclick="openEdit('${item.id}')" class="btn btn-ghost btn-sm">✏️</button>
          ${currentRole === 'admin' ? `<button onclick="delItem('${item.id}')" class="btn btn-red btn-sm">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
  document.getElementById('rec-count').textContent = data.length;
}

async function returnToStock(id) {
  const item = stock.find(i => i.id === id); if (!item) return;
  const old = item.status;
  try {
    const { error } = await supaClient.from('inventory').update({ status: 'Available', dispatched_at: null }).eq('id', id);
    if (error) throw error;
    item.status = 'Available'; item.dispatched_at = null;
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
  document.getElementById('edit-modal').classList.add('open');
}

async function saveEdit() {
  const id = document.getElementById('edit-idx').value;
  const item = stock.find(x => x.id === id); if (!item) return;
  const oldSN = item.sn;
  const newSN = document.getElementById('edit-sn').value.trim();
  const payload = {
    category: document.getElementById('edit-cat').value,
    name: document.getElementById('edit-name').value,
    code: document.getElementById('edit-code').value,
    sn: newSN,
    lot_no: document.getElementById('edit-lot').value.trim() || null,
    status: document.getElementById('edit-status').value,
  };
  if (newSN !== oldSN) payload.prev_sn = oldSN;

  try {
    const { error } = await supaClient.from('inventory').update(payload).eq('id', id);
    if (error) throw error;
    Object.assign(item, payload);
    if (newSN !== oldSN) {
      await logTransaction(today(), '✏️ เปลี่ยน SN', item.name, item.code, newSN, getBalance(item.code), `เปลี่ยน SN: ${oldSN} → ${newSN}`);
    }
    closeModal('edit-modal'); filterStock(); checkAlerts();
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
  if (!confirm(`ลบสินค้า SN: ${item.sn}?\n(ไม่สามารถกู้คืนได้)`)) return;
  try {
    const { error } = await supaClient.from('inventory').delete().eq('id', id);
    if (error) throw error;
    stock = stock.filter(x => x.id !== id);
    filterStock(); checkAlerts();
    toast(`ลบ SN: ${item.sn} สำเร็จ`, 'success');
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}
