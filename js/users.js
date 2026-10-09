// ══════════════════════════════════════════════════════════════
//  จัดการผู้ใช้ (piriya คนเดียว) — ตั้งรหัสใหม่ให้คนที่ลืมรหัส / เปลี่ยนสิทธิ์ / เพิ่มผู้ใช้
//  บัญชีเป็น @stockhq.local รับอีเมลรีเซ็ตไม่ได้ และปิดสมัครเองไว้ เลยทำผ่านหน้านี้แทน
//  งานจริงทำในฐานข้อมูลผ่าน admin_set_password / admin_set_role / admin_create_user
//  (sql/add-user-management.sql) ซึ่งเช็คซ้ำอีกชั้นว่าคนกดคือ piriya — ซ่อนเมนูอย่างเดียวกันไม่ได้
// ══════════════════════════════════════════════════════════════
let userList = [];
let resetPwTarget = null;   // { id, username }

// ต้องเป็นแอดมิน และเป็นคนที่ตั้งไว้ใน USER_ADMIN_OWNER (js/config.js) เท่านั้น
function isUserAdminOwner() {
  return currentRole === 'admin' && String(currentUser || '').toLowerCase() === USER_ADMIN_OWNER;
}

async function loadUserList() {
  const tbody = document.getElementById('users-tbody');
  if (!isUserAdminOwner()) { tbody.innerHTML = ''; return; }
  tbody.innerHTML = `<tr><td colspan="3" class="tbl-empty">${t('กำลังโหลด...')}</td></tr>`;
  let res = await supaClient.from('users').select('id, username, role, position');
  if (res.error) res = await supaClient.from('users').select('id, username, role');   // ยังไม่มีคอลัมน์ position
  if (res.error) {
    tbody.innerHTML = `<tr><td colspan="3" class="tbl-empty">${t('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')}: ${escapeHtml(res.error.message)}</td></tr>`;
    return;
  }
  userList = (res.data || []).sort((a, b) => a.username.localeCompare(b.username));
  renderUserList();
}

