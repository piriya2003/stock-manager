// ══════════════════════════════════════════════════════════════
//  DASHBOARD — ยอดคงคลัง / ของไหลเข้าออก / ความเคลื่อนไหวและใบ DO ล่าสุด
// ══════════════════════════════════════════════════════════════

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
      <div class="cat-name">${escapeHtml(cat)}</div>
      <div class="cat-bar"><span style="width:${total ? Math.round(v.total / total * 100) : 0}%"></span></div>
      <div class="cat-n"><b>${v.total}</b><span>พร้อม ${v.avail}</span></div>
    </div>`).join('') : '<div class="dash-empty">ยังไม่มีข้อมูล</div>';

  // ── เคลื่อนไหวล่าสุด ──
  const recent = txns.slice(0, 7);
  document.getElementById('recent-tx').innerHTML = !recent.length
    ? `<tr><td colspan="5" class="tbl-empty">${t('ยังไม่มีประวัติ')}</td></tr>`
    : recent.map(t => `<tr>
        <td class="mono" style="font-size:11px;white-space:nowrap">${t.createdAt ? new Date(t.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}<div style="color:var(--t3);font-size:10px">${escapeHtml(t.date)}</div></td>
        <td>${typeBadge(t.type)}</td>
        <td style="color:var(--t1);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.name)}</td>
        <td class="sn-cell">${escapeHtml(t.sn)}</td>
        <td style="font-size:11px;color:var(--t3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.note || '')}</td>
      </tr>`).join('');

  // ── ใบ DO ล่าสุด ──
  const recent5 = doHistory.slice(0, 5);
  document.getElementById('dashboard-do-list').innerHTML = !recent5.length
    ? '<div class="dash-empty">ยังไม่มีใบ DO</div>'
    : recent5.map(d => `
      <div class="do-card" onclick="reopenDOForPrint('${d.id}')">
        <div><div class="do-card-num">${escapeHtml(d.doNo)}</div><div class="do-card-meta">${fmtDate(doDateOf(d))}</div></div>
        <div style="flex:1;min-width:0"><div class="do-card-cust" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.customer)}</div><div style="font-size:11px;color:var(--t3)">${escapeHtml(d.type || 'โอนสินค้า')}</div></div>
        <div class="do-summary-chip">${(d.items || []).length} ชิ้น</div>
      </div>`).join('');

  checkAlerts(); updateDOBadge(); updateGRNBadge(); updateClaimBadge();
}
