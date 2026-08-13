// ══════════════════════════════════════════════════════════════
//  GRN — ใบรับเข้าสินค้า (Goods Receive Note) — CREATE / SAVE / PRINT
// ══════════════════════════════════════════════════════════════
function genGRNNo() {
  const n = new Date(), yy = String(n.getFullYear()).slice(-2), mm = String(n.getMonth()+1).padStart(2,'0'), dd = String(n.getDate()).padStart(2,'0');
  return nextDocNo(`GRN-${yy}${mm}${dd}-`, grnHistory.map(g => g.grnNo));
}

function openGRNModal() {
  if (!inSession.length) return toast('ไม่มีรายการในเซสชั่นนี้ ให้สแกนรับเข้าก่อน', 'error');
  grnModalMode = 'create';
  document.getElementById('grn-modal-badge').style.display = 'none';
  document.getElementById('grn-modal-hint').textContent = 'กรอกข้อมูลและกด "บันทึก GRN" เพื่อบันทึกประวัติ';
  document.getElementById('grn-save-btn').style.display = 'inline-flex';
  document.getElementById('grn-no').readOnly = false;
  document.getElementById('grn-supplier').readOnly = false;
  document.getElementById('grn-po').readOnly = false;
  document.getElementById('grn-lot').readOnly = false;
  document.getElementById('grn-no').value = genGRNNo();
  document.getElementById('grn-date').textContent = fmtDate(nowISO());
  document.getElementById('grn-supplier').value = document.getElementById('i-supplier').value.trim();
  document.getElementById('grn-po').value = document.getElementById('i-po').value.trim();
  document.getElementById('grn-lot').value = document.getElementById('i-lot').value.trim();

  const items = document.getElementById('grn-items');
  const grp = {};
  inSession.forEach(i => {
    if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
    grp[i.name].qty++; grp[i.name].sns.push(i.sn);
  });
  items.innerHTML = Object.entries(grp).map(([name, v], i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;white-space:nowrap;vertical-align:top">${i+1}. ${name}<div style="font-size:10px;color:#888;white-space:nowrap">${v.code} / ${v.category}</div></td>
      <td style="text-align:center;padding:6px 8px">${v.qty}</td>
      <td style="padding:6px 8px;font-size:10px;color:#777;font-family:monospace">${v.sns.join(', ')}</td>
    </tr>`).join('');
  document.getElementById('grn-modal').classList.add('open');
}

async function saveGRN() {
  const grnNo    = document.getElementById('grn-no').value.trim();
  const supplier = document.getElementById('grn-supplier').value.trim();
  const poNo     = document.getElementById('grn-po').value.trim();
  const lotNo    = document.getElementById('grn-lot').value.trim();

  if (!grnNo) return toast('กรุณาระบุเลขที่ GRN', 'error');
  if (!inSession.length) return toast('ไม่มีรายการสินค้าในเซสชั่น', 'error');

  try {
    const { data: header, error: hErr } = await supaClient.from('grn_headers').insert({
      grn_no: grnNo, grn_date: today(), supplier: supplier || null, po_no: poNo || null, lot_no: lotNo || null, created_by: currentUserId,
    }).select().single();
    if (hErr) {
      if (hErr.code === '23505') return toast(`เลขที่ GRN: ${grnNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }

    const itemRows = inSession.map(i => ({
      grn_header_id: header.id, item_name: i.name, item_code: i.code, item_category: i.category, sn: String(i.sn),
    }));
    const { error: iErr } = await supaClient.from('grn_items').insert(itemRows);
    if (iErr) throw iErr;

    const ids = inSession.map(i => i.id);
    const { error: uErr } = await supaClient.from('inventory')
      .update({ grn_header_id: header.id, supplier: supplier || null, po_no: poNo || null, lot_no: lotNo || null })
      .in('id', ids);
    if (uErr) throw uErr;
    inSession.forEach(i => Object.assign(i, { grn_header_id: header.id, supplier: supplier || null, po_no: poNo || null, lot_no: lotNo || null }));

    grnHistory.unshift({
      id: header.id, grnNo, date: today(), supplier, poNo, lotNo,
      items: inSession.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) })),
      createdAt: header.created_at, createdBy: currentUserId,
    });
    updateGRNBadge();

    const saveBtn = document.getElementById('grn-save-btn');
    saveBtn.textContent = '✅ บันทึกแล้ว';
    saveBtn.style.background = '#2dd4a0';
    toast(`บันทึกใบ GRN: ${grnNo} สำเร็จ`, 'success');
    setTimeout(() => { saveBtn.textContent = '💾 บันทึก GRN'; saveBtn.style.background = '#22d3ee'; }, 3000);
    inSession = []; renderInSession(); filterStock();
  } catch (err) { toast('บันทึก GRN ล้มเหลว: ' + err.message, 'error'); }
}