function renderUserList() {
  const q = (document.getElementById('users-q')?.value || '').trim().toLowerCase();
  const data = userList.filter(u => !q || u.username.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q));
  const tbody = document.getElementById('users-tbody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="3" class="tbl-empty">${t('ไม่พบผู้ใช้')}</td></tr>`; return; }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td>
        <div style="color:var(--t1);font-weight:600">${escapeHtml(u.username)}${u.id === currentUserId ? ` <span style="font-size:11px;color:var(--t3);font-weight:400">(${t('คุณ')})</span>` : ''}</div>
        ${u.position ? `<div style="font-size:11px;color:var(--t3)">${escapeHtml(u.position)}</div>` : ''}
      </td>
      <td style="font-size:12px">${u.id === currentUserId
        ? (u.role === 'admin' ? '<span class="text-orange">' + t('แอดมิน') + '</span>' : t('พนักงาน'))   // สิทธิ์ตัวเองเปลี่ยนไม่ได้ กันล็อกตัวเองออก
        : `<select onchange="changeUserRole(${jsArg(u.id)}, this)" style="width:auto;padding:4px 8px;font-size:12px${u.role === 'admin' ? ';color:var(--orange)' : ''}">
             <option value="staff"${u.role === 'staff' ? ' selected' : ''}>${t('พนักงาน')}</option>
             <option value="admin"${u.role === 'admin' ? ' selected' : ''}>${t('แอดมิน')}</option>
           </select>`}</td>
      <td style="text-align:center"><button class="btn btn-ghost btn-sm" onclick="openAdminResetPassword(${jsArg(u.id)})">🔑 ${t('ตั้งรหัสใหม่')}</button></td>
    </tr>`).join('');
}

function openAdminResetPassword(id) {
  const u = userList.find(x => x.id === id);
  if (!u) return;
  resetPwTarget = { id: u.id, username: u.username };
  document.getElementById('rpw-user').textContent = u.username;
  document.getElementById('rpw-new').value = '';
  document.getElementById('rpw-new').disabled = false;
  document.getElementById('rpw-msg').textContent = '';
  document.getElementById('rpw-save').style.display = '';
  document.getElementById('rpw-close').textContent = t('ยกเลิก');
  document.getElementById('reset-pw-modal').classList.add('open');
  setTimeout(() => document.getElementById('rpw-new').focus(), 50);
}

// error ที่เจอได้ทุกคำสั่ง — คืน null ถ้าเป็น error อื่น (ข้อความไทยจากฐานข้อมูลเอง ใช้ error.message ได้เลย)
function userAdminRpcError(error) {
  if (error.code === 'PGRST202') return 'ยังไม่ได้รัน sql/add-user-management.sql ใน Supabase';   // หาฟังก์ชันไม่เจอ
  if (error.code === '42501') return `เฉพาะ ${USER_ADMIN_OWNER} เท่านั้นที่ทำรายการนี้ได้`;
  return null;
}

// ตัดตัวที่อ่านสับสนออก (0/o, 1/l/i) เพราะแอดมินต้องบอกรหัสนี้ให้พนักงานด้วยปากหรือแชต
function fillRandomPassword(inputId) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  document.getElementById(inputId).value = [...buf].map(n => chars[n % chars.length]).join('');
}

async function doAdminResetPassword() {
  if (!resetPwTarget) return;
  const pw = document.getElementById('rpw-new').value.trim();
  const fail = msg => inlineMsg('rpw-msg', msg, false);
  if (pw.length < 6) return fail('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว');

  const btn = document.getElementById('rpw-save');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';
  try {
    const { error } = await supaClient.rpc('admin_set_password', { target_user: resetPwTarget.id, new_password: pw });
    if (error) {
      const known = userAdminRpcError(error);
      if (known) return fail(known);
      throw error;
    }
    // ค้างหน้าต่างไว้พร้อมรหัสใหม่ ให้แอดมินจดไปบอกได้ — toast หายเองใน 3 วินาที เร็วเกินไป
    document.getElementById('rpw-new').disabled = true;
    document.getElementById('rpw-save').style.display = 'none';
    document.getElementById('rpw-close').textContent = t('ปิด');   // "ยกเลิก" ชวนเข้าใจผิดว่ายกเลิกการตั้งรหัส
    const msg = document.getElementById('rpw-msg');
    msg.style.color = 'var(--green)';
    msg.textContent = `✓ ${t('ตั้งรหัสใหม่ให้')} ${resetPwTarget.username} ${t('แล้ว — บอกรหัสด้านบนให้เขา')}`;
    toast(`ตั้งรหัสใหม่ให้ ${resetPwTarget.username} แล้ว`, 'success');
  } catch (err) {
    console.error(err);
    fail('ตั้งรหัสใหม่ไม่สำเร็จ: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = t('ตั้งรหัสใหม่');
  }
}

// ── เปลี่ยนสิทธิ์ แอดมิน ↔ พนักงาน ──
async function changeUserRole(id, sel) {
  const u = userList.find(x => x.id === id);
  if (!u) return;
  const newRole = sel.value;
  const label = r => r === 'admin' ? 'แอดมิน' : 'พนักงาน';
  if (newRole === u.role) return;
  if (!confirm(`เปลี่ยนสิทธิ์ของ ${u.username} จาก ${label(u.role)} เป็น ${label(newRole)}?`)) { sel.value = u.role; return; }

  sel.disabled = true;
  try {
    const { error } = await supaClient.rpc('admin_set_role', { target_user: id, new_role: newRole });
    if (error) throw new Error(userAdminRpcError(error) || error.message);
    u.role = newRole;
    toast(`เปลี่ยน ${u.username} เป็น${label(newRole)}แล้ว`, 'success');
  } catch (err) {
    console.error(err);
    toast('เปลี่ยนสิทธิ์ไม่สำเร็จ: ' + err.message, 'error');
  }
  renderUserList();   // สำเร็จ = สีตามสิทธิ์ใหม่, ไม่สำเร็จ = กลับเป็นค่าเดิม
}

// ── เพิ่มผู้ใช้ใหม่ ──
// กติกาชื่อต้องตรงกับ admin_create_user() ในฐานข้อมูล — ล็อกอินแปลงชื่อเป็นตัวเล็กเสมอ (usernameToEmail)
const USERNAME_RULE = /^[a-z0-9._-]{1,30}$/;

function openCreateUser() {
  ['cu-name', 'cu-pass', 'cu-position'].forEach(id => {
    const el = document.getElementById(id);
    el.value = ''; el.disabled = false;
  });
  const role = document.getElementById('cu-role');
  role.value = 'staff'; role.disabled = false;
  document.getElementById('cu-msg').textContent = '';
  document.getElementById('cu-save').style.display = '';
  document.getElementById('cu-close').textContent = t('ยกเลิก');
  document.getElementById('create-user-modal').classList.add('open');
  setTimeout(() => document.getElementById('cu-name').focus(), 50);
}

async function doCreateUser() {
  const nameEl = document.getElementById('cu-name');
  const name = nameEl.value.trim().toLowerCase();
  const pw = document.getElementById('cu-pass').value.trim();
  const position = document.getElementById('cu-position').value.trim();
  const role = document.getElementById('cu-role').value;
  const fail = msg => inlineMsg('cu-msg', msg, false);

  if (!name) return fail('กรุณากรอกชื่อผู้ใช้');
  if (!USERNAME_RULE.test(name)) return fail('ชื่อผู้ใช้ใช้ได้แค่ a-z 0-9 . _ - (ไม่เกิน 30 ตัว ไม่มีช่องว่าง)');
  if (userList.some(u => u.username.toLowerCase() === name)) return fail(`ชื่อผู้ใช้ ${name} มีอยู่แล้ว`);
  if (pw.length < 6) return fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');

  const btn = document.getElementById('cu-save');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังบันทึก...';
  try {
    const { data: newId, error } = await supaClient.rpc('admin_create_user',
      { new_username: name, new_password: pw, new_role: role, new_position: position || null });
    if (error) {
      const known = userAdminRpcError(error);
      return fail(known || error.message);   // ชื่อซ้ำ/ชื่อผิดกติกา — ฐานข้อมูลตอบเป็นภาษาไทยมาแล้ว
    }
    // ค้างหน้าต่างไว้พร้อมชื่อ+รหัส ให้จดไปบอกเจ้าของบัญชี
    nameEl.value = name;
    ['cu-name', 'cu-pass', 'cu-position', 'cu-role'].forEach(id => { document.getElementById(id).disabled = true; });
    btn.style.display = 'none';
    document.getElementById('cu-close').textContent = t('ปิด');
    const msg = document.getElementById('cu-msg');
    msg.style.color = 'var(--green)';
    msg.textContent = `✓ ${t('เพิ่มผู้ใช้')} ${name} ${t('แล้ว — เข้าระบบด้วยชื่อและรหัสด้านบน')}`;
    toast(`เพิ่มผู้ใช้ ${name} แล้ว`, 'success');
    if (newId) userNames[newId] = name;   // ให้ชื่อขึ้นในเอกสารที่เขาสร้าง โดยไม่ต้องรีโหลด
    loadUserList();
  } catch (err) {
    console.error(err);
    fail('เพิ่มผู้ใช้ไม่สำเร็จ: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = t('เพิ่มผู้ใช้');
  }
}
