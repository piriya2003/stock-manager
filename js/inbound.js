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
    if (!document.getElementById('i-subcat').value && mp.subcategory) document.getElementById('i-subcat').value = mp.subcategory;
  }
}

// ค่าที่กรอกไว้ในฟอร์มรับเข้า ใช้ร่วมกันทั้งแบบสแกนทีละชิ้นและแบบวางทีเดียวหลายตัว
function inboundFields() {
  const g = id => document.getElementById(id).value.trim();
  return {
    dt: document.getElementById('i-date').value || today(),
    cat: g('i-cat') || 'ไม่ระบุ', subcat: g('i-subcat'),
    nm: g('i-name'), cd: g('i-code') || '-',
    lot: g('i-lot') || null, sup: g('i-supplier') || null, po: g('i-po') || null,
  };
}

// ยังไม่ได้รันสคริปต์เพิ่มคอลัมน์ subcategory — ลองใหม่โดยตัดออก ไม่ให้การรับเข้าพังทั้งใบ
function isMissingSubcat(error, subcat) {
  return !!(error && subcat && /subcategory/i.test(error.message || ''));
}

async function doInbound() {
  const { dt, cat, subcat, nm, cd, lot, sup, po } = inboundFields();
  const sn  = filterBarcode(document.getElementById('i-sn').value, 'i-msg');
  if (!sn) { document.getElementById('i-sn').value = ''; document.getElementById('i-sn').focus(); return; }
  if (!nm) return inlineMsg('i-msg', '❌ กรุณาระบุชื่อสินค้า', false);

  try {
    const row = { category: cat, name: nm, code: cd, sn, status: 'Available', created_by: currentUserId, lot_no: lot, supplier: sup, po_no: po };
    if (subcat) row.subcategory = subcat;
    let { data, error } = await supaClient.from('inventory').insert(row).select().single();
    if (isMissingSubcat(error, subcat)) {
      delete row.subcategory;
      ({ data, error } = await supaClient.from('inventory').insert(row).select().single());
      if (!error) toast('รับเข้าแล้ว แต่ยังเก็บหมวดหมู่ย่อยไม่ได้ — ต้องรันสคริปต์เพิ่มคอลัมน์ก่อน', 'warning');
    }
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
  const { dt, cat, subcat, nm, cd, lot, sup, po } = inboundFields();
  if (!nm) return inlineMsg('i-bulk-msg', '❌ กรุณาระบุชื่อสินค้าในช่องด้านบนก่อน', false);

  const raw = document.getElementById('i-bulk').value || '';
  const list = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean))];
  if (!list.length) return inlineMsg('i-bulk-msg', '❌ กรุณาวาง/พิมพ์รายการ SN ก่อน', false);

  // ตัด SN ที่มีอยู่ในระบบแล้วออก (ฐานข้อมูลกันซ้ำอยู่แล้ว แต่เช็คก่อนเพื่อรายงานให้ชัด)
  const dup = [], toAdd = [];
  list.forEach(sn => (stock.some(i => String(i.sn) === sn) ? dup : toAdd).push(sn));
  if (!toAdd.length) return inlineMsg('i-bulk-msg', `❌ ทุก SN มีในระบบแล้ว (${dup.length} รายการ)`, false);

  try {
    const mkRows = withSub => toAdd.map(sn => {
      const r = { category: cat, name: nm, code: cd, sn, status: 'Available',
                  created_by: currentUserId, lot_no: lot, supplier: sup, po_no: po };
      if (withSub && subcat) r.subcategory = subcat;
      return r;
    });
    let { data, error } = await supaClient.from('inventory').insert(mkRows(true)).select();
    if (isMissingSubcat(error, subcat)) {
      ({ data, error } = await supaClient.from('inventory').insert(mkRows(false)).select());
      if (!error) toast('รับเข้าแล้ว แต่ยังเก็บหมวดหมู่ย่อยไม่ได้ — ต้องรันสคริปต์เพิ่มคอลัมน์ก่อน', 'warning');
    }
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
  const el = document.getElementById('i-session');
  if (!inSession.length) {
    el.innerHTML = '<div class="scan-empty">ยังไม่มีรายการ<br>ยิงบาร์โค้ดเพื่อเริ่มได้เลย</div>';
    return;
  }
  // เลขลำดับนับตามที่สแกนจริง แต่เรียงตัวล่าสุดไว้บนสุด — เลขบนสุดจึงเท่ากับจำนวนที่รับเข้าแล้ว
  el.innerHTML = inSession.map((i, idx) => `
    <div class="scan-row">
      <span class="scan-no">${idx + 1}</span>
      <span class="scan-sn">${i.sn}</span>
      <span class="scan-side">${i.name}${i.lot_no ? `<br>🏷 ${i.lot_no}` : ''}</span>
      <button onclick="removeInboundItem('${i.id}')" class="btn btn-ghost btn-sm" style="flex-shrink:0;color:var(--red)" title="ลบรายการนี้ (สแกนผิด/ผิดภาษา)">✕</button>
    </div>`).reverse().join('');
}

// ลบรายการที่สแกนผิดออกจากเซสชั่นรับเข้า — ยังไม่ได้บันทึกใบ GRN จึงลบออกจากคลังได้เลย ไม่ต้องผ่านขั้นคืนสต็อก
async function removeInboundItem(id) {
  const item = inSession.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`ลบ SN: ${item.sn} ออกจากเซสชั่นนี้ และลบออกจากคลังสินค้า?\n(ยังไม่ได้บันทึกใบ GRN จึงลบทิ้งได้เลย)`)) return;

  try {
    const { data, error } = await supaClient.from('inventory').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีสิทธิ์ลบ (เฉพาะแอดมิน)');

    inSession = inSession.filter(i => i.id !== id);
    stock = stock.filter(i => i.id !== id);
    renderInSession(); updateBalance(); filterStock(); checkAlerts();
    toast(`ลบ SN: ${item.sn} ออกจากเซสชั่นแล้ว`, 'success');
  } catch (err) { toast('ลบไม่สำเร็จ: ' + err.message, 'error'); }
}
