// ══════════════════════════════════════════════════════════════
//  AUTH — Supabase Auth (เข้าด้วย username, แปลงเป็น pseudo-email ภายใน)
// ══════════════════════════════════════════════════════════════
function usernameToEmail(u) { return u.trim().toLowerCase() + USERNAME_DOMAIN; }

async function doLogin() {
  const u = document.getElementById('f-user').value.trim();
  const p = document.getElementById('f-pass').value;
  if (!u || !p) return toast('กรุณากรอก username และ password', 'error');

  const loginBtn = document.querySelector('#form-login .btn-primary');
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ กำลังตรวจสอบ...';
  document.getElementById('f-pass').disabled = true;

  try {
    const { data, error } = await supaClient.auth.signInWithPassword({
      email: usernameToEmail(u),
      password: p,
    });
    if (error) throw error;

    await finishLogin(data.session);
  } catch (err) {
    console.error(err);
    const msg = err.message === 'Invalid login credentials'
      ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      : 'เข้าสู่ระบบล้มเหลว: ' + err.message;
    toast(msg, 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'เข้าสู่ระบบ';
    document.getElementById('f-pass').disabled = false;
  }
}

async function finishLogin(session) {
  if (!session) return;
  currentUserId = session.user.id;

  // ดึง profile (username, role) จากตาราง users
  const { data: profile, error: profErr } = await supaClient
    .from('users')
    .select('username, role')
    .eq('id', currentUserId)
    .single();
  if (profErr) throw profErr;

  currentUser = profile.username;
  currentRole = profile.role;

  // ดึงตำแหน่งงาน (position) แบบ best-effort — ถ้ายังไม่มีคอลัมน์นี้ก็ข้ามไป ไม่ทำให้ login พัง
  currentPosition = null;
  try {
    const posRes = await supaClient.from('users').select('position').eq('id', currentUserId).single();
    if (!posRes.error && posRes.data && posRes.data.position) currentPosition = posRes.data.position;
  } catch (e) { /* ยังไม่มีคอลัมน์ position — ใช้ role label แทน */ }

  const roleLabel = currentRole === 'admin' ? 'Administrator' : 'พนักงานทั่วไป';
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('user-name-display').textContent = currentUser;
  document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
  document.getElementById('user-role-display').textContent = currentPosition || roleLabel;
  document.getElementById('f-pass').value = '';

  const isAdmin = currentRole === 'admin';
  // แดชบอร์ดให้ทุกคนเห็น — ส่วนรายงาน/Backup/Import ยังเฉพาะ admin
  ['nav-report', 'nav-backup', 'nav-import'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? 'flex' : 'none';
  });
  const navOv = document.getElementById('nav-overview');
  if (navOv) navOv.style.display = 'flex';
  // เปลี่ยนชื่อสินค้าทีเดียวทั้งคลัง — กระทบทุกชิ้นที่ใช้ชื่อนั้น เลยให้เฉพาะ admin
  const renameBtn = document.getElementById('bulk-rename-btn');
  if (renameBtn) renameBtn.style.display = isAdmin ? 'inline-flex' : 'none';

  showSync('syncing', 'กำลังโหลดข้อมูล...');
  await loadAllData();
  restoreOutSession();
  showSync('success', '✓ โหลดข้อมูลสำเร็จ');

  refreshCustomerSelects(); renderMasterProducts(); renderCustomerList(); updateDataLists();
  tab('overview');
  checkAlerts(); updateDOBadge(); updateGRNBadge(); updateClaimBadge();
  startSessionTimer();
  toast('เข้าสู่ระบบสำเร็จ', 'success');
}

async function checkExistingSession() {
  const { data } = await supaClient.auth.getSession();
  if (data.session) {
    try { await finishLogin(data.session); }
    catch (err) { console.error('Resume session failed:', err); await supaClient.auth.signOut(); }
  }
}

async function doLogout() {
  await supaClient.auth.signOut();
  currentUser = null; currentRole = null; currentUserId = null;
  stopSessionTimer();
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('f-user').value = '';
  document.getElementById('f-pass').value = '';
  inSession = []; outSession = []; sessionDispatchTime = null;
  try { localStorage.removeItem('shq_out_session'); } catch (e) {}
}

function showForgotPassword() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-forgot').style.display = 'flex';
}
function showLoginForm() {
  document.getElementById('form-forgot').style.display = 'none';
  document.getElementById('form-login').style.display = 'flex';
}

async function doForgotPassword() {
  const email = document.getElementById('f-forgot-email').value.trim();
  if (!email) return toast('กรุณากรอกอีเมล', 'error');
  try {
    const { error } = await supaClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    toast('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว (เช็คใน Inbox/Spam)', 'success');
    showLoginForm();
  } catch (err) {
    toast('ส่งลิงก์ล้มเหลว: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  SESSION TIMER (UI เฉยๆ — Supabase ต่ออายุ token ให้อัตโนมัติ)
// ══════════════════════════════════════════════════════════════
function startSessionTimer() {
  clearInterval(sessionTimerInterval);
  loginTime = Date.now();
  sessionTimerInterval = setInterval(() => {
    if (!loginTime) return;
    const elapsed = Date.now() - loginTime;
    const h = Math.floor(elapsed / 3600000), m = Math.floor((elapsed % 3600000) / 60000);
    document.getElementById('session-timer').textContent = `⏱ ใช้งานแล้ว: ${h > 0 ? h + 'ชม. ' : ''}${m}นาที`;
  }, 60000);
}
function stopSessionTimer() {
  clearInterval(sessionTimerInterval);
  loginTime = null;
  const timerEl = document.getElementById('session-timer');
  if (timerEl) timerEl.textContent = '';
}
