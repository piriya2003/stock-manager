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
  const q  = (document.getElementById('rep-q')?.value || '').toLowerCase();
  const sf = document.getElementById('rep-status-filter')?.value || '';
  let data = [...repairJobs];
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
  acts.innerHTML = btns;
  document.getElementById('repair-detail-modal').classList.add('open');
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
      const { error: invErr } = await supaClient.from('inventory').update({ status: 'Available' }).eq('sn', job.sn);
      if (invErr) throw invErr;
      const item = stock.find(i => String(i.sn) === job.sn);
      if (item) item.status = 'Available';
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
  document.getElementById('swap-sn-modal').classList.add('open');
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
  const newSN  = filterBarcode(document.getElementById('swap-new-sn').value, 'swap-msg');
  if (!newSN) { document.getElementById('swap-new-sn').value = ''; return; }
  const reason = document.getElementById('swap-reason').value.trim();
  if (!reason) return toast('กรุณากรอกเหตุผลการเคลม', 'error');

  const newItem = stock.find(i => String(i.sn) === newSN && i.status === 'Available');
  if (!newItem) return toast('เครื่องใหม่ไม่พร้อมใช้งานหรือไม่พบ SN', 'error');

  const oldSN = String(job.sn);
  const oldItem = stock.find(i => String(i.sn) === oldSN);

  try {
    if (oldItem) {
      const { error } = await supaClient.from('inventory').update({
        status: 'Claimed', claimed_at: nowISO(), claim_reason: reason, replaced_by_sn: newSN,
      }).eq('id', oldItem.id);
      if (error) throw error;
      Object.assign(oldItem, { status: 'Claimed', claimed_at: nowISO(), claim_reason: reason, replaced_by_sn: newSN });
    }

    const { error: newErr } = await supaClient.from('inventory').update({ status: 'Sold', prev_sn: oldSN }).eq('id', newItem.id);
    if (newErr) throw newErr;
    Object.assign(newItem, { status: 'Sold', prev_sn: oldSN });

    const { error: jobErr } = await supaClient.from('repair_jobs').update({
      status: 'เคลมเครื่อง', finished_at: nowISO(), replaced_sn: newSN, claim_reason: reason,
    }).eq('id', job.id);
    if (jobErr) throw jobErr;
    Object.assign(job, { status: 'เคลมเครื่อง', finishedAt: nowISO(), replacedSN: newSN, claimReason: reason });

    await logTransaction(today(), '🔄 เคลมสลับ SN', job.name, job.code, oldSN, getBalance(job.code), `เปลี่ยนเป็น ${newSN} เหตุผล: ${reason}`);

    closeModal('swap-sn-modal'); closeModal('repair-detail-modal');
    renderRepairList(); checkAlerts();
    toast('สลับเปลี่ยนเครื่องเคลมสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}
