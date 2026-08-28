// ══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (!currentUser) return;
  if (e.key === 'F2') { e.preventDefault(); tab('inbound'); }
  if (e.key === 'F3') { e.preventDefault(); tab('outbound'); }
  if (e.key === 'F4') { e.preventDefault(); tab('maintenance'); }
  if (e.key === 'Escape') {
    ['edit-modal','do-modal','repair-detail-modal','do-view-modal','swap-sn-modal','grn-modal','grn-view-modal'].forEach(id => {
      document.getElementById(id).classList.remove('open');
    });
  }
});

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
window.onload = async () => {
  initTheme();
  const d = today();
  document.getElementById('i-date').value = d;
  document.getElementById('o-date').value = d;
  document.getElementById('part-date').value = d;
  document.getElementById('part-move-date').value = d;
  updateClock(); setInterval(updateClock, 30000);
  await checkExistingSession(); // auto-login ถ้ามี session ค้างอยู่ (จำการ login ไว้)
};
