// ══════════════════════════════════════════════════════════════
//  OUTBOUND
// ══════════════════════════════════════════════════════════════
async function doOutbound() {
  const dt   = document.getElementById('o-date').value || today();
  const typ  = document.getElementById('o-type').value;
  const custId = document.getElementById('o-cust').value;
  const custObj = customers.find(c => c.id === custId);
  const custName = custObj ? custObj.name : '—';
  const sn   = filterBarcode(document.getElementById('o-sn').value, 'o-msg');
  if (!sn) { document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus(); return; }

  const item = stock.find(i => String(i.sn) === sn && i.status === 'Available');
  if (!item) { inlineMsg('o-msg', `❌ SN: ${sn} ไม่มีหรือไม่พร้อมใช้งาน`, false); document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus(); return; }

  try {
    const { error } = await supaClient.from('inventory').update({ status: 'Sold' }).eq('id', item.id);
    if (error) throw error;
    item.status = 'Sold';
    outSession.push(item);
    await logTransaction(dt, typ, item.name, item.code, sn, getBalance(item.code), `→ ${custName}`);
    document.getElementById('o-sn').value = ''; document.getElementById('o-sn').focus();
    inlineMsg('o-msg', `✅ ตัด: ${sn} → ${custName} (คงเหลือ: ${getBalance(item.code)} ชิ้น)`, true);
    renderOutSession(); renderOutboundHistory(); checkAlerts();
  } catch (err) { inlineMsg('o-msg', '❌ บันทึกล้มเหลว: ' + err.message, false); }
}

function renderOutSession() {
  document.getElementById('o-session-count').textContent = outSession.length;
  document.getElementById('o-session').innerHTML = outSession.slice().reverse().map(i =>
    `<div class="scan-result"><span class="sn">${i.sn}</span><span style="color:var(--t2);font-size:11px">${i.name}</span><span class="badge b-orange" style="font-size:9px">📤 OUT</span></div>`
  ).join('');
}

function renderOutboundHistory() {
  const q = (document.getElementById('o-hist-q')?.value || '').toLowerCase();
  let soldItems = stock.filter(i => i.status === 'Sold');
  if (q) soldItems = soldItems.filter(i => i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  document.getElementById('o-hist-total').textContent = soldItems.length;

  const groups = {};
  soldItems.forEach(item => {
    const key = item.name + '|' + item.code;
    if (!groups[key]) groups[key] = { name: item.name, code: item.code, category: item.category, count: 0, sns: [] };
    groups[key].count++; groups[key].sns.push(item.sn);
  });

  const tbody = document.getElementById('o-hist-tbody');
  if (!tbody) return;
  const groupVals = Object.values(groups);
  if (!groupVals.length) { tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">ยังไม่มีรายการโอน/ขายออก</td></tr>'; return; }
  tbody.innerHTML = groupVals.map(g => `
    <tr>
      <td style="color:var(--t1);font-weight:500">${g.name}</td>
      <td><div class="code-cell">${g.code}</div><div style="font-size:10px;color:var(--t3);margin-top:2px">${g.category}</div></td>
      <td style="text-align:center;font-family:var(--mono);color:var(--orange);font-weight:700;font-size:14px">${g.count}</td>
      <td style="font-size:11px;color:var(--t2);font-family:var(--mono);max-width:300px;line-height:1.6;white-space:normal">
        ${g.sns.map(sn => `<span style="display:inline-block;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin:2px 2px;border:1px solid var(--b1)">${sn}</span>`).join('')}
      </td>
    </tr>`).join('');
}
