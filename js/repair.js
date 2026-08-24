// ══════════════════════════════════════════════════════════════
//  REPAIR
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const snField = document.getElementById('r-sn');
  if (snField) {
    snField.addEventListener('input', () => {
      const sn  = snField.value.trim().replace(/^\*+|\*+$/g, '');
      const res = document.getElementById('r-lookup-result');
      if (!sn) { res.style.display = 'none'; return; }
      const item = stock.find(i => String(i.sn) === sn);
      res.style.display = 'block';
      if (item) {
        document.getElementById('r-lookup-name').textContent = item.name;
        document.getElementById('r-lookup-code').textContent = item.code + ' / ' + item.category;
        document.getElementById('r-lookup-status').innerHTML = statusBadge(item.status);
      } else {
        document.getElementById('r-lookup-name').textContent = 'ไม่พบ SN นี้ในระบบ';
        document.getElementById('r-lookup-code').textContent = '';
        document.getElementById('r-lookup-status').innerHTML = '<span class="badge b-red">❌ ไม่พบ</span>';
      }
    });
  }
});

async function doRepair() {
  const sn  = filterBarcode(document.getElementById('r-sn').value, 'r-msg');
  if (!sn) { document.getElementById('r-sn').value = ''; return; }
  const sym  = document.getElementById('r-sym').value.trim();
  const custId = document.getElementById('r-cust').value;
  const tech = document.getElementById('r-tech').value.trim();
  if (!sym) return inlineMsg('r-msg', '❌ กรุณากรอกอาการเสีย', false);

  const item = stock.find(i => String(i.sn) === sn);
  if (!item) return inlineMsg('r-msg', '❌ ไม่พบ SN ในระบบ', false);

  try {
    const { error: uErr } = await supaClient.from('inventory').update({ status: 'Repair' }).eq('id', item.id);
    if (uErr) throw uErr;
    item.status = 'Repair';

    const { data: job, error: jErr } = await supaClient.from('repair_jobs').insert({
      inventory_id: item.id, sn, name: item.name, code: item.code, category: item.category,
      customer_id: custId || null, tech_name: tech, symptom: sym, status: 'รอซ่อม', created_by: currentUserId,
    }).select().single();
    if (jErr) throw jErr;

    const custObj = customers.find(c => c.id === custId);
    repairJobs.unshift({
      id: job.id, sn, name: item.name, code: item.code, category: item.category,
      customer: custObj ? custObj.name : '', customerId: custId,
      techName: tech, symptom: sym, status: 'รอซ่อม', notes: '',
      createdAt: job.created_at, startedAt: null, finishedAt: null,
    });

    await logTransaction(today(), '🔧 รับซ่อม', item.name, item.code, sn, getBalance(item.code), `[${custObj ? custObj.name : '-'}] ${sym}`);
    updateRepairBadges(); checkAlerts();

    document.getElementById('r-sn').value = ''; document.getElementById('r-sym').value = ''; document.getElementById('r-tech').value = '';
    document.getElementById('r-lookup-result').style.display = 'none';
    document.getElementById('r-sn').focus();
    toast(`รับซ่อม SN: ${sn} สำเร็จ`, 'warning');
  } catch (err) { inlineMsg('r-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

function renderRepairList() {
  updateRepairBadges();
  const q  = (document.getElementById('rep-q')?.value || '').trim().toLowerCase();
  const sf = document.getElementById('rep-status-filter')?.value || '';
  let data = repairJobs.filter(j => j.status !== 'เคลมเครื่อง'); // รายการเคลมแยกไปอยู่แท็บ "เคลม"
  if (sf) data = data.filter(j => j.status === sf);
  if (q) data = data.filter(j => String(j.sn).toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || j.symptom.toLowerCase().includes(q));
  data.sort((a, b) => {
    const ord = { 'รอซ่อม': 0, 'กำลังซ่อม': 1, 'ซ่อมเสร็จ': 2, 'เคลมเครื่อง': 3 };
    return (ord[a.status] || 0) - (ord[b.status] || 0);
  });

  const el = document.getElementById('repair-list-grid');
  if (!data.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">ไม่มีรายการซ่อม</div>'; return; }
  el.innerHTML = data.map(job => {
    const sc = { 'รอซ่อม': 'wait', 'กำลังซ่อม': 'wip', 'ซ่อมเสร็จ': 'done', 'เคลมเครื่อง': 'done' }[job.status] || 'wait';
    return `<div class="repair-card status-${sc}" onclick="openRepairDetail('${job.id}')">
      <div class="repair-info">
        <div class="repair-sn">${job.sn}</div><div class="repair-name">${job.name}</div>
        <div class="repair-symptom">🚨 ${job.symptom}</div>
        <div class="repair-meta">${repairStatusBadge(job.status)}<span style="font-size:10px;color:var(--t3)">👤 ${job.customer}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ── รายการเคลม (SN เดิม → SN ใหม่) ──
function renderClaimList() {
  const q = (document.getElementById('claim-q')?.value || '').trim().toLowerCase();
  let data = repairJobs.filter(j => j.status === 'เคลมเครื่อง');
  if (q) data = data.filter(j =>
    String(j.sn).toLowerCase().includes(q) ||
    String(j.replacedSN || '').toLowerCase().includes(q) ||
    j.name.toLowerCase().includes(q) ||
    (j.customer || '').toLowerCase().includes(q)
  );
  data.sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));

  const badge = document.getElementById('claim-count');
  if (badge) badge.textContent = data.length + ' รายการ';
  updateClaimBadge();
  const tbody = document.getElementById('claim-tbody');
  if (!tbody) return;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">ยังไม่มีรายการเคลม</td></tr>'; return; }
  tbody.innerHTML = data.map((j, i) => {
    const sameSN = !j.replacedSN || String(j.replacedSN) === String(j.sn);
    const replaceCell = sameSN
      ? `<span class="badge b-gray">📍 ใช้ SN เดิม</span>`
      : `<span class="sn-cell" style="color:var(--green);font-weight:600">${j.replacedSN}</span>`;
    return `
    <tr class="do-row" onclick="openRepairDetail('${j.id}')">
      <td style="text-align:center;color:var(--t3);font-family:var(--mono);font-size:11px">${i + 1}</td>
      <td class="sn-cell" style="color:var(--red);font-weight:600">${j.sn}</td>
      <td>${replaceCell}</td>
      <td style="color:var(--t1)">${j.name}<div style="font-size:10px;color:var(--t3)">${j.code || ''}${j.category ? ' / ' + j.category : ''}</div></td>
      <td style="color:var(--t2)">${j.customer || '—'}</td>
      <td style="font-size:11px;color:var(--t2);max-width:220px;white-space:normal;line-height:1.5">${j.claimReason || '—'}</td>
      <td class="mono" style="font-size:11px">${fmtISO(j.finishedAt)}</td>
    </tr>`;
  }).join('');
}

function openRepairDetailBySN(sn) {
  const job = repairJobs.find(j => String(j.sn) === sn && j.status !== 'ซ่อมเสร็จ') || repairJobs.find(j => String(j.sn) === sn);
  if (job) openRepairDetail(job.id);
  else toast('ไม่พบรายการซ่อมสำหรับ SN นี้', 'warning');
}

function openRepairDetail(id) {
  const job = repairJobs.find(j => j.id === id); if (!job) return;
  currentRepairJobId = id;
  document.getElementById('rd-sn').textContent = 'SN: ' + job.sn;
  document.getElementById('rd-name').textContent = job.name;
  document.getElementById('rd-cat').textContent  = job.category;
  document.getElementById('rd-code').textContent = job.code;
  document.getElementById('rd-sn2').textContent  = job.sn;
  document.getElementById('rd-cust').textContent = job.customer;
  document.getElementById('rd-tech').textContent = job.techName || '—';
  document.getElementById('rd-created').textContent  = fmtISO(job.createdAt);
  document.getElementById('rd-started').textContent  = fmtISO(job.startedAt);
  document.getElementById('rd-finished').textContent = fmtISO(job.finishedAt);
  document.getElementById('rd-duration').textContent =
    job.status === 'ซ่อมเสร็จ' ? durationStr(job.startedAt, job.finishedAt) :
    job.status === 'กำลังซ่อม' ? 'กำลังซ่อม (ยังไม่เสร็จ)' : '—';
  document.getElementById('rd-symptom-display').textContent = job.symptom;
  document.getElementById('rd-notes').value = job.notes || '';

  const steps = ['รอซ่อม', 'กำลังซ่อม', 'ซ่อมเสร็จ', 'เคลมเครื่อง'];
  const cur = steps.indexOf(job.status);
  const isClaimed = job.status === 'เคลมเครื่อง';
  [0, 1, 2, 3].forEach(i => {
    const el = document.getElementById('rdflow-' + i); if (!el) return;
    if (isClaimed) { el.className = 'status-step' + (i < 2 ? ' done' : i === 3 ? ' active' : ''); }
    else { el.className = 'status-step' + (i < cur ? ' done' : i === cur ? ' active' : ''); }
    if (i > 0) {
      const line = document.getElementById('rdline-' + i);
      if (line) line.className = 'status-line' + (isClaimed ? (i < 2 ? ' filled' : '') : (i <= cur ? ' filled' : ''));
    }
  });

  const acts = document.getElementById('rd-actions'); let btns = '';
  if (job.status === 'รอซ่อม') {
    btns += `<button onclick="saveRepairNotes()" class="btn btn-ghost">💾 บันทึกหมายเหตุ</button>
             <button onclick="advanceRepairStatus('กำลังซ่อม')" class="btn btn-cyan">🔵 เริ่มซ่อม</button>`;
  } else if (job.status === 'กำลังซ่อม') {
    btns += `<button onclick="openSwapSNModal('${job.id}')" class="btn btn-orange btn-sm">🔄 เคลม/สลับ SN</button>
             <button onclick="saveRepairNotes()" class="btn btn-ghost">💾 บันทึก</button>
             <button onclick="advanceRepairStatus('ซ่อมเสร็จ')" class="btn btn-success">✅ ซ่อมเสร็จแล้ว</button>`;
  } else {
    btns += `<button onclick="advanceRepairStatus('กำลังซ่อม')" class="btn btn-ghost btn-sm" style="margin-right:auto" title="ย้อนกลับไปสถานะกำลังซ่อม">⏪ แก้ไขสถานะ</button>
             <button onclick="saveRepairNotes()" class="btn btn-primary">💾 บันทึกหมายเหตุ</button>
             <span class="badge b-green" style="padding:8px 14px; font-size:12px">✅ เสร็จสิ้น</span>`;
  }
  // ลบงานซ่อม — เฉพาะแอดมิน (ตรงกับสิทธิ์ฝั่งฐานข้อมูล) วางชิดซ้ายให้ห่างจากปุ่มที่ใช้บ่อย
  if (currentRole === 'admin') {
    btns = `<button onclick="deleteRepairJob('${job.id}')" class="btn btn-red btn-sm" title="ลบงานซ่อมใบนี้">🗑 ลบงานซ่อม</button>`
         + `<span style="flex:1"></span>` + btns;
  }
  acts.innerHTML = btns;
  document.getElementById('repair-detail-modal').classList.add('open');
}

// ลบงานซ่อม/เคลมทิ้ง — ใช้ตอนบันทึกผิดใบ หรือต้องเคลียร์ก่อนลบลูกค้า (ลูกค้าที่มีงานซ่อมผูกอยู่จะลบไม่ได้)
async function deleteRepairJob(id) {
  if (currentRole !== 'admin') return toast('เฉพาะแอดมินเท่านั้นที่ลบงานซ่อมได้', 'error');
  const job = repairJobs.find(j => j.id === id); if (!job) return;

  // เครื่องยังค้างสถานะ "รับซ่อม" เพราะใบนี้ใบเดียว → ลบแล้วต้องปลดกลับเป็นพร้อมใช้ ไม่งั้นค้างอยู่อย่างนั้นตลอด
  const item = stock.find(i => String(i.sn) === String(job.sn));
  const otherActive = repairJobs.some(j => j.id !== id && String(j.sn) === String(job.sn)
                        && j.status !== 'ซ่อมเสร็จ' && j.status !== 'เคลมเครื่อง');
  const willFree = !!item && item.status === 'Repair' && !otherActive;

  if (!confirm(`ลบงานซ่อม SN: ${job.sn}?\n(ประวัติใบนี้จะหายถาวร กู้คืนไม่ได้)`
      + (willFree ? '\n\nสินค้าจะกลับเป็น "พร้อมใช้"' : '')
      + (job.status === 'เคลมเครื่อง' ? '\n\n⚠️ ใบนี้เป็นรายการเคลม ประวัติการสลับเครื่องจะหายไปด้วย\n(สถานะของเครื่องเก่า/เครื่องใหม่ไม่เปลี่ยน)' : ''))) return;

  try {
    const { data, error } = await supaClient.from('repair_jobs').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีสิทธิ์ลบงานซ่อม (เฉพาะแอดมิน)');

    if (willFree) {
      const { error: iErr } = await supaClient.from('inventory').update({ status: 'Available' }).eq('id', item.id);
      if (iErr) throw iErr;
      item.status = 'Available';
    }
    repairJobs = repairJobs.filter(j => j.id !== id);
    closeModal('repair-detail-modal');
    renderRepairList(); renderClaimList(); updateRepairBadges(); updateClaimBadge(); checkAlerts(); filterStock();
    toast(willFree ? `ลบงานซ่อมแล้ว — SN: ${job.sn} กลับเป็นพร้อมใช้` : 'ลบงานซ่อมแล้ว', 'info');
  } catch (err) { toast('ลบงานซ่อมล้มเหลว: ' + err.message, 'error'); }
}

async function saveRepairNotes() {
  const job = repairJobs.find(j => j.id === currentRepairJobId); if (!job) return;
  const notes = document.getElementById('rd-notes').value;
  try {
    const { error } = await supaClient.from('repair_jobs').update({ notes }).eq('id', job.id);
    if (error) throw error;
    job.notes = notes;
    toast('บันทึกสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

async function advanceRepairStatus(newStatus) {
  const job = repairJobs.find(j => j.id === currentRepairJobId); if (!job) return;
  const notes = document.getElementById('rd-notes').value;
  const payload = { notes, status: newStatus };
  if (newStatus === 'กำลังซ่อม' && !job.startedAt) payload.started_at = nowISO();
  if (newStatus === 'ซ่อมเสร็จ') payload.finished_at = nowISO();

  try {
    const { error } = await supaClient.from('repair_jobs').update(payload).eq('id', job.id);
    if (error) throw error;
    Object.assign(job, { notes, status: newStatus, startedAt: payload.started_at || job.startedAt, finishedAt: payload.finished_at || job.finishedAt });

    if (newStatus === 'ซ่อมเสร็จ') {
      const back = { status: 'Available', dispatched_at: null, dispatched_to: null };
      const { error: invErr } = await supaClient.from('inventory').update(back).eq('sn', job.sn);
      if (invErr) throw invErr;
      const item = stock.find(i => String(i.sn) === job.sn);
      if (item) Object.assign(item, back);
      await logTransaction(today(), '✅ ซ่อมเสร็จ', job.name, job.code, job.sn, getBalance(job.code), 'ซ่อมเสร็จเรียบร้อย');
    }
    closeModal('repair-detail-modal'); renderRepairList(); checkAlerts();
  } catch (err) { toast('อัปเดตล้มเหลว: ' + err.message, 'error'); }
}

// ── SWAP / CLAIM SN ──
function openSwapSNModal(jobId) {
  const job = repairJobs.find(j => j.id === jobId); if (!job) return;
  currentSwapJobId = jobId;
  document.getElementById('swap-old-sn-label').textContent = 'SN เดิม: ' + job.sn;
  document.getElementById('swap-old-info').innerHTML = `<b>${job.sn}</b> (${job.name})`;
  document.getElementById('swap-new-sn').value = '';
  document.getElementById('swap-new-lookup').style.display = 'none';
  document.getElementById('swap-reason').value = '';
  document.getElementById('swap-msg').textContent = '';
  setSwapMode('new');
  document.getElementById('swap-sn-modal').classList.add('open');
}

function setSwapMode(mode) {
  swapMode = mode;
  document.getElementById('swap-mode-new').classList.toggle('active', mode === 'new');
  document.getElementById('swap-mode-same').classList.toggle('active', mode === 'same');
  document.getElementById('swap-new-section').style.display = mode === 'new' ? 'flex' : 'none';
}

function onSwapNewSNInput() {
  const newSN  = document.getElementById('swap-new-sn').value.trim().replace(/^\*+|\*+$/g, '');
  const lookup = document.getElementById('swap-new-lookup');
  const info   = document.getElementById('swap-new-info');
  if (!newSN) { lookup.style.display = 'none'; return; }
  const item = stock.find(i => String(i.sn) === newSN);
  lookup.style.display = 'block';
  if (item && item.status === 'Available') {
    info.innerHTML = `<span class="text-green">✅ พร้อมสลับ: ${item.name}</span>`;
  } else {
    info.innerHTML = `<span class="text-red">❌ ไม่พบหรือไม่พร้อมใช้งาน</span>`;
  }
}

async function confirmSwapSN() {
  const job    = repairJobs.find(j => j.id === currentSwapJobId);
  const reason = document.getElementById('swap-reason').value.trim();
  if (!reason) return toast('กรุณากรอกเหตุผลการเคลม', 'error');
  const oldSN = String(job.sn);
  const oldItem = stock.find(i => String(i.sn) === oldSN);

  // ── โหมด "ใช้ SN เดิม" — ไม่มีเครื่องใหม่ เครื่องเดิมกลับไปสถานะ Sold (ส่งคืนลูกค้า) ──
  if (swapMode === 'same') {
    try {
      if (oldItem) {
        const { error } = await supaClient.from('inventory').update({ status: 'Sold', claim_reason: reason }).eq('id', oldItem.id);
        if (error) throw error;
        Object.assign(oldItem, { status: 'Sold', claim_reason: reason });
      }
      const { error: jobErr } = await supaClient.from('repair_jobs').update({
        status: 'เคลมเครื่อง', finished_at: nowISO(), replaced_sn: null, claim_reason: reason,
      }).eq('id', job.id);
      if (jobErr) throw jobErr;
      Object.assign(job, { status: 'เคลมเครื่อง', finishedAt: nowISO(), replacedSN: '', claimReason: reason });

      await logTransaction(today(), '📍 เคลม (SN เดิม)', job.name, job.code, oldSN, getBalance(job.code), `เคลมโดยใช้ SN เดิม — เหตุผล: ${reason}`);
      closeModal('swap-sn-modal'); closeModal('repair-detail-modal');
      renderRepairList(); renderClaimList(); checkAlerts();
      toast('บันทึกเคลม (ใช้ SN เดิม) สำเร็จ', 'success');
    } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
    return;
  }

  // ── โหมด "เปลี่ยน SN ใหม่" ──
  const newSN  = filterBarcode(document.getElementById('swap-new-sn').value, 'swap-msg');
  if (!newSN) { document.getElementById('swap-new-sn').value = ''; return; }

  const newItem = stock.find(i => String(i.sn) === newSN && i.status === 'Available');
  if (!newItem) return toast('เครื่องใหม่ไม่พร้อมใช้งานหรือไม่พบ SN', 'error');

  try {
    if (oldItem) {
      const { error } = await supaClient.from('inventory').update({
        status: 'Claimed', claimed_at: nowISO(), claim_reason: reason, replaced_by_sn: newSN,
      }).eq('id', oldItem.id);
      if (error) throw error;
      Object.assign(oldItem, { status: 'Claimed', claimed_at: nowISO(), claim_reason: reason, replaced_by_sn: newSN });
    }

    // เครื่องใหม่ออกจากคลังไปหาลูกค้าเจ้าเดิม — ต้องบันทึกปลายทาง/เวลาให้ครบเหมือนการจ่ายออกปกติ
    // ไม่งั้นเครื่องเคลมจะหายจากประวัติการจ่ายออก และไม่รู้ว่าไปอยู่กับใคร
    const newDispatch = {
      status: 'Sold', prev_sn: oldSN, dispatched_at: nowISO(),
      dispatched_to: (oldItem && oldItem.dispatched_to) || job.customer || null,
    };
    const { error: newErr } = await supaClient.from('inventory').update(newDispatch).eq('id', newItem.id);
    if (newErr) throw newErr;
    Object.assign(newItem, newDispatch);

    const { error: jobErr } = await supaClient.from('repair_jobs').update({
      status: 'เคลมเครื่อง', finished_at: nowISO(), replaced_sn: newSN, claim_reason: reason,
    }).eq('id', job.id);
    if (jobErr) throw jobErr;
    Object.assign(job, { status: 'เคลมเครื่อง', finishedAt: nowISO(), replacedSN: newSN, claimReason: reason });

    await logTransaction(today(), '🔄 เคลมสลับ SN', job.name, job.code, oldSN, getBalance(job.code), `เปลี่ยนเป็น ${newSN} เหตุผล: ${reason}`);

    closeModal('swap-sn-modal'); closeModal('repair-detail-modal');
    renderRepairList(); renderClaimList(); checkAlerts();
    toast('สลับเปลี่ยนเครื่องเคลมสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}
