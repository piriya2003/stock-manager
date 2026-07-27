// ══════════════════════════════════════════════════════════════
//  DO — CREATE / SAVE / PRINT
// ══════════════════════════════════════════════════════════════
function genDONo() {
  const n = new Date(), yy = String(n.getFullYear()).slice(-2), mm = String(n.getMonth()+1).padStart(2,'0'), dd = String(n.getDate()).padStart(2,'0');
  const seq = String(doHistory.length + 1).padStart(4, '0');
  return `DO-${yy}${mm}${dd}-${seq}`;
}

function openDOModal() {
  doFromLiveSession = true;
  doItems = outSession.slice();
  prepDOModal();
}

function openDOFromHistory() {
  const items = getFilteredSoldItems();
  if (!items.length) return toast('ไม่มีรายการสินค้าที่ขายออก (ตามที่ค้นหาอยู่)', 'error');
  doFromLiveSession = false;
  doItems = items.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) }));
  prepDOModal();
}

function prepDOModal() {
  doModalMode = 'create';
  document.getElementById('do-modal-badge').style.display = 'none';
  document.getElementById('do-modal-hint').textContent = 'กรอกข้อมูลและกด "บันทึก DO" เพื่อบันทึกประวัติ';
  document.getElementById('do-save-btn').style.display = 'inline-flex';
  document.getElementById('do-header-text').contentEditable = 'true';
  document.getElementById('do-no').readOnly = false;
  document.getElementById('do-cust').readOnly = false;
  document.getElementById('do-salesperson').readOnly = false;
  document.getElementById('do-machine').readOnly = false;
  document.getElementById('do-no').value = genDONo();
  document.getElementById('do-date').textContent = nowStr();
  const custSel = document.getElementById('o-cust');
  const custObj = customers.find(c => c.id === custSel.value);
  document.getElementById('do-cust').value = custObj ? custObj.name : '';

  const addr = document.getElementById('do-cust-addr'); if (addr) { addr.textContent = ''; addr.contentEditable = 'true'; }
  const items = document.getElementById('do-items');
  if (!doItems.length) {
    items.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;color:#888">ไม่มีรายการ</td></tr>';
  } else {
    const grp = {};
    doItems.forEach(i => {
      if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
      grp[i.name].qty++; grp[i.name].sns.push(i.sn);
    });
    items.innerHTML = Object.entries(grp).map(([name, v], i) => doItemRow(name, v, i)).join('');
  }
  document.getElementById('do-modal').classList.add('open');
}

// แถวสินค้าในใบ DO (คอลัมน์: Product No. / Description / Qty / Unit Price / Amount)
function doItemRow(name, v, i) {
  const modelLine = (v.code && v.code !== '-') ? `<div>Model: ${v.code}</div>` : (v.category ? `<div>${v.category}</div>` : '');
  const sns = v.sns.map(sn => `<div class="sn">SN : ${sn}</div>`).join('');
  return `<tr>
      <td class="c">${i + 1}</td>
      <td><b>${name}</b>${modelLine}${sns}</td>
      <td class="c">${v.qty}</td>
      <td></td>
      <td></td>
    </tr>`;
}