function closeGRNModal() { document.getElementById('grn-modal').classList.remove('open'); }
function printGRN() { window.print(); }

function renderGRNHistory() {
  const q = (document.getElementById('grnh-q')?.value || '').toLowerCase();
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

  const tbody = document.getElementById('grn-history-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">ยังไม่มีประวัติใบรับเข้า</td></tr>'; return; }
  tbody.innerHTML = data.map(d => `
    <tr class="do-row" onclick="openGRNView('${d.id}')">
      <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--cyan)">${d.grnNo}</span></td>
      <td class="mono" style="font-size:11px">${fmtDate(d.createdAt)}</td>
      <td style="color:var(--t1);font-weight:500">${d.supplier || '—'}</td>
      <td class="mono" style="font-size:11px">${d.lotNo || '—'}</td>
      <td style="text-align:center"><span class="do-summary-chip">${(d.items||[]).length} ชิ้น</span></td>
      <td style="font-size:11px;color:var(--t3)">${d.createdBy||'—'}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="event.stopPropagation();openGRNView('${d.id}')" class="btn btn-ghost btn-sm">👁</button>
          <button onclick="event.stopPropagation();reopenGRNForPrint('${d.id}')" class="btn btn-primary btn-sm">🖨️</button>
          ${currentRole === 'admin' ? `<button onclick="event.stopPropagation();deleteGRN('${d.id}')" class="btn btn-red btn-sm">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function openGRNView(id) {
  const d = grnHistory.find(x => x.id === id); if (!d) return;
  currentViewGRNId = id;
  document.getElementById('grnv-no').textContent = 'เลขที่: ' + d.grnNo;
  document.getElementById('grnv-no2').textContent = d.grnNo;
  document.getElementById('grnv-date').textContent = fmtDate(d.createdAt) + ' ' + new Date(d.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('grnv-supplier').textContent = d.supplier || '—';
  document.getElementById('grnv-po').textContent = d.poNo || '—';
  document.getElementById('grnv-lot').textContent = d.lotNo || '—';
  document.getElementById('grnv-user').textContent = d.createdBy || '—';

  const grp = {};
  (d.items||[]).forEach(i => { grp[i.name] = (grp[i.name] || 0) + 1; });
  document.getElementById('grnv-summary').innerHTML = Object.entries(grp).map(([name, qty]) => `
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:var(--t2)">${name}</span>
      <span style="font-family:var(--mono);font-weight:700;color:var(--cyan)">${qty} ชิ้น</span>
    </div>`).join('');

  document.getElementById('grnv-item-count').textContent = (d.items||[]).length;
  document.getElementById('grnv-items-tbody').innerHTML = (d.items||[]).map((item, i) => `
    <tr>
      <td style="text-align:center;font-size:11px;color:var(--t3)">${i+1}</td>
      <td style="color:var(--t1)">${item.name}</td>
      <td style="color:var(--blue)">${item.category||'—'}</td>
      <td class="code-cell">${item.code}</td>
      <td class="sn-cell">${item.sn}</td>
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
  document.getElementById('grn-date').textContent = fmtDate(d.createdAt);

  const grp = {};
  (d.items||[]).forEach(i => {
    if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
    grp[i.name].qty++; grp[i.name].sns.push(i.sn);
  });
  document.getElementById('grn-items').innerHTML = Object.entries(grp).map(([name, v], i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;white-space:nowrap;vertical-align:top">${i+1}. ${name}<div style="font-size:10px;color:#888;white-space:nowrap">${v.code} / ${v.category}</div></td>
      <td style="text-align:center;padding:6px 8px">${v.qty}</td>
      <td style="padding:6px 8px;font-size:10px;color:#777;font-family:monospace">${v.sns.join(', ')}</td>
    </tr>`).join('');
  document.getElementById('grn-modal').classList.add('open');
}

async function deleteGRN(id) {
  const d = grnHistory.find(x => x.id === id); if (!d) return;
  if (!confirm(`ลบใบ GRN เลขที่: ${d.grnNo}?\n(สินค้าที่รับเข้าจะยังอยู่ในระบบ แค่ตัดการเชื่อมโยงเอกสาร)`)) return;
  try {
    const { error } = await supaClient.from('grn_headers').delete().eq('id', id); // grn_items ลบตามด้วย cascade
    if (error) throw error;
    grnHistory = grnHistory.filter(x => x.id !== id);
    renderGRNHistory(); updateGRNBadge();
    toast('ลบใบ GRN สำเร็จ', 'info');
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}
