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
  if (!items.length) return toast('ไม่มีรายการสินค้าที่ขายออก (ตามที่กรองอยู่)', 'error');
  doFromLiveSession = false;
  doItems = items.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) }));
  prepDOModal();
  // เติมชื่อลูกค้าจากตัวกรองลูกค้าในหน้าประวัติ (ถ้าเลือกไว้)
  const histCust = document.getElementById('o-hist-cust')?.value;
  if (histCust) document.getElementById('do-cust').value = histCust;
}

// สร้าง DO เฉพาะ "ชุดการจ่าย" เดียว (ตามเวลาที่จ่ายออก)
function openDOFromBatch(batchIndex) {
  const b = outboundBatches[batchIndex];
  if (!b || !b.items.length) return toast('ไม่พบรายการในชุดนี้', 'error');
  doFromLiveSession = false;
  doItems = b.items.map(i => ({ name: i.name, code: i.code, category: i.category, sn: String(i.sn) }));
  prepDOModal();
  if (b.cust) document.getElementById('do-cust').value = b.cust;
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
  document.getElementById('do-date').textContent = fmtDate(nowISO());
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
  recalcDOTotals();
  document.getElementById('do-modal').classList.add('open');
}

// แถวสินค้าในใบ DO (คอลัมน์: Product No. / Description / Qty / Unit Price / Amount)
function doItemRow(name, v, i) {
  const modelLine = (v.code && v.code !== '-') ? `<div>Model: ${v.code}</div>` : (v.category ? `<div>${v.category}</div>` : '');
  const sorted = v.sns.slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })); // เรียง SN น้อย→มาก
  const sns = `<div class="sn-grid">${sorted.map(sn => `<span class="sn">SN : ${sn}</span>`).join('')}</div>`;
  return `<tr data-qty="${v.qty}">
      <td class="c">${i + 1}</td>
      <td><b>${name}</b>${modelLine}${sns}</td>
      <td class="c">${v.qty}</td>
      <td><input class="do-num" data-role="price" inputmode="decimal" oninput="calcDOAmount(this)" title="ราคาต่อหน่วย (พิมพ์ได้)"></td>
      <td><input class="do-num" data-role="amount" inputmode="decimal" oninput="recalcDOTotals()" title="จำนวนเงิน (คำนวณให้ หรือพิมพ์ทับเองได้)"></td>
    </tr>`;
}

