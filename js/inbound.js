// ══════════════════════════════════════════════════════════════
//  INBOUND
// ══════════════════════════════════════════════════════════════
function getBalance(code) { return stock.filter(i => i.code === code && i.status === 'Available').length; }
function updateBalance() {
  const code = document.getElementById('i-code').value;
  document.getElementById('i-balance').textContent = getBalance(code);
  const mp = masterProds.find(p => p.code === code);
  if (mp) {
    if (!document.getElementById('i-name').value) document.getElementById('i-name').value = mp.name;
    if (!document.getElementById('i-cat').value)  document.getElementById('i-cat').value  = mp.category;
  }
}

async function doInbound() {
  const dt  = document.getElementById('i-date').value || today();
  const cat = document.getElementById('i-cat').value.trim() || 'ไม่ระบุ';
  const nm  = document.getElementById('i-name').value.trim();
  const cd  = document.getElementById('i-code').value.trim() || '-';
  const lot = document.getElementById('i-lot').value.trim() || null;
  const sup = document.getElementById('i-supplier').value.trim() || null;
  const po  = document.getElementById('i-po').value.trim() || null;
  const sn  = filterBarcode(document.getElementById('i-sn').value, 'i-msg');
  if (!sn) { document.getElementById('i-sn').value = ''; document.getElementById('i-sn').focus(); return; }
  if (!nm) return inlineMsg('i-msg', '❌ กรุณาระบุชื่อสินค้า', false);

  try {
    const { data, error } = await supaClient.from('inventory')
      .insert({ category: cat, name: nm, code: cd, sn, status: 'Available', created_by: currentUserId, lot_no: lot, supplier: sup, po_no: po })
      .select().single();
    if (error) {
      if (error.code === '23505') { inlineMsg('i-msg', `❌ SN: ${sn} มีในระบบแล้ว!`, false); document.getElementById('i-sn').value = ''; document.getElementById('i-sn').focus(); return; }
      throw error;
    }
    stock.unshift(data); inSession.push(data);
    await logTransaction(dt, '📥 รับเข้า', nm, cd, sn, getBalance(cd), 'รับเข้าคลัง HQ');
    document.getElementById('i-sn').value = ''; document.getElementById('i-sn').focus();
    updateBalance();
    inlineMsg('i-msg', `✅ รับเข้า: ${sn} (คงเหลือ: ${getBalance(cd)} ชิ้น)`, true);
    renderInSession(); checkAlerts();
  } catch (err) { inlineMsg('i-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

// รับเข้าหลายรายการทีเดียว จากรายการ SN (ไม่ต้องสแกน)
async function doInboundBulk() {
  const dt  = document.getElementById('i-date').value || today();
  const cat = document.getElementById('i-cat').value.trim() || 'ไม่ระบุ';
  const nm  = document.getElementById('i-name').value.trim();
  const cd  = document.getElementById('i-code').value.trim() || '-';
  const lot = document.getElementById('i-lot').value.trim() || null;
  const sup = document.getElementById('i-supplier').value.trim() || null;
  const po  = document.getElementById('i-po').value.trim() || null;
  if (!nm) return inlineMsg('i-bulk-msg', '❌ กรุณาระบุชื่อสินค้าในช่องด้านบนก่อน', false);

  const raw = document.getElementById('i-bulk').value || '';
  const list = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean))];
  if (!list.length) return inlineMsg('i-bulk-msg', '❌ กรุณาวาง/พิมพ์รายการ SN ก่อน', false);

  // ตัด SN ที่มีอยู่ในระบบแล้วออก (ฐานข้อมูลกันซ้ำอยู่แล้ว แต่เช็คก่อนเพื่อรายงานให้ชัด)
  const dup = [], toAdd = [];
  list.forEach(sn => (stock.some(i => String(i.sn) === sn) ? dup : toAdd).push(sn));
  if (!toAdd.length) return inlineMsg('i-bulk-msg', `❌ ทุก SN มีในระบบแล้ว (${dup.length} รายการ)`, false);

  try {
    const rows = toAdd.map(sn => ({
      category: cat, name: nm, code: cd, sn, status: 'Available',
      created_by: currentUserId, lot_no: lot, supplier: sup, po_no: po,
    }));
    const { data, error } = await supaClient.from('inventory').insert(rows).select();
    if (error) {
      if (error.code === '23505') return inlineMsg('i-bulk-msg', '❌ มี SN ซ้ำในระบบ — ตรวจรายการแล้วลองใหม่', false);
      throw error;
    }

    stock.unshift(...data);
    inSession.push(...data);
    for (const item of data) {
      await logTransaction(dt, '📥 รับเข้า', nm, cd, item.sn, getBalance(cd), 'รับเข้าคลัง HQ');
    }
    document.getElementById('i-bulk').value = '';
    updateBalance(); renderInSession(); checkAlerts(); filterStock();

    let msg = `✅ รับเข้า ${data.length} รายการ (คงเหลือ: ${getBalance(cd)} ชิ้น)`;
    if (dup.length) msg += `  (ข้าม: มีในระบบแล้ว ${dup.length})`;
    inlineMsg('i-bulk-msg', msg, true);
    toast(`รับเข้า ${data.length} รายการสำเร็จ`, 'success');
    if (dup.length) console.warn('SN ที่มีในระบบแล้ว:', dup.join(', '));
  } catch (err) { inlineMsg('i-bulk-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

function renderInSession() {
  document.getElementById('i-session-count').textContent = inSession.length;
  document.getElementById('i-session').innerHTML = inSession.slice().reverse().map(i =>
    `<div class="scan-result"><span class="sn">${i.sn}</span><span style="color:var(--t2);font-size:11px">${i.name}</span>${i.lot_no ? `<span class="badge b-purple" style="font-size:9px">🏷 ${i.lot_no}</span>` : ''}<span class="badge b-green" style="font-size:9px">📥 IN</span></div>`
  ).join('');
}
