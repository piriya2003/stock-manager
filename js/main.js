// ══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (!currentUser) return;
  if (e.key === 'F2') { e.preventDefault(); tab('inbound'); }
  if (e.key === 'F3') { e.preventDefault(); tab('outbound'); }
  if (e.key === 'F4') { e.preventDefault(); tab('maintenance'); }
  if (e.key === 'Escape') {
    if (camCfg) { closeCameraScan(); return; }   // ปิดกล้องก่อน ไม่ปิดหน้าต่างที่อยู่ข้างหลังพร้อมกัน
    // ปิดทุกหน้าต่างที่เปิดอยู่ — เดิมไล่ชื่อเอาเอง หน้าต่างที่เพิ่มทีหลัง (ออกใบ GRN ย้อนหลัง, ประวัติอะไหล่, เปลี่ยนชื่อสินค้า) เลยกด Esc ไม่ปิด
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
  }
});

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
window.onload = async () => {
  initTheme();
  initLang();
  const d = today();
  document.getElementById('i-date').value = d;
  document.getElementById('o-date').value = d;
  document.getElementById('part-date').value = d;
  document.getElementById('part-move-date').value = d;
  updateClock(); setInterval(updateClock, 30000);
  await checkExistingSession(); // auto-login ถ้ามี session ค้างอยู่ (จำการ login ไว้)
};