// ใส่ราคาต่อหน่วย → คำนวณจำนวนเงินให้ (ยังพิมพ์ทับช่องจำนวนเงินเองได้)
function calcDOAmount(inp) {
  const tr = inp.closest('tr'); if (!tr) return;
  const amt = tr.querySelector('input[data-role="amount"]'); if (!amt) return;
  const qty = parseFloat(tr.dataset.qty || '');
  const price = parseFloat(String(inp.value).replace(/,/g, ''));
  if (!isFinite(qty) || !isFinite(price)) amt.value = '';
  else amt.value = (qty * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  recalcDOTotals();
}

const DO_VAT_RATE = 7;   // ภาษีมูลค่าเพิ่ม (%)
function fmtMoney(n) { return '฿' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// รวมยอด → VAT → ยอดสุทธิ → จำนวนเงินตัวอักษร
function recalcDOTotals() {
  let total = 0, any = false;
  document.querySelectorAll('#do-items input[data-role="amount"]').forEach(el => {
    const v = parseFloat(String(el.value).replace(/,/g, ''));
    if (isFinite(v)) { total += v; any = true; }
  });
  const vat = Math.round(total * DO_VAT_RATE) / 100;
  const grand = Math.round((total + vat) * 100) / 100;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('do-total', fmtMoney(total));
  set('do-vat', fmtMoney(vat));
  set('do-grand', fmtMoney(grand));
  set('do-baht-text', any && grand > 0 ? bahtText(grand) : '—');
}

// อ่านจำนวนเงินเป็นตัวอักษรไทย เช่น 413458.70 → สี่แสนหนึ่งหมื่นสามพันสี่ร้อยห้าสิบแปดบาทเจ็ดสิบสตางค์
function bahtText(num) {
  const n = Math.round((Number(num) || 0) * 100) / 100;
  if (!n) return 'ศูนย์บาทถ้วน';
  const abs = Math.abs(n);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);
  let s = baht > 0 ? readThaiInt(baht) + 'บาท' : '';
  s += satang > 0 ? readThaiInt(satang) + 'สตางค์' : 'ถ้วน';
  return (n < 0 ? 'ลบ' : '') + s;
}
function readThaiInt(n) {
  const d = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const u = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  n = Math.floor(n);
  if (n === 0) return 'ศูนย์';
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000), rest = n % 1000000;
    return readThaiInt(m) + 'ล้าน' + (rest > 0 ? readThaiInt(rest) : '');
  }
  const str = String(n); let out = '';
  for (let i = 0; i < str.length; i++) {
    const dig = Number(str[i]), pos = str.length - i - 1;
    if (!dig) continue;
    if (pos === 0 && dig === 1 && str.length > 1) out += 'เอ็ด';
    else if (pos === 1 && dig === 1) out += 'สิบ';
    else if (pos === 1 && dig === 2) out += 'ยี่สิบ';
    else out += d[dig] + u[pos];
  }
  return out;
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
    if (doFromLiveSession) { outSession = []; sessionDispatchTime = null; persistOutSession(); renderOutSession(); }
  } catch (err) { toast('บันทึก DO ล้มเหลว: ' + err.message, 'error'); }
}

function closeDOModal() { document.getElementById('do-modal').classList.remove('open'); }
function gatherDOData() {
  const g = id => document.getElementById(id);
  return {
    cust:  g('do-cust').value || '',
    addr:  g('do-cust-addr') ? g('do-cust-addr').innerHTML : '',
    no:    g('do-no').value || '',
    staff: g('do-salesperson').value || '',
    po:    g('do-machine').value || '',
    date:  g('do-date').textContent || '',
    note:  g('do-header-text').innerHTML || '',
    items: g('do-items').innerHTML || '',
    total: g('do-total') ? g('do-total').textContent : fmtMoney(0),
    vat:   g('do-vat') ? g('do-vat').textContent : fmtMoney(0),
    grand: g('do-grand') ? g('do-grand').textContent : fmtMoney(0),
    bahtText: g('do-baht-text') ? g('do-baht-text').textContent : '—',
  };
}

