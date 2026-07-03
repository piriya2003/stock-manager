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
  const sn  = filterBarcode(document.getElementById('i-sn').value, 'i-msg');
  if (!sn) { document.getElementById('i-sn').value = ''; document.getElementById('i-sn').focus(); return; }
  if (!nm) return inlineMsg('i-msg', '❌ กรุณาระบุชื่อสินค้า', false);

  try {
    const { data, error } = await supaClient.from('inventory')
      .insert({ category: cat, name: nm, code: cd, sn, status: 'Available', created_by: currentUserId })
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

function renderInSession() {
  document.getElementById('i-session-count').textContent = inSession.length;
  document.getElementById('i-session').innerHTML = inSession.slice().reverse().map(i =>
    `<div class="scan-result"><span class="sn">${i.sn}</span><span style="color:var(--t2);font-size:11px">${i.name}</span><span class="badge b-green" style="font-size:9px">📥 IN</span></div>`
  ).join('');
}
