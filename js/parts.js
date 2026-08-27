// ══════════════════════════════════════════════════════════════
//  PARTS — อะไหล่ (นับเป็นจำนวน ไม่ผูก Serial Number)
//  ต่างจาก inventory ตรงที่ 1 แถว = อะไหล่ 1 "ชนิด" ไม่ใช่ 1 ชิ้น
//  เพราะ RAM/จอ มีทีละหลายสิบชิ้นที่เหมือนกันหมด ยิง SN รายชิ้นไม่ไหว
// ══════════════════════════════════════════════════════════════
const PART_MOVE_PAGE = 300;   // จำนวนประวัติอะไหล่ที่ดึงตอนล็อกอิน

function partById(id) { return parts.find(p => p.id === id); }
const setPartText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// ยังไม่ได้รันสคริปต์สร้างตาราง — บอกให้รู้ว่าต้องทำอะไร แทนที่จะขึ้นหน้าว่างเปล่าให้งง
function partsSetupNotice() {
  return `<div class="card"><div class="card-body" style="text-align:center;padding:32px 20px;line-height:1.9">
    <div style="font-size:32px;margin-bottom:8px">🔧</div>
    <div style="font-weight:600;color:var(--t1);margin-bottom:6px">ยังใช้เมนูอะไหล่ไม่ได้</div>
    <div style="font-size:12px;color:var(--t2)">
      ต้องสร้างตารางในฐานข้อมูลก่อน — เปิดไฟล์ <b class="mono">sql/add-parts.sql</b> ในโปรเจกต์<br>
      ก๊อปไปวางใน Supabase → SQL Editor แล้วกด Run<br>
      เสร็จแล้วกลับมา <b>ออกจากระบบ แล้วล็อกอินใหม่</b>
    </div></div></div>`;
}

