// ══════════════════════════════════════════════════════════════
//  DASHBOARD — เปิดมาแล้วต้องตอบ 3 อย่าง: มีอะไรต้องทำ / ของไหลเข้าออกแค่ไหน / อะไรใกล้หมด
// ══════════════════════════════════════════════════════════════

// สินค้าที่ยัง "ใช้ได้จริง" คือของที่พร้อมใช้งาน — ใช้ตัวนี้ตัดสินว่ารุ่นไหนเหลือน้อย
function availByProduct() {
  const m = new Map();
  stock.forEach(i => {
    const k = i.name;
    if (!m.has(k)) m.set(k, { name: i.name, code: i.code, avail: 0, total: 0 });
    const r = m.get(k);
    r.total++;
    if (i.status === 'Available') r.avail++;
  });
  return [...m.values()];
}

// ── กล่อง "ต้องจัดการ" ── รวมงานค้างจากทุกมุมของระบบมาไว้ที่เดียว
function dashTodos() {
  const out = [];

  const waiting = repairJobs.filter(j => j.status === 'รอซ่อม').length;
  const fixing  = repairJobs.filter(j => j.status === 'กำลังซ่อม').length;
  if (waiting + fixing) out.push({
    tone: 'orange', n: waiting + fixing, text: 'งานซ่อมที่ยังไม่ปิด',
    hint: `รอซ่อม ${waiting} · กำลังซ่อม ${fixing}`, go: () => tab('maintenance'),
  });

  // ของที่ตัดสต็อกไปแล้วแต่ไม่เคยอยู่ในใบ DO ใบไหนเลย = ส่งของแล้วแต่ยังไม่มีเอกสาร
  const onDO = new Set();
  doHistory.forEach(d => (d.items || []).forEach(i => onDO.add(String(i.sn))));
  const noDoc = stock.filter(i => i.status === 'Sold' && !onDO.has(String(i.sn))).length;
  if (noDoc) out.push({
    tone: 'blue', n: noDoc, text: 'ชิ้นที่จ่ายออกแล้วยังไม่มีใบ DO',
    hint: 'ออกใบย้อนหลังได้จากหน้าโอน/ขาย', go: () => tab('outbound'),
  });

  const noCust = stock.filter(i => i.status === 'Sold' && !i.dispatched_to).length;
  if (noCust) out.push({
    tone: 'gray', n: noCust, text: 'ชิ้นที่ไม่รู้ว่าจ่ายให้ใคร',
    hint: 'ของเก่าก่อนระบบเก็บชื่อลูกค้า', go: () => { tab('stock'); },
  });

  const noAddr = customers.filter(c => !c.address).length;
  if (noAddr) out.push({
    tone: 'gray', n: noAddr, text: 'ลูกค้าที่ยังไม่มีที่อยู่',
    hint: 'ที่อยู่ใช้พิมพ์บนหัวใบ DO', go: () => tab('master'),
  });

  const claimed = stock.filter(i => i.status === 'Claimed').length;
  if (claimed) out.push({
    tone: 'red', n: claimed, text: 'ชิ้นที่เคลม/ชำรุดค้างอยู่',
    hint: 'ดูรายละเอียดที่หน้าเคลม', go: () => tab('claim'),
  });

  return out;
}

// ── กราฟของเข้า–ออก 7 วันล่าสุด ── นับจากประวัติการเคลื่อนไหว
function dashFlow() {
  const days = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k);
    days.push({ key: d.toLocaleDateString('en-CA'), d, inN: 0, outN: 0 });
  }
  const byKey = new Map(days.map(x => [x.key, x]));
  txns.forEach(t => {
    const key = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-CA') : t.date;
    const row = byKey.get(key); if (!row) return;
    const ty = String(t.type || '');
    if (ty.includes('รับเข้า')) row.inN++;
    else if (ty.includes('ขาย') || ty.includes('โอน') || ty.includes('เบิก') || ty.includes('เคลม')) row.outN++;
  });
  return days;
}

