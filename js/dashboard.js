// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const total = stock.length, avail = stock.filter(i => i.status === 'Available').length;
  const sold = stock.filter(i => i.status === 'Sold').length, repair = stock.filter(i => i.status === 'Repair').length;
  const pct = n => total ? Math.round(n / total * 100) + '%' : '0%';
  document.getElementById('d-total').textContent = total;
  document.getElementById('d-avail').textContent = avail;
  document.getElementById('d-sold').textContent  = sold;
  document.getElementById('d-repair').textContent = repair;
  document.getElementById('d-avail-pct').textContent = pct(avail) + ' ของทั้งหมด';
  document.getElementById('d-sold-pct').textContent  = pct(sold) + ' ของทั้งหมด';
  document.getElementById('d-repair-pct').textContent = pct(repair) + ' ของทั้งหมด';

  const w = document.getElementById('status-chart-wrap');
  const rows = [
    { label: 'พร้อมใช้งาน', count: avail, cls: 'b-green', color: 'var(--green)' },
    { label: 'โอน/ขายแล้ว', count: sold,  cls: 'b-gray',  color: 'var(--t3)' },
    { label: 'รับซ่อม',     count: repair, cls: 'b-orange', color: 'var(--orange)' },
  ];
  w.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <span class="badge ${r.cls}" style="width:90px;justify-content:center">${r.label}</span>
      <div style="flex:1;background:var(--s3);border-radius:3px;height:6px;overflow:hidden">
        <div style="width:${total ? Math.round(r.count / total * 100) : 0}%;height:100%;background:${r.color};border-radius:3px;transition:width .5s"></div>
      </div>
      <span style="font-family:var(--mono);font-size:13px;font-weight:600;color:${r.color};width:36px;text-align:right">${r.count}</span>
    </div>`).join('');

  const catMap = {};
  stock.forEach(i => {
    if (!catMap[i.category]) catMap[i.category] = { total: 0, avail: 0 };
    catMap[i.category].total++;
    if (i.status === 'Available') catMap[i.category].avail++;
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total);
  document.getElementById('cat-count-badge').textContent = sorted.length + ' หมวดหมู่';
  document.getElementById('cat-tbody').innerHTML = sorted.map(([cat, v]) => `
    <tr>
      <td style="padding:8px 14px;border-top:1px solid rgba(255,255,255,.03);color:var(--blue)">${cat}</td>
      <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-weight:600;color:var(--t1)">${v.total}</td>
      <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--green)">${v.avail}</td>
    </tr>`).join('');

  const tbody = document.getElementById('recent-tx');
  const recent = txns.slice(0, 8);
  tbody.innerHTML = !recent.length ? '<tr><td colspan="5" class="tbl-empty">ยังไม่มีประวัติ</td></tr>' :
    recent.map(t => `<tr>
      <td class="mono" style="font-size:11px">${t.date}${t.createdAt ? ' ' + new Date(t.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</td>
      <td>${typeBadge(t.type)}</td>
      <td style="color:var(--t1);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</td>
      <td class="sn-cell">${t.sn}</td>
      <td style="font-size:11px;color:var(--t3)">${t.note||''}</td>
    </tr>`).join('');

  const doList = document.getElementById('dashboard-do-list');
  const recent5 = doHistory.slice(0, 5);
  doList.innerHTML = !recent5.length ? '<div style="text-align:center;color:var(--t3);font-size:12px;padding:20px">ยังไม่มีใบ DO</div>' :
    recent5.map(d => `
      <div class="do-card" onclick="reopenDOForPrint('${d.id}')">
        <div><div class="do-card-num">${d.doNo}</div><div class="do-card-meta">${fmtDate(doDateOf(d))}</div></div>
        <div style="flex:1;min-width:0"><div class="do-card-cust" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.customer}</div><div style="font-size:11px;color:var(--t3)">${d.type||'โอนสินค้า'}</div></div>
        <div class="do-summary-chip">${(d.items||[]).length} ชิ้น</div>
      </div>`).join('');
  checkAlerts(); updateDOBadge(); updateGRNBadge(); updateClaimBadge();
}
