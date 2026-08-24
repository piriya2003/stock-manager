// ══════════════════════════════════════════════════════════════
//  EXPORT (CSV) & REPORT
// ══════════════════════════════════════════════════════════════
function csvCell(val) {
  const s = (val ?? '').toString();
  // เลขล้วนที่ยาว (รหัส/SN) → บังคับให้ Excel มองเป็นข้อความ ไม่แปลงเป็น 5.67E+11
  if (/^\d{12,}$/.test(s)) return `"=""${s}"""`;
  return `"${s.replace(/"/g, '""')}"`;
}
function toCSV(rows, headers) {
  return [headers.join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n');
}
function dlCSV(csv, fname) {
  const b = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click();
}
function exportStockCSV() {
  const data = typeof getFilteredStock === 'function' ? getFilteredStock() : stock;
  if (!data.length) return toast('ไม่มีรายการให้ export (ตามที่กรองอยู่)', 'info');
  dlCSV(toCSV(data, ['category','subcategory','name','code','sn','lot_no','supplier','status','received_at','dispatched_at','dispatched_to']), 'stock_export.csv');
  toast(`Export ${data.length} รายการ (ตามที่กรองอยู่)`, 'success');
}
function exportReportCSV() { dlCSV(toCSV(txns, ['date','type','name','code','sn','balance','note','user']), 'report_export.csv'); }
function exportRepairCSV() {
  const rows = repairJobs.map(j => ({ id: j.id, sn: j.sn, name: j.name, code: j.code, category: j.category, customer: j.customer, status: j.status, createdAt: fmtISO(j.createdAt), finishedAt: fmtISO(j.finishedAt), symptom: j.symptom, notes: j.notes||'' }));
  dlCSV(toCSV(rows, ['id','sn','name','code','category','customer','status','symptom','notes','createdAt','finishedAt']), 'repair_export.csv');
}
function exportDOHistoryCSV() {
  const rows = [];
  doHistory.forEach(d => {
    (d.items||[]).forEach(item => {
      rows.push({ doNo: d.doNo, date: fmtDate(doDateOf(d)), type: d.type, customer: d.customer, salesperson: d.salesperson||'', createdBy: userName(d.createdBy), itemName: item.name, itemCode: item.code, itemCategory: item.category, itemSN: item.sn });
    });
  });
  dlCSV(toCSV(rows, ['doNo','date','type','customer','salesperson','createdBy','itemName','itemCode','itemCategory','itemSN']), 'do_history_export.csv');
}
function exportGRNHistoryCSV() {
  const rows = [];
  grnHistory.forEach(g => {
    (g.items||[]).forEach(item => {
      rows.push({ grnNo: g.grnNo, date: fmtDate(g.createdAt), supplier: g.supplier||'', poNo: g.poNo||'', lotNo: g.lotNo||'', createdBy: userName(g.createdBy), itemName: item.name, itemCode: item.code, itemCategory: item.category, itemSN: item.sn });
    });
  });
  dlCSV(toCSV(rows, ['grnNo','date','supplier','poNo','lotNo','createdBy','itemName','itemCode','itemCategory','itemSN']), 'grn_history_export.csv');
}
function exportClaimCSV() {
  const rows = repairJobs.filter(j => j.status === 'เคลมเครื่อง').map(j => ({
    oldSN: j.sn, newSN: j.replacedSN || '', name: j.name, code: j.code || '', category: j.category || '',
    customer: j.customer || '', reason: j.claimReason || '', claimedAt: fmtISO(j.finishedAt),
  }));
  if (!rows.length) return toast('ไม่มีรายการเคลม', 'info');
  dlCSV(toCSV(rows, ['oldSN','newSN','name','code','category','customer','reason','claimedAt']), 'claim_export.csv');
  toast(`Export ${rows.length} รายการเคลม`, 'success');
}
function exportAllCSV() { exportStockCSV(); exportReportCSV(); exportRepairCSV(); }

function renderReport() {
  const q  = document.getElementById('rp-q').value.trim().toLowerCase();
  const ft = document.getElementById('rp-type').value;
  const data = txns.filter(t => (!ft || t.type.includes(ft)) && (!q || String(t.sn).toLowerCase().includes(q) || t.name.toLowerCase().includes(q)));
  updateTxMoreBtn();
  const cnt = document.getElementById('rp-count');
  if (cnt) cnt.innerHTML = `แสดง <b style="color:var(--blue)">${data.length}</b> จากที่โหลดมา ${txns.length} รายการ`
    + (txnsAllLoaded ? ' (ครบทั้งหมดแล้ว)' : ' — ยังมีของเก่ากว่านี้ กด "โหลดประวัติเก่าเพิ่ม"');
  document.getElementById('report-tbody').innerHTML = data.map(t => `
    <tr>
      <td class="mono">${t.date}${t.createdAt ? `<div style="font-size:10px;color:var(--t3)">${new Date(t.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}</td><td>${typeBadge(t.type)}</td>
      <td>${t.name}</td><td class="code-cell">${t.code}</td>
      <td class="sn-cell">${t.sn}</td><td style="text-align:center">${t.balance}</td>
      <td>${t.note||''}</td><td style="font-size:11px;color:var(--t3)">${userName(t.user)}</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  IMPORT (Excel / CSV)
// ══════════════════════════════════════════════════════════════
function onFileDrop(e) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }
function onFileSelect(e) { const f = e.target.files[0]; if (f) processFile(f); }
function processFile(f) {
  if (f.size > 10 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 10MB', 'error');
  const r = new FileReader();
  r.onload = ev => {
    const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const j  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    impRows = j.slice(1);
    document.getElementById('import-preview').style.display = 'block';
    document.getElementById('import-summary').textContent = `ไฟล์: ${f.name} (${impRows.length} แถว)`;
    const thead = document.getElementById('preview-thead');
    const tbody = document.getElementById('preview-tbody');
    if (j[0]) thead.innerHTML = j[0].map(h => `<th style="padding:8px 12px;color:var(--t3);font-size:10px;text-transform:uppercase">${h}</th>`).join('');
    tbody.innerHTML = impRows.slice(0, 5).map(row =>
      `<tr>${row.map(c => `<td style="padding:7px 12px;color:var(--t2);border-top:1px solid rgba(255,255,255,.03)">${c}</td>`).join('')}</tr>`
    ).join('');
  };
  r.readAsArrayBuffer(f);
}

async function confirmImport() {
  const candidates = [];
  impRows.forEach(row => {
    if (row[3]) {
      const cleanSN = String(row[3]).trim().replace(/^\*+|\*+$/g, '');
      if (!stock.find(i => String(i.sn) === cleanSN)) {
        candidates.push({ category: row[0]||'ทั่วไป', name: row[1]||'ไม่ระบุ', code: row[2]||'-', sn: cleanSN, status: row[4]||'Available', created_by: currentUserId });
      }
    }
  });
  if (!candidates.length) { toast('ไม่มีรายการใหม่ให้นำเข้า', 'info'); return; }

  try {
    const { data, error } = await supaClient.from('inventory').insert(candidates).select();
    if (error) throw error;
    stock.unshift(...data);
    document.getElementById('import-preview').style.display = 'none'; impRows = [];
    filterStock(); toast(`นำเข้าสำเร็จ ${data.length} รายการ`, 'success');
  } catch (err) { toast('นำเข้าล้มเหลว (อาจมี SN ซ้ำในไฟล์): ' + err.message, 'error'); }
}
function clearImport() { document.getElementById('import-preview').style.display = 'none'; impRows = []; }