async function saveDO() {
  const doNo       = document.getElementById('do-no').value.trim();
  const custVal    = document.getElementById('do-cust').value.trim();
  const salesVal   = document.getElementById('do-salesperson').value.trim();
  const machineVal = document.getElementById('do-machine').value.trim();
  const headerText = document.getElementById('do-header-text').innerText;
  const typ        = document.getElementById('o-type')?.value || 'โอนสินค้า';
  const custSel    = document.getElementById('o-cust');
  const custId     = customers.some(c => c.id === custSel.value) ? custSel.value : null;

  if (!doNo) return toast('กรุณาระบุเลขที่ DO', 'error');
  if (!custVal) return toast('กรุณาระบุชื่อลูกค้า', 'error');
  if (!doItems.length) return toast('ไม่มีรายการสินค้าในใบ DO', 'error');

  try {
    const { data: header, error: hErr } = await supaClient.from('do_headers').insert({
      do_no: doNo, do_date: today(), type: typ, customer_id: custId, customer_name: custVal,
      salesperson: salesVal, machine: machineVal, header_text: headerText, created_by: currentUserId,
    }).select().single();
    if (hErr) {
      if (hErr.code === '23505') return toast(`เลขที่ DO: ${doNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }

    const itemRows = doItems.map(i => ({
      do_header_id: header.id, item_name: i.name, item_code: i.code, item_category: i.category, sn: String(i.sn),
    }));
    const { error: iErr } = await supaClient.from('do_items').insert(itemRows);
    if (iErr) throw iErr;

    doHistory.unshift({
      id: header.id, doNo, date: today(), type: typ, customer: custVal,
      salesperson: salesVal, machine: machineVal, headerText,
      items: doItems.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) })),
      createdAt: header.created_at, createdBy: currentUserId,
    });
    updateDOBadge();

    const saveBtn = document.getElementById('do-save-btn');
    saveBtn.textContent = '✅ บันทึกแล้ว';
    saveBtn.style.background = '#2dd4a0';
    toast(`บันทึกใบ DO: ${doNo} สำเร็จ`, 'success');
    setTimeout(() => { saveBtn.textContent = '💾 บันทึก DO'; saveBtn.style.background = '#22d3ee'; }, 3000);
    if (doFromLiveSession) { outSession = []; persistOutSession(); renderOutSession(); }
  } catch (err) { toast('บันทึก DO ล้มเหลว: ' + err.message, 'error'); }
}

function closeDOModal() { document.getElementById('do-modal').classList.remove('open'); }
function printDO() { window.print(); }

function renderDOHistory() {
  const q  = (document.getElementById('doh-q').value || '').toLowerCase();
  const ft = document.getElementById('doh-type').value;
  let data = [...doHistory];
  if (ft) data = data.filter(d => d.type === ft);
  if (q) data = data.filter(d =>
    d.doNo.toLowerCase().includes(q) ||
    d.customer.toLowerCase().includes(q) ||
    (d.items||[]).some(i => i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q))
  );

  const totalItems = doHistory.reduce((s, d) => s + (d.items||[]).length, 0);
  const uniqueCusts = new Set(doHistory.map(d => d.customer)).size;
  document.getElementById('doh-total').textContent = doHistory.length;
  document.getElementById('doh-items').textContent = totalItems;
  document.getElementById('doh-custs').textContent = uniqueCusts;
  document.getElementById('doh-count').textContent = data.length;

  const tbody = document.getElementById('do-history-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">ยังไม่มีประวัติใบ DO</td></tr>'; return; }
  tbody.innerHTML = data.map(d => `
    <tr class="do-row" onclick="openDOView('${d.id}')">
      <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--blue)">${d.doNo}</span></td>
      <td class="mono" style="font-size:11px">${fmtDate(d.createdAt)}</td>
      <td>${doTypeBadge(d.type)}</td>
      <td style="color:var(--t1);font-weight:500">${d.customer}</td>
      <td style="text-align:center"><span class="do-summary-chip">${(d.items||[]).length} ชิ้น</span></td>
      <td style="font-size:11px;color:var(--t3)">${d.createdBy||'—'}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="event.stopPropagation();openDOView('${d.id}')" class="btn btn-ghost btn-sm">👁</button>
          <button onclick="event.stopPropagation();reopenDOForPrint('${d.id}')" class="btn btn-primary btn-sm">🖨️</button>
          ${currentRole === 'admin' ? `<button onclick="event.stopPropagation();deleteDO('${d.id}')" class="btn btn-red btn-sm">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function openDOView(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  currentViewDOId = id;
  document.getElementById('dov-no').textContent = 'เลขที่: ' + d.doNo;
  document.getElementById('dov-no2').textContent = d.doNo;
  document.getElementById('dov-date').textContent = fmtDate(d.createdAt) + ' ' + new Date(d.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('dov-type').innerHTML = doTypeBadge(d.type);
  document.getElementById('dov-cust').textContent = d.customer;
  document.getElementById('dov-user').textContent = d.createdBy || '—';
  document.getElementById('dov-sales').textContent = d.salesperson || '—';

  const grp = {};
  (d.items||[]).forEach(i => { grp[i.name] = (grp[i.name] || 0) + 1; });
  document.getElementById('dov-summary').innerHTML = Object.entries(grp).map(([name, qty]) => `
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:var(--t2)">${name}</span>
      <span style="font-family:var(--mono);font-weight:700;color:var(--blue)">${qty} ชิ้น</span>
    </div>`).join('');

  document.getElementById('dov-item-count').textContent = (d.items||[]).length;
  document.getElementById('dov-items-tbody').innerHTML = (d.items||[]).map((item, i) => `
    <tr>
      <td style="text-align:center;font-size:11px;color:var(--t3)">${i+1}</td>
      <td style="color:var(--t1)">${item.name}</td>
      <td style="color:var(--blue)">${item.category||'—'}</td>
      <td class="code-cell">${item.code}</td>
      <td class="sn-cell">${item.sn}</td>
    </tr>`).join('');
  document.getElementById('do-view-modal').classList.add('open');
}

function reopenDOForPrint(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  closeModal('do-view-modal'); doModalMode = 'view';
  document.getElementById('do-modal-badge').style.display = 'inline';
  document.getElementById('do-save-btn').style.display = 'none';
  document.getElementById('do-header-text').innerText = d.headerText || '';
  document.getElementById('do-header-text').contentEditable = 'false';
  ['do-no','do-cust','do-salesperson','do-machine'].forEach(id => { document.getElementById(id).readOnly = true; });
  document.getElementById('do-no').value = d.doNo;
  document.getElementById('do-cust').value = d.customer;
  document.getElementById('do-salesperson').value = d.salesperson || '';
  document.getElementById('do-machine').value = d.machine || '';
  document.getElementById('do-date').textContent = fmtISO(d.createdAt);
  const addr = document.getElementById('do-cust-addr'); if (addr) { addr.textContent = ''; addr.contentEditable = 'false'; }

  const grp = {};
  (d.items||[]).forEach(i => {
    if (!grp[i.name]) grp[i.name] = { qty: 0, sns: [], code: i.code, category: i.category };
    grp[i.name].qty++; grp[i.name].sns.push(i.sn);
  });
  document.getElementById('do-items').innerHTML = Object.entries(grp).map(([name, v], i) => doItemRow(name, v, i)).join('');
  document.getElementById('do-modal').classList.add('open');
}

async function deleteDO(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  if (!confirm(`ลบใบ DO เลขที่: ${d.doNo}?`)) return;
  try {
    const { error } = await supaClient.from('do_headers').delete().eq('id', id); // do_items ลบตามด้วย cascade
    if (error) throw error;
    doHistory = doHistory.filter(x => x.id !== id);
    renderDOHistory(); updateDOBadge();
    toast('ลบใบ DO สำเร็จ', 'info');
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}
