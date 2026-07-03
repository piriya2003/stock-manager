// ══════════════════════════════════════════════════════════════
//  THEME TOGGLE (LIGHT/DARK MODE)
// ══════════════════════════════════════════════════════════════
function toggleTheme() {
  const body = document.documentElement;
  const currentTheme = body.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('shq_theme', newTheme); // เก็บแค่ค่า theme (ไม่ใช่ข้อมูลธุรกิจ ปลอดภัย)
  document.getElementById('theme-toggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
}
function initTheme() {
  const savedTheme = localStorage.getItem('shq_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}