// สร้าง HTML ของใบ DO 1 ฉบับ (label = 'ต้นฉบับ' หรือ 'สำเนา') จากข้อมูลปัจจุบัน
function doDocHTML(label, d) {
  return `<table class="do-page"><thead><tr><td>
      <div class="do-lh">
        <div class="do-lh-logo"><img src="logo.png" alt="SGDATAPOS"></div>
        <div class="do-lh-info">
          SGDATAPOS (Thailand) Co. Ltd (Head Office)<br>
          113/30 M.1 A. Muang, Chonburi 20000 Thailand<br>
          เอสจี.ดาต้า.พอส. (ไทยแลนด์) จำกัด (สำนักงานใหญ่)<br>
          113/30 หมู่ 1 ต.อ่างศิลา อ.เมือง จ.ชลบุรี 20000<br>
          โทร. (66) 0802493954
        </div>
      </div>
      <div class="do-taxid">หมายเลขประจำตัวผู้เสียภาษีอากร &nbsp;&nbsp; TAX ID 0205561043127</div>
      <div class="do-doc-title"><div>${label}</div><div>ใบส่งสินค้า</div><div class="en">TAX INVOICE / DELIVERY NOTE / INVOICE</div></div>
    </td></tr></thead><tbody><tr><td>
      <table class="do-info"><tbody><tr>
        <td class="do-to">
          <div style="display:flex;gap:6px"><span style="flex-shrink:0;font-weight:600">TO:</span><span>${d.cust}</span></div>
          <div class="do-addr" style="color:#000">${d.addr}</div>
        </td>
        <td class="do-meta"><table><tbody>
          <tr><td class="k">No.</td><td>${d.no}</td></tr>
          <tr><td class="k">Staff</td><td>${d.staff}</td></tr>
          <tr><td class="k">PO Number</td><td>${d.po}</td></tr>
          <tr><td class="k">Date Issued</td><td>${d.date}</td></tr>
        </tbody></table></td>
      </tr></tbody></table>
      <table class="do-items-tbl">
        <thead><tr><th style="width:56px">Product No.</th><th>Product Description</th><th style="width:46px">Qty</th><th style="width:64px">Unit Price</th><th style="width:72px">Amount</th></tr></thead>
        <tbody>${d.items}</tbody>
      </table>
      <table class="do-totals"><tbody>
        <tr>
          <td class="do-totals-note" rowspan="3">
            <div class="do-baht-row">จำนวนเงิน(ตัวอักษร) <span>${d.bahtText}</span></div>
            <div class="do-pay-info">
              โปรดชำระโดยเงินสด/สั่งจ่ายเช็คในนาม / Payments should be made to:<br>
              บจก. เอสจีดาต้าพอส (ไทยแลนด์)<br>
              ธนาคารกสิกรไทย สาขา ถนนพระยาสัจจา ชลบุรี เลขที่บัญชี 049-1-85819-2
            </div>
          </td>
          <td class="k">จำนวนเงินรวม/Total</td>
          <td class="v">${d.total}</td>
        </tr>
        <tr><td class="k">ภาษีมูลค่าเพิ่ม/VAT 7%</td><td class="v">${d.vat}</td></tr>
        <tr><td class="k">จำนวนเงินสุทธิ/Grand Total</td><td class="v">${d.grand}</td></tr>
      </tbody></table>
      <div class="do-received">ข้าพเจ้าได้รับสินค้าข้างต้นจำนวนถูกต้องและสภาพเรียบร้อย / Received the above goods in good order &amp; condition</div>
      <div class="do-note">หมายเหตุ: <span>${d.note}</span></div>
      <table class="do-sign"><tbody><tr>
        <td><div class="sig-line"></div>ผู้ส่งสินค้า / Approver<br><span class="d">วันที่ ____/____/____</span></td>
        <td><div class="sig-line"></div>ผู้รับสินค้า / Receiver<br><span class="d">วันที่ ____/____/____</span></td>
      </tr></tbody></table>
    </td></tr></tbody>
    <tfoot><tr><td class="do-page-foot"></td></tr></tfoot>
    </table>`;
}

// พิมพ์ 2 ฉบับ: ต้นฉบับ + สำเนา (คนละหน้า) แล้วคืนสภาพช่องแก้ไขเดิม
function printDO() {
  const pa = document.getElementById('printArea');
  pa.querySelectorAll('input').forEach(i => i.setAttribute('value', i.value)); // เก็บค่าที่พิมพ์ไว้ใน attribute
  const saved = pa.innerHTML;
  const d = gatherDOData();
  // ห่อแต่ละฉบับด้วย .do-sheet เพื่อให้ระยะขอบกระดาษอยู่ที่ "ใบ" ไม่ใช่กล่องรวม (หัวจดหมายจะได้สูงเท่ากันทุกแผ่น)
  pa.innerHTML = `<div class="do-sheet">${doDocHTML('ต้นฉบับ', d)}</div>`
               + `<div class="do-sheet do-copy2">${doDocHTML('สำเนา', d)}</div>`;
  window.print();
  pa.innerHTML = saved; // คืนฟอร์มที่แก้ไขได้ (window.print บล็อกจนปิด dialog)
}

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
  document.getElementById('do-date').textContent = fmtDate(d.createdAt);
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
