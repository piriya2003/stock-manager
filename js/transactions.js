// ══════════════════════════════════════════════════════════════
//  TRANSACTIONS LOG
// ══════════════════════════════════════════════════════════════
async function logTransaction(date, type, name, code, sn, balance, note) {
  const row = { tx_date: date, type, item_name: name, item_code: code, sn, balance, note, performed_by: currentUserId };
  txns.unshift({ date, type, name, code, sn, balance, note, user: currentUserId });
  try {
    const { error } = await supaClient.from('transactions').insert(row);
    if (error) throw error;
  } catch (err) { console.error('logTransaction failed:', err); showSync('error', '✗ บันทึก log ล้มเหลว'); }
}
