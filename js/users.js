// ══════════════════════════════════════════════════════════════
//  จัดการผู้ใช้ (เฉพาะแอดมิน) — ตอนนี้มีแค่ตั้งรหัสใหม่ให้คนที่ลืมรหัส
//  บัญชีเป็น @stockhq.local รับอีเมลรีเซ็ตไม่ได้ เลยให้แอดมินตั้งให้แทน
//  การแก้รหัสจริงทำในฐานข้อมูลผ่าน admin_set_password() (sql/add-admin-reset-password.sql)
//  ซึ่งเช็คซ้ำอีกชั้นว่าคนกดเป็นแอดมิน — ซ่อนเมนูอย่างเดียวกันไม่ได้
// ══════════════════════════════════════════════════════════════
let userList = [];
let resetPwTarget = null;   // { id, username }

async function loadUserList() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = `<tr><td colspan="4" class="tbl-empty">${t('กำลังโหลด...')}</td></tr>`;
  let res = await supaClient.from('users').select('id, username, role, position');
  if (res.error) res = await supaClient.from('users').select('id, username, role');   // ยังไม่มีคอลัมน์ position
  if (res.error) {
    tbody.innerHTML = `<tr><td colspan="4" class="tbl-empty">${t('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')}: ${escapeHtml(res.error.message)}</td></tr>`;
    return;
  }
  userList = (res.data || []).sort((a, b) => a.username.localeCompare(b.username));
  renderUserList();
}

function renderUserList() {
  const q = (document.getElementById('users-q')?.value || '').trim().toLowerCase();
  const data = userList.filter(u => !q || u.username.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q));
  const tbody = document.getElementById('users-tbody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" class="tbl-empty">${t('ไม่พบผู้ใช้')}</td></tr>`; return; }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td style="color:var(--t1);font-weight:600">${escapeHtml(u.username)}${u.id === currentUserId ? ` <span style="font-size:11px;color:var(--t3);font-weight:400">(${t('คุณ')})</span>` : ''}</td>
      <td style="font-size:12px">${escapeHtml(u.position) || '—'}</td>
      <td style="font-size:12px">${u.role === 'admin' ? '<span class="text-orange">' + t('แอดมิน') + '</span>' : t('พนักงาน')}</td>
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

// ตัดตัวที่อ่านสับสนออก (0/o, 1/l/i) เพราะแอดมินต้องบอกรหัสนี้ให้พนักงานด้วยปากหรือแชต
function fillRandomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  document.getElementById('rpw-new').value = [...buf].map(n => chars[n % chars.length]).join('');
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
      // PGRST202 = หาฟังก์ชันไม่เจอ → ยังไม่ได้รัน SQL
      if (error.code === 'PGRST202') return fail('ยังไม่ได้รัน sql/add-admin-reset-password.sql ใน Supabase');
      if (error.code === '42501') return fail('เฉพาะแอดมินเท่านั้นที่ตั้งรหัสให้คนอื่นได้');
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
