// ══════════════════════════════════════════════════════════════
//  PART HISTORY — ประวัติรับเข้า/เบิกใช้ของอะไหล่ทุกตัวรวมกัน
//  โมดัลในหน้าอะไหล่ดูได้ทีละตัว หน้านี้ไว้ตอบว่า "เดือนนี้เบิกอะไรไปบ้าง ใครเบิก"
// ══════════════════════════════════════════════════════════════
function pmVal(id) { return document.getElementById(id)?.value || ''; }

// ตัวเลือกในดรอปดาวน์สร้างจากข้อมูลจริง — เก็บค่าที่เลือกไว้ถ้ายังมีอยู่
function fillPmSelect(id, opts, blank) {
  const sel = document.getElementById(id); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">${blank}</option>`
    + opts.map(o => `<option value="${escapeHtml(o.v)}">${escapeHtml(o.t)}</option>`).join('');
  sel.value = opts.some(o => String(o.v) === cur) ? cur : '';
}

function filteredPartMoves() {
  const q    = pmVal('pm-q').trim().toLowerCase();
  const typ  = pmVal('pm-type');
  const pid  = pmVal('pm-part');
  const uid  = pmVal('pm-user');
  const from = pmVal('pm-from');
  const to   = pmVal('pm-to');

  return partMoves.filter(m => {
    if (pid && m.part_id !== pid) return false;
    if (uid && m.performed_by !== uid) return false;
    if (typ === 'in'  && !(m.qty > 0)) return false;
    if (typ === 'out' && !(m.qty < 0)) return false;
    // move_date เป็น yyyy-mm-dd เทียบเป็นข้อความตรงๆ ได้เลย
    if (from && (m.move_date || '') < from) return false;
    if (to   && (m.move_date || '') > to)   return false;
    if (q) {
      const p = partById(m.part_id) || {};
      const hay = `${p.name || ''} ${p.code || ''} ${p.category || ''} ${m.note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPartHistory() {
  const wrap = document.getElementById('pm-wrap');
  if (!wrap) return;
  ['pm-toolbar', 'pm-kpis', 'pm-actions'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = partsTableMissing ? 'none' : '';
  });
  if (partsTableMissing) {
    wrap.innerHTML = partsSetupNotice();
    document.getElementById('pm-note').textContent = '';
    return;
  }

  fillPmSelect('pm-part', [...parts].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))
    .map(p => ({ v: p.id, t: p.name })), '— ทุกอะไหล่ —');
  fillPmSelect('pm-user', [...new Set(partMoves.map(m => m.performed_by).filter(Boolean))]
    .map(u => ({ v: u, t: userName(u) })).sort((a, b) => a.t.localeCompare(b.t, 'th')), '— ทุกคน —');

  const data = filteredPartMoves();
  setPartText('pm-count', data.length);
  setPartText('pm-in',  data.filter(m => m.qty > 0).reduce((s, m) => s + m.qty, 0));
  setPartText('pm-out', data.filter(m => m.qty < 0).reduce((s, m) => s - m.qty, 0));
  updatePartMoveMoreBtn();

  document.getElementById('pm-note').textContent = partMovesAllLoaded
    ? `โหลดประวัติมาครบทุกรายการแล้ว (${partMoves.length} รายการ)`
    : `โหลดมา ${partMoves.length} รายการล่าสุด — ของเก่ากว่านี้กด "โหลดประวัติเก่าเพิ่ม"`;

  if (!data.length) {
    wrap.innerHTML = `<div class="card"><div class="card-body"><div class="tbl-empty" style="padding:28px">${
      partMoves.length ? 'ไม่พบรายการตามที่กรอง' : 'ยังไม่มีประวัติรับเข้า/เบิกใช้'}</div></div></div>`;
    return;
  }

  wrap.innerHTML = `<div class="card"><div class="tbl-wrap" style="max-height:calc(100vh - 330px);overflow-y:auto">
    <table>
      <thead><tr>
        <th>วันที่</th><th>อะไหล่</th><th>ประเภท</th>
        <th style="text-align:center">จำนวน</th><th style="text-align:center">คงเหลือหลังทำ</th>
        <th>หมายเหตุ / เบิกไปทำอะไร</th><th>ผู้ทำรายการ</th>
      </tr></thead>
      <tbody>${data.map(m => partMoveRow(m)).join('')}</tbody>
    </table></div></div>`;
}

function partMoveRow(m) {
  const p = partById(m.part_id);
  return `<tr>
    <td class="mono" style="font-size:11px;white-space:nowrap">${escapeHtml(fmtDate(m.move_date))}
      <div style="color:var(--t3);font-size:10px">${m.created_at ? new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</div></td>
    <td style="color:var(--t1)">${p ? escapeHtml(p.name) : '<span style="color:var(--t3)">(ลบไปแล้ว)</span>'}
      ${p && p.code ? `<div class="mono" style="font-size:10px;color:var(--t3)">${escapeHtml(p.code)}</div>` : ''}</td>
    <td><span class="badge ${m.qty > 0 ? 'b-green' : 'b-orange'}">${m.qty > 0 ? '➕ รับเข้า' : '➖ เบิกใช้'}</span></td>
    <td style="text-align:center;font-family:var(--mono);font-weight:700;color:${m.qty > 0 ? 'var(--green)' : 'var(--orange)'}">${m.qty > 0 ? '+' : ''}${m.qty}
      <span style="font-size:10px;color:var(--t3);font-weight:400"> ${escapeHtml(p ? p.unit : '')}</span></td>
    <td style="text-align:center;font-family:var(--mono)">${m.balance}</td>
    <td style="font-size:11px;color:var(--t2)">${escapeHtml(m.note) || '—'}</td>
    <td style="font-size:11px;color:var(--t3)">${escapeHtml(userName(m.performed_by))}</td>
  </tr>`;
}

function resetPartHistoryFilters() {
  ['pm-q', 'pm-from', 'pm-to', 'pm-type', 'pm-part', 'pm-user']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderPartHistory();
}

// โหลดประวัติเก่าเพิ่มทีละหน้า — ตอนล็อกอินดึงมาแค่ชุดแรกให้เข้าระบบไว
async function loadMorePartMoves() {
  if (partMovesAllLoaded) return;
  const btn = document.getElementById('pm-more-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังโหลด...'; }
  try {
    const { data, error } = await supaClient.from('part_moves')
      .select('*').order('created_at', { ascending: false })
      .range(partMoves.length, partMoves.length + PART_MOVE_PAGE - 1);
    if (error) throw error;
    // ระหว่างนี้อาจมีรายการใหม่แทรกเข้ามาจนหน้าต่างเลื่อน — กันซ้ำด้วย id
    const seen = new Set(partMoves.map(m => m.id));
    const rows = (data || []).filter(m => !seen.has(m.id));
    partMoves.push(...rows);
    if (!data || data.length < PART_MOVE_PAGE) partMovesAllLoaded = true;
    renderPartHistory();
    toast(rows.length ? `โหลดเพิ่ม ${rows.length} รายการ (รวม ${partMoves.length})` : 'ครบทุกรายการแล้ว', 'success');
  } catch (err) {
    toast('โหลดประวัติเพิ่มล้มเหลว: ' + err.message, 'error');
  } finally { updatePartMoveMoreBtn(); }
}

function updatePartMoveMoreBtn() {
  const btn = document.getElementById('pm-more-btn');
  if (!btn) return;
  btn.disabled = partMovesAllLoaded;
  btn.style.display = partMovesAllLoaded ? 'none' : 'inline-flex';
  btn.textContent = '⬇ โหลดประวัติเก่าเพิ่ม';
}

function exportPartMovesCSV() {
  const data = filteredPartMoves();
  if (!data.length) return toast('ไม่มีรายการให้ export (ตามที่กรองอยู่)', 'info');
  const rows = data.map(m => {
    const p = partById(m.part_id) || {};
    return {
      date: m.move_date || '', part: p.name || '(ลบไปแล้ว)', code: p.code || '', category: p.category || '',
      type: m.qty > 0 ? 'รับเข้า' : 'เบิกใช้', qty: m.qty, unit: p.unit || '',
      balance: m.balance, note: m.note || '', user: userName(m.performed_by),
    };
  });
  dlCSV(toCSV(rows, ['date', 'part', 'code', 'category', 'type', 'qty', 'unit', 'balance', 'note', 'user']), 'part_moves_export.csv');
  toast(`Export ${rows.length} รายการ (ตามที่กรองอยู่)`, 'success');
}
