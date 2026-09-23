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
      <td class="mono">${escapeHtml(t.date)}${t.createdAt ? `<div style="font-size:10px;color:var(--t3)">${new Date(t.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}</td><td>${typeBadge(t.type)}</td>
      <td>${escapeHtml(t.name)}</td><td class="code-cell">${escapeHtml(t.code)}</td>
      <td class="sn-cell">${escapeHtml(t.sn)}</td><td style="text-align:center">${escapeHtml(t.balance)}</td>
      <td>${escapeHtml(t.note)||''}</td><td style="font-size:11px;color:var(--t3)">${escapeHtml(userName(t.user))}</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  IMPORT (Excel / CSV)
// ══════════════════════════════════════════════════════════════
// เดิมอ่านคอลัมน์ตามตำแหน่งตายตัว (row[0]..row[4]) สลับคอลัมน์ในไฟล์ทีเดียว
// ข้อมูลเข้าผิดช่องทั้งไฟล์โดยไม่มีอะไรเตือน — ตอนนี้จับคู่จาก "ชื่อหัวคอลัมน์" แทน
// แล้วเปิดให้แก้การจับคู่เองก่อนกดนำเข้า
const IMPORT_FIELDS = [
  { key: 'sn',       label: 'Serial Number', required: true,
    aliases: ['sn', 'serial', 'serialnumber', 'serialno', 'ซีเรียล', 'ซีเรียลนัมเบอร์', 'หมายเลขเครื่อง', 'เลขเครื่อง'] },
  { key: 'name',     label: 'ชื่อสินค้า',
    aliases: ['name', 'productname', 'itemname', 'item', 'product', 'description', 'ชื่อ', 'ชื่อสินค้า', 'รายการ', 'รายการสินค้า'] },
  { key: 'code',     label: 'รหัสสินค้า',
    aliases: ['code', 'productcode', 'itemcode', 'sku', 'partno', 'partnumber', 'รหัส', 'รหัสสินค้า'] },
  { key: 'category', label: 'หมวดหมู่',
    aliases: ['category', 'cat', 'type', 'group', 'หมวด', 'หมวดหมู่', 'ประเภท', 'กลุ่ม'] },
  { key: 'status',   label: 'สถานะ',
    aliases: ['status', 'state', 'condition', 'สถานะ'] },
];

// สถานะต้องตรงกับ enum ในฐานข้อมูล — ค่าแปลกๆ จากไฟล์ทำให้ insert ล้มทั้งชุด
// เจอค่าที่ไม่รู้จักให้ถอยเป็น Available แทนที่จะพังทั้งไฟล์
const IMPORT_STATUSES = ['Available', 'Sold', 'Repair', 'Claimed'];
// คำที่คนเขียนในช่องสถานะจริงๆ — เดิมเทียบกับ 4 คำอังกฤษเท่านั้น ไฟล์ที่เขียนเป็นไทย
// เลยกลายเป็น "พร้อมใช้" ทั้งแฟ้มโดยไม่มีอะไรเตือน ของที่ขายไปแล้วจึงเด้งกลับเข้าคลัง
const STATUS_ALIASES = {
  Available: ['available', 'instock', 'in stock', 'stock', 'พร้อมใช้', 'พร้อมใช้งาน', 'พร้อม', 'ในคลัง', 'คงคลัง', 'คงเหลือ', 'ว่าง', 'ปกติ'],
  Sold:      ['sold', 'transferred', 'transfer', 'issued', 'out', 'ขาย', 'ขายแล้ว', 'ขายออก', 'โอน', 'โอนแล้ว', 'โอน/ขาย', 'โอน / ขาย', 'โอนขาย', 'เบิก', 'เบิกแล้ว', 'จ่ายออก', 'จ่ายแล้ว', 'ออกแล้ว', 'ส่งแล้ว'],
  Repair:    ['repair', 'repairing', 'service', 'ซ่อม', 'ส่งซ่อม', 'รับซ่อม', 'รอซ่อม', 'กำลังซ่อม', 'อยู่ระหว่างซ่อม'],
  Claimed:   ['claimed', 'claim', 'damaged', 'broken', 'เคลม', 'เคลมแล้ว', 'ส่งเคลม', 'ชำรุด', 'เสีย', 'เคลม/ชำรุด', 'เคลม / ชำรุด'],
};
// คืน null เมื่ออ่านไม่ออก เพื่อให้ฝั่งที่เรียกนับและเตือนได้ ว่าจะถูกบันทึกเป็น "พร้อมใช้"
function matchImportStatus(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const hit = IMPORT_STATUSES.find(x => x.toLowerCase() === s);
  if (hit) return hit;
  return Object.keys(STATUS_ALIASES).find(k => STATUS_ALIASES[k].includes(s)) || null;
}
function normImportStatus(v) { return matchImportStatus(v) || 'Available'; }

function normHeader(h) { return String(h ?? '').toLowerCase().replace(/[\s_\-.()]/g, ''); }

// จับคู่หัวคอลัมน์ในไฟล์กับฟิลด์ที่เรารู้จัก — คอลัมน์หนึ่งใช้ได้ครั้งเดียว
function autoDetectImportMap(headers) {
  const used = new Set(), map = {};
  IMPORT_FIELDS.forEach(f => {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.aliases.includes(normHeader(h)));
    map[f.key] = idx;
    if (idx >= 0) used.add(idx);
  });
  return map;
}

function onFileDrop(e) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }
function onFileSelect(e) { const f = e.target.files[0]; if (f) processFile(f); }
function processFile(f) {
  if (f.size > 10 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 10MB', 'error');
  const r = new FileReader();
  r.onload = ev => {
    const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const j  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!j.length) { toast('ไฟล์ว่าง ไม่มีข้อมูล', 'error'); return; }

    // บางแถวใน Excel สั้นกว่าแถวหัว — เทียบจากคอลัมน์ที่ยาวที่สุดจะได้ไม่ตกหล่น
    impHeaders = j[0].map(h => String(h ?? ''));
    const width = Math.max(impHeaders.length, ...j.map(r2 => r2.length));
    while (impHeaders.length < width) impHeaders.push('');
    impRows = j.slice(1);
    impMap = autoDetectImportMap(impHeaders);

    document.getElementById('import-preview').style.display = 'block';
    document.getElementById('import-summary').textContent = `ไฟล์: ${f.name} (${impRows.length} แถว)`;
    renderImportMapUI();
  };
  r.readAsArrayBuffer(f);
}

function renderImportMapUI() {
  const colOpts = (sel) => impHeaders.map((h, i) =>
    `<option value="${i}" ${sel === i ? 'selected' : ''}>${escapeHtml(`${i + 1}. ${h || '(ไม่มีชื่อ)'}`)}</option>`).join('');

  document.getElementById('import-map').innerHTML = IMPORT_FIELDS.map(f => `
    <div class="form-row">
      <label class="field-label"${f.required ? ' style="color:var(--orange)"' : ''}>${f.label}${f.required ? ' *' : ''}</label>
      <select onchange="setImportMap('${f.key}', this.value)">
        <option value="-1" ${impMap[f.key] < 0 ? 'selected' : ''}>— ไม่ใช้ —</option>
        ${colOpts(impMap[f.key])}
      </select>
    </div>`).join('');

  // แถวป้ายใต้หัวตาราง บอกว่าคอลัมน์นี้จะเข้าช่องไหน — เห็นทันทีถ้าจับคู่ผิด
  const labelOf = {};
  IMPORT_FIELDS.forEach(f => { if (impMap[f.key] >= 0) labelOf[impMap[f.key]] = f.label; });
  document.getElementById('preview-thead').innerHTML = impHeaders.map(h =>
    `<th style="padding:8px 12px;color:var(--t3);font-size:10px;text-transform:uppercase">${escapeHtml(h)}</th>`).join('');
  document.getElementById('preview-maprow').innerHTML = impHeaders.map((h, i) =>
    `<th style="padding:4px 12px;font-size:10px;font-weight:600;color:${labelOf[i] ? 'var(--blue)' : 'var(--t3)'}">${labelOf[i] ? '→ ' + escapeHtml(labelOf[i]) : '— ข้าม —'}</th>`).join('');

  // ช่องสถานะโชว์ด้วยว่าคำในไฟล์จะถูกบันทึกเป็นสถานะไหน — เดิมเห็นแต่ค่าจากไฟล์
  // คำที่ระบบอ่านไม่ออกจะกลายเป็น "พร้อมใช้" เงียบๆ ต้องเห็นก่อนกดนำเข้า
  const statusCell = raw => {
    const hit = matchImportStatus(raw);
    const label = statusText(hit || 'Available');
    return `<div style="font-size:10px;color:${hit ? 'var(--blue)' : 'var(--orange)'};margin-top:2px">`
         + `→ ${escapeHtml(label)}${hit ? '' : ' ' + escapeHtml('(อ่านไม่ออก)')}</div>`;
  };
  document.getElementById('preview-tbody').innerHTML = impRows.slice(0, 5).map(row =>
    `<tr>${impHeaders.map((h, i) => `<td style="padding:7px 12px;color:var(--t2);border-top:1px solid rgba(255,255,255,.03)">${escapeHtml(row[i] ?? '')}${
      i === impMap.status ? statusCell(row[i]) : ''}</td>`).join('')}</tr>`
  ).join('');

  const missing = IMPORT_FIELDS.filter(f => f.required && impMap[f.key] < 0);
  if (missing.length) {
    inlineMsg('import-map-msg', `❌ ยังไม่ได้เลือกคอลัมน์: ${missing.map(f => f.label).join(', ')} — นำเข้าไม่ได้จนกว่าจะเลือก`, false);
  } else {
    const auto = IMPORT_FIELDS.filter(f => impMap[f.key] >= 0).length;
    inlineMsg('import-map-msg', `✅ จับคู่ได้ ${auto} คอลัมน์ — ตรวจแถวป้าย "→" ใต้หัวตารางว่าตรงไหม แล้วกดนำเข้า`, true);
  }
}

function setImportMap(key, val) {
  const idx = Number(val);
  // คอลัมน์เดียวไปได้ช่องเดียว — เลือกซ้ำให้ปลดของเดิมออกก่อน กันข้อมูลเข้าสองช่อง
  if (idx >= 0) Object.keys(impMap).forEach(k => { if (k !== key && impMap[k] === idx) impMap[k] = -1; });
  impMap[key] = idx;
  renderImportMapUI();
}

async function confirmImport() {
  const missing = IMPORT_FIELDS.filter(f => f.required && impMap[f.key] < 0);
  if (missing.length) return inlineMsg('import-map-msg', `❌ ต้องเลือกคอลัมน์ ${missing.map(f => f.label).join(', ')} ก่อนนำเข้า`, false);

  const cell = (row, key) => {
    const i = impMap[key];
    return (i == null || i < 0) ? '' : String(row[i] ?? '').trim();
  };

  const candidates = [], seen = new Set();
  let noSN = 0, dupInFile = 0, dupInStock = 0, unreadable = 0;
  impRows.forEach(row => {
    const sn = cell(row, 'sn').replace(/^\*+|\*+$/g, '');
    if (!sn) { noSN++; return; }
    if (seen.has(sn)) { dupInFile++; return; }
    if (stock.find(i => String(i.sn) === sn)) { dupInStock++; return; }
    seen.add(sn);
    if (impMap.status >= 0 && !matchImportStatus(cell(row, 'status'))) unreadable++;
    candidates.push({
      category: canonCat(cell(row, 'category')) || 'ทั่วไป',
      name:     cell(row, 'name')     || 'ไม่ระบุ',
      code:     cell(row, 'code')     || '-',
      sn,
      status:   normImportStatus(cell(row, 'status')),
      created_by: currentUserId,
    });
  });

  const skipped = [];
  if (noSN)       skipped.push(`ไม่มี SN ${noSN}`);
  if (dupInFile)  skipped.push(`ซ้ำในไฟล์ ${dupInFile}`);
  if (dupInStock) skipped.push(`มีในระบบแล้ว ${dupInStock}`);

  if (!candidates.length) {
    return inlineMsg('import-map-msg', `❌ ไม่มีรายการใหม่ให้นำเข้า${skipped.length ? ' (ข้าม: ' + skipped.join(', ') + ')' : ''}`, false);
  }
  // SN ที่หน้าตาต่างจาก SN อื่นของสินค้าชื่อเดียวกันในคลัง — แจ้งไว้ในกล่องยืนยันเดียวกัน ไม่ถามแยก
  const odd = candidates.map(c => ({ sn: c.sn, why: snOddReason(c.sn, c.name) })).filter(x => x.why);
  const oddMsg = odd.length
    ? `\n\n⚠️ SN หน้าตาแปลก ${odd.length} รายการ (ตรวจกับฉลากก่อน):\n`
      + odd.slice(0, 10).map(x => `• ${x.sn} — ${x.why}`).join('\n')
      + (odd.length > 10 ? `\n…และอีก ${odd.length - 10} รายการ` : '')
    : '';
  // สรุปสถานะที่จะบันทึก — ของที่ขายไปแล้วเผลอเข้าเป็น "พร้อมใช้" ทำให้ยอดคงเหลือเกินความจริง
  const byStatus = {};
  candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  const statusMsg = '\n\nสถานะที่จะบันทึก: '
    + Object.entries(byStatus).map(([s, n]) => `${statusText(s)} ${n}`).join(', ');
  const unknownMsg = impMap.status < 0
    ? '\n⚠️ ไม่ได้เลือกคอลัมน์สถานะ — ทุกแถวจะเป็น "พร้อมใช้"'
    : (unreadable ? `\n⚠️ อ่านสถานะไม่ออก ${unreadable} แถว — จะบันทึกเป็น "พร้อมใช้"` : '');
  if (!confirm(`นำเข้า ${candidates.length} รายการ?${skipped.length ? '\n\nข้าม: ' + skipped.join(', ') : ''}${statusMsg}${unknownMsg}${oddMsg}`)) return;

  try {
    const { data, error } = await supaClient.from('inventory').insert(candidates).select();
    if (error) throw error;
    stock.unshift(...data);
    clearImport();
    filterStock(); updateDataLists(); checkAlerts();
    toast(`นำเข้าสำเร็จ ${data.length} รายการ${skipped.length ? ' (ข้าม: ' + skipped.join(', ') + ')' : ''}`, 'success');
  } catch (err) { inlineMsg('import-map-msg', '❌ นำเข้าล้มเหลว: ' + err.message, false); }
}

function clearImport() {
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('file-input').value = '';   // เลือกไฟล์เดิมซ้ำได้ ไม่งั้น onchange ไม่ยิง
  impRows = []; impHeaders = []; impMap = {};
}