// ตัวช่วยเติมชื่อ/ประเภทที่เคยใช้แล้ว — กันพิมพ์ประเภทเพี้ยนจนกรองไม่เจอ ("RAM" กับ "ram")
function updatePartDataLists() {
  const fill = (id, vals) => {
    const dl = document.getElementById(id); if (!dl) return;
    dl.innerHTML = '';
    vals.forEach(v => { const o = document.createElement('option'); o.value = v; dl.appendChild(o); });
  };
  fill('part-cat-dl',  [...new Set(parts.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')));
  fill('part-name-dl', [...new Set(parts.map(p => p.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')));
}

// ══════════════════════════════════════════════════════════════
//  รายการอะไหล่
// ══════════════════════════════════════════════════════════════
function renderParts() {
  const wrap = document.getElementById('parts-wrap');
  const form = document.getElementById('parts-form-card');
  if (partsTableMissing) {
    wrap.innerHTML = partsSetupNotice();
    if (form) form.style.display = 'none';
    return;
  }
  if (form) form.style.display = '';

  const q   = (document.getElementById('part-q')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('part-cat-filter')?.value || '';
  const low = document.getElementById('part-low-only')?.checked;

  let data = [...parts];
  if (cat) data = data.filter(p => (p.category || '') === cat);
  if (low) data = data.filter(p => p.min_qty > 0 && p.qty <= p.min_qty);
  if (q) data = data.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.code || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    (p.note || '').toLowerCase().includes(q));
  data.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'th') || (a.name || '').localeCompare(b.name || '', 'th'));

  // ตัวกรองประเภท — สร้างจากของที่มีจริง ไม่ใช่รายการตายตัว
  const sel = document.getElementById('part-cat-filter');
  if (sel) {
    const cats = [...new Set(parts.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const cur = sel.value;
    sel.innerHTML = '<option value="">— ทุกประเภท —</option>'
      + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    sel.value = cats.includes(cur) ? cur : '';
  }

  const lowCount = parts.filter(p => p.min_qty > 0 && p.qty <= p.min_qty).length;
  setPartText('part-total', parts.length);
  setPartText('part-pieces', parts.reduce((s, p) => s + (p.qty || 0), 0));
  setPartText('part-low', lowCount);
  const lowBadge = document.getElementById('badge-parts');
  if (lowBadge) { lowBadge.style.display = lowCount ? 'inline-flex' : 'none'; lowBadge.textContent = lowCount; }

  if (!data.length) {
    wrap.innerHTML = `<div class="card"><div class="card-body"><div class="tbl-empty" style="padding:28px">${
      parts.length ? 'ไม่พบอะไหล่ตามที่ค้นหา' : 'ยังไม่มีอะไหล่ — เพิ่มรายการแรกได้จากฟอร์มด้านบน'}</div></div></div>`;
    return;
  }

  wrap.innerHTML = `<div class="card"><div class="tbl-wrap">
    <table>
      <thead><tr>
        <th>ประเภท</th><th>ชื่ออะไหล่</th><th>รหัส</th>
        <th style="text-align:center">คงเหลือ</th><th style="text-align:center">ขั้นต่ำ</th>
        <th style="text-align:center;width:230px">รับเข้า / เบิกใช้</th>
        <th style="text-align:center;width:90px">จัดการ</th>
      </tr></thead>
      <tbody>${data.map(p => partRow(p)).join('')}</tbody>
    </table></div></div>`;
}

function partRow(p) {
  const isLow = p.min_qty > 0 && p.qty <= p.min_qty;
  const qtyColor = p.qty === 0 ? 'var(--red)' : isLow ? 'var(--orange)' : 'var(--green)';
  return `<tr>
    <td style="color:var(--blue);font-weight:500">${escapeHtml(p.category) || '—'}</td>
    <td style="color:var(--t1)">${escapeHtml(p.name)}${p.note ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">${escapeHtml(p.note)}</div>` : ''}</td>
    <td class="code-cell">${escapeHtml(p.code) || '—'}</td>
    <td style="text-align:center">
      <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:${qtyColor}">${p.qty}</span>
      <span style="font-size:10px;color:var(--t3)"> ${escapeHtml(p.unit)}</span>
      ${isLow ? '<div style="font-size:9px;color:var(--orange);font-weight:600">⚠️ ใกล้หมด</div>' : ''}
    </td>
    <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--t3)">${p.min_qty || '—'}</td>
    <td>
      <div class="flex gap-1 items-center justify-center">
        <input type="number" min="1" value="1" id="pq-${p.id}" class="mono"
               style="width:64px;text-align:center;padding:4px" title="จำนวน">
        <button onclick="movePart(${jsArg(p.id)}, 1)" class="btn btn-success btn-sm" title="รับเข้า">➕ เข้า</button>
        <button onclick="movePart(${jsArg(p.id)}, -1)" class="btn btn-orange btn-sm" title="เบิกไปใช้">➖ เบิก</button>
      </div>
    </td>
    <td style="text-align:center">
      <div class="flex gap-1 justify-center">
        <button onclick="openPartHistory(${jsArg(p.id)})" class="btn btn-ghost btn-icon btn-sm" title="ดูประวัติ">${icon('eye')}</button>
        <button onclick="editPart(${jsArg(p.id)})" class="btn btn-ghost btn-icon btn-sm" title="แก้ไข">${icon('edit')}</button>
        ${currentRole === 'admin' ? `<button onclick="deletePart(${jsArg(p.id)})" class="btn btn-red btn-icon btn-sm" title="ลบ">${icon('trash')}</button>` : ''}
      </div>
    </td>
  </tr>`;
}

// ══════════════════════════════════════════════════════════════
//  เพิ่ม / แก้ไขอะไหล่
// ══════════════════════════════════════════════════════════════
async function savePart() {
  const g = id => document.getElementById(id).value.trim();
  const name = g('part-name');
  if (!name) return inlineMsg('part-msg', '❌ กรุณาใส่ชื่ออะไหล่', false);

  const payload = {
    name,
    code: g('part-code') || null,
    category: g('part-cat') || 'ไม่ระบุ',
    unit: g('part-unit') || 'ชิ้น',
    min_qty: Math.max(0, parseInt(g('part-min'), 10) || 0),
    note: g('part-note') || null,
  };

  // ชื่อซ้ำจะทำให้ยอดแตกเป็นสองก้อน เช็คก่อนยิงเพื่อให้ข้อความอ่านรู้เรื่องกว่า error ของฐานข้อมูล
  const dupe = parts.find(p => p.id !== editingPartId &&
    (p.name || '').trim().toLowerCase() === name.toLowerCase());
  if (dupe) return inlineMsg('part-msg', `❌ มีอะไหล่ชื่อ "${name}" อยู่แล้ว — ใช้รายการเดิมหรือตั้งชื่อให้ต่างกัน`, false);

  try {
    if (editingPartId) {
      const { data, error } = await supaClient.from('parts').update(payload).eq('id', editingPartId).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('ไม่มีสิทธิ์แก้ไข');
      Object.assign(partById(editingPartId), data[0]);
      inlineMsg('part-msg', `✅ แก้ไข "${name}" แล้ว`, true);
    } else {
      const qty = Math.max(0, parseInt(g('part-qty'), 10) || 0);
      const { data, error } = await supaClient.from('parts')
        .insert({ ...payload, qty, created_by: currentUserId }).select().single();
      if (error) throw error;
      parts.push(data);
      // ยอดตั้งต้นก็คือการรับเข้าครั้งแรก บันทึกไว้ให้ประวัติครบ ไม่ใช่จู่ๆ มีของโผล่มา
      if (qty > 0) await logPartMove(data.id, 'รับเข้า', qty, qty, 'ยอดตั้งต้นตอนสร้างรายการ');
      inlineMsg('part-msg', `✅ เพิ่ม "${name}" แล้ว (${qty} ${payload.unit})`, true);
    }
    cancelEditPart();
    renderParts();
  } catch (err) {
    if (err.code === '23505') inlineMsg('part-msg', '❌ มีอะไหล่ชื่อนี้อยู่แล้ว', false);
    else inlineMsg('part-msg', '❌ บันทึกล้มเหลว: ' + err.message, false);
  }
}

function editPart(id) {
  const p = partById(id); if (!p) return;
  editingPartId = id;
  document.getElementById('part-name').value = p.name || '';
  document.getElementById('part-code').value = p.code || '';
  document.getElementById('part-cat').value  = p.category || '';
  document.getElementById('part-unit').value = p.unit || 'ชิ้น';
  document.getElementById('part-min').value  = p.min_qty || 0;
  document.getElementById('part-note').value = p.note || '';
  // ยอดคงเหลือแก้ตรงนี้ไม่ได้ ต้องผ่านรับเข้า/เบิก เพื่อให้ประวัติตรงกับยอดเสมอ
  document.getElementById('part-qty-row').style.display = 'none';
  document.getElementById('part-save-btn').textContent = '💾 บันทึกการแก้ไข';
  document.getElementById('part-cancel-btn').style.display = 'inline-flex';
  document.getElementById('part-name').focus();
}

function cancelEditPart() {
  editingPartId = null;
  ['part-name', 'part-code', 'part-cat', 'part-note'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('part-unit').value = 'ชิ้น';
  document.getElementById('part-min').value = 0;
  document.getElementById('part-qty').value = 0;
  document.getElementById('part-qty-row').style.display = '';
  document.getElementById('part-save-btn').textContent = '+ เพิ่มอะไหล่';
  document.getElementById('part-cancel-btn').style.display = 'none';
}

async function deletePart(id) {
  const p = partById(id); if (!p) return;
  if (!confirm(`ลบอะไหล่ "${p.name}"?\n(คงเหลือ ${p.qty} ${p.unit} — ประวัติรับเข้า/เบิกของรายการนี้จะถูกลบตามไปด้วย)`)) return;
  try {
    const { data, error } = await supaClient.from('parts').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีสิทธิ์ลบ (เฉพาะแอดมิน)');
    parts = parts.filter(x => x.id !== id);
    partMoves = partMoves.filter(m => m.part_id !== id);
    if (editingPartId === id) cancelEditPart();
    renderParts();
    toast(`ลบอะไหล่ "${p.name}" แล้ว`, 'info');
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
//  รับเข้า / เบิกใช้
// ══════════════════════════════════════════════════════════════
// dir = 1 รับเข้า, -1 เบิกใช้
async function movePart(id, dir) {
  const p = partById(id); if (!p) return;
  const input = document.getElementById('pq-' + id);
  const n = parseInt(input?.value, 10);
  if (!Number.isFinite(n) || n <= 0) return toast('ใส่จำนวนให้ถูกต้องก่อน', 'error');

  const newQty = p.qty + dir * n;
  if (newQty < 0) return toast(`เบิกไม่ได้ — คงเหลือแค่ ${p.qty} ${p.unit}`, 'error');

  const typ = dir > 0 ? 'รับเข้า' : 'เบิกใช้';
  const note = dir > 0 ? '' : (prompt(`เบิก "${p.name}" ${n} ${p.unit}\n\nเบิกไปทำอะไร? (ไม่ใส่ก็ได้)`, '') ?? null);
  if (dir < 0 && note === null) return;   // กดยกเลิกในกล่องถาม = ไม่เบิก

  try {
    // อัปเดตยอดโดยอ้างยอดเดิมด้วย — ถ้ามีคนอื่นเพิ่งแก้ไปก่อน จะได้ 0 แถวแทนที่จะทับยอดเขา
    const { data, error } = await supaClient.from('parts')
      .update({ qty: newQty }).eq('id', id).eq('qty', p.qty).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('ยอดเปลี่ยนไปแล้ว (อาจมีคนอื่นเพิ่งทำรายการ) — โหลดหน้าใหม่แล้วลองอีกครั้ง');

    Object.assign(p, data[0]);
    await logPartMove(id, typ, dir * n, newQty, note || null);
    renderParts();
    toast(`${typ} ${escapeHtml(p.name)} ${n} ${p.unit} — คงเหลือ ${newQty}`, dir > 0 ? 'success' : 'info');
  } catch (err) { toast(`${typ}ล้มเหลว: ` + err.message, 'error'); }
}

// บันทึกประวัติ — ล้มเหลวไม่ควรทำให้ยอดที่ตัดไปแล้วพัง แต่ต้องบอกให้รู้ว่าประวัติหาย
async function logPartMove(partId, type, qty, balance, note) {
  const row = { part_id: partId, move_date: today(), type, qty, balance, note: note || null, performed_by: currentUserId };
  try {
    const { data, error } = await supaClient.from('part_moves').insert(row).select().single();
    if (error) throw error;
    partMoves.unshift(data);
  } catch (err) {
    partMoves.unshift({ ...row, id: 'local-' + Date.now(), created_at: nowISO() });
    toast('⚠️ ทำรายการแล้ว แต่บันทึกประวัติไม่สำเร็จ: ' + err.message, 'warning');
  }
}

// ══════════════════════════════════════════════════════════════
//  ประวัติรายตัว
// ══════════════════════════════════════════════════════════════
function openPartHistory(id) {
  const p = partById(id); if (!p) return;
  document.getElementById('part-hist-title').textContent = p.name;
  document.getElementById('part-hist-sub').textContent = `คงเหลือ ${p.qty} ${p.unit}`;

  const rows = partMoves.filter(m => m.part_id === id);
  document.getElementById('part-hist-tbody').innerHTML = rows.length
    ? rows.map(m => `<tr>
        <td class="mono" style="font-size:11px;white-space:nowrap">${escapeHtml(m.move_date)}
          <div style="color:var(--t3);font-size:10px">${m.created_at ? new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</div></td>
        <td><span class="badge ${m.qty > 0 ? 'b-green' : 'b-orange'}">${m.qty > 0 ? '➕ รับเข้า' : '➖ เบิกใช้'}</span></td>
        <td style="text-align:center;font-family:var(--mono);font-weight:700;color:${m.qty > 0 ? 'var(--green)' : 'var(--orange)'}">${m.qty > 0 ? '+' : ''}${m.qty}</td>
        <td style="text-align:center;font-family:var(--mono)">${m.balance}</td>
        <td style="font-size:11px;color:var(--t2)">${escapeHtml(m.note) || '—'}</td>
        <td style="font-size:11px;color:var(--t3)">${escapeHtml(userName(m.performed_by))}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="tbl-empty">ยังไม่มีประวัติ</td></tr>';

  document.getElementById('part-hist-modal').classList.add('open');
}

// ══════════════════════════════════════════════════════════════
//  Export CSV
// ══════════════════════════════════════════════════════════════
function exportPartsCSV() {
  if (!parts.length) return toast('ยังไม่มีอะไหล่ให้ export', 'info');
  const rows = parts.map(p => ({
    category: p.category || '', name: p.name || '', code: p.code || '',
    qty: p.qty, unit: p.unit || '', min_qty: p.min_qty,
    low: (p.min_qty > 0 && p.qty <= p.min_qty) ? 'ใกล้หมด' : '', note: p.note || '',
  }));
  dlCSV(toCSV(rows, ['category', 'name', 'code', 'qty', 'unit', 'min_qty', 'low', 'note']), 'parts_export.csv');
}