function renderDashboard() {
  const total = stock.length;
  const avail = stock.filter(i => i.status === 'Available').length;
  const sold = stock.filter(i => i.status === 'Sold').length;
  const repair = stock.filter(i => i.status === 'Repair').length;
  const claimed = stock.filter(i => i.status === 'Claimed').length;
  const pct = n => total ? Math.round(n / total * 100) + '%' : '0%';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('d-total', total); set('d-avail', avail); set('d-sold', sold);
  set('d-repair', repair); set('d-claimed', claimed);
  set('d-avail-pct', pct(avail)); set('d-sold-pct', pct(sold));
  set('d-repair-pct', pct(repair)); set('d-claimed-pct', pct(claimed));
  set('d-asof', 'ข้อมูล ณ ' + nowStr());

  // ── ต้องจัดการ ──
  const todos = dashTodos();
  set('d-todo-count', todos.length ? todos.length + ' เรื่อง' : 'ไม่มี');
  const todoEl = document.getElementById('d-todo');
  window.__dashTodos = todos;   // เก็บไว้ให้ปุ่มในรายการเรียกใช้ตอนคลิก
  todoEl.innerHTML = todos.length ? todos.map((t, i) => `
    <button class="todo-row" onclick="__dashTodos[${i}].go()">
      <span class="todo-n t-${t.tone}">${t.n}</span>
      <span class="todo-text"><b>${t.text}</b><span>${t.hint}</span></span>
      <span class="todo-go">→</span>
    </button>`).join('')
    : '<div class="dash-empty">ไม่มีงานค้าง — เคลียร์หมดแล้ว</div>';

  // ── ของเข้า–ออก 7 วัน ──
  const flow = dashFlow();
  const peak = Math.max(1, ...flow.map(f => Math.max(f.inN, f.outN)));
  document.getElementById('d-flow').innerHTML = flow.map(f => `
    <div class="flow-col" title="${f.d.toLocaleDateString('th-TH')} — เข้า ${f.inN} / ออก ${f.outN}">
      <div class="flow-bars">
        <div class="flow-bar in" style="height:${Math.round(f.inN / peak * 100)}%"></div>
        <div class="flow-bar out" style="height:${Math.round(f.outN / peak * 100)}%"></div>
      </div>
      <div class="flow-day">${f.d.getDate()}/${f.d.getMonth() + 1}</div>
    </div>`).join('');

  // ── รุ่นที่เหลือน้อย ──
  const low = availByProduct().sort((a, b) => a.avail - b.avail || b.total - a.total).slice(0, 6);
  const lowPeak = Math.max(1, ...low.map(p => p.avail));
  document.getElementById('d-low').innerHTML = low.length ? low.map(p => `
    <div class="low-row">
      <div class="low-name" title="${p.name}">${p.name}</div>
      <div class="low-bar"><span style="width:${Math.round(p.avail / lowPeak * 100)}%;background:${p.avail === 0 ? 'var(--red)' : p.avail <= 2 ? 'var(--orange)' : 'var(--green)'}"></span></div>
      <div class="low-n ${p.avail === 0 ? 'text-red' : p.avail <= 2 ? 'text-orange' : ''}">${p.avail}</div>
    </div>`).join('') : '<div class="dash-empty">ยังไม่มีสินค้าในคลัง</div>';

  // ── ตามหมวดหมู่ ──
  const catMap = {};
  stock.forEach(i => {
    if (!catMap[i.category]) catMap[i.category] = { total: 0, avail: 0 };
    catMap[i.category].total++;
    if (i.status === 'Available') catMap[i.category].avail++;
  });
  const cats = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total);
  set('cat-count-badge', cats.length + ' หมวด');
  document.getElementById('cat-list').innerHTML = cats.length ? cats.map(([cat, v]) => `
    <div class="cat-row">
      <div class="cat-name">${cat}</div>
      <div class="cat-bar"><span style="width:${total ? Math.round(v.total / total * 100) : 0}%"></span></div>
      <div class="cat-n"><b>${v.total}</b><span>พร้อม ${v.avail}</span></div>
    </div>`).join('') : '<div class="dash-empty">ยังไม่มีข้อมูล</div>';

  // ── เคลื่อนไหวล่าสุด ──
  const recent = txns.slice(0, 7);
  document.getElementById('recent-tx').innerHTML = !recent.length
    ? '<tr><td colspan="5" class="tbl-empty">ยังไม่มีประวัติ</td></tr>'
    : recent.map(t => `<tr>
        <td class="mono" style="font-size:11px;white-space:nowrap">${t.createdAt ? new Date(t.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}<div style="color:var(--t3);font-size:10px">${t.date}</div></td>
        <td>${typeBadge(t.type)}</td>
        <td style="color:var(--t1);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</td>
        <td class="sn-cell">${t.sn}</td>
        <td style="font-size:11px;color:var(--t3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.note || ''}</td>
      </tr>`).join('');

  // ── ใบ DO ล่าสุด ──
  const recent5 = doHistory.slice(0, 5);
  document.getElementById('dashboard-do-list').innerHTML = !recent5.length
    ? '<div class="dash-empty">ยังไม่มีใบ DO</div>'
    : recent5.map(d => `
      <div class="do-card" onclick="reopenDOForPrint('${d.id}')">
        <div><div class="do-card-num">${d.doNo}</div><div class="do-card-meta">${fmtDate(doDateOf(d))}</div></div>
        <div style="flex:1;min-width:0"><div class="do-card-cust" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.customer}</div><div style="font-size:11px;color:var(--t3)">${d.type || 'โอนสินค้า'}</div></div>
        <div class="do-summary-chip">${(d.items || []).length} ชิ้น</div>
      </div>`).join('');

  checkAlerts(); updateDOBadge(); updateGRNBadge(); updateClaimBadge();
}
