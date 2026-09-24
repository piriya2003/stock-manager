// ══════════════════════════════════════════════════════════════
//  SCAN TEST — หน้า "ทดสอบสแกน" ลองสแกนได้โดยไม่บันทึกอะไรลงระบบ
//
//  ไว้ตอบคำถามว่า "กล้อง/เครื่องยิงของฉันอ่านป้ายพวกนี้ได้ไหม" ก่อนไปใช้งานจริง:
//   - กล้อง: เปิดหน้าจอสแกนเดิม (js/camera-scan.js) ในโหมดทดสอบ อ่านแล้วแค่โชว์ผล
//   - เครื่องยิงบาร์โค้ด/พิมพ์เอง: ยิงลงช่องทดสอบ ดูว่าตัวอักษรที่ส่งมาหน้าตาเป็นยังไง
//     (ภาษาไทยหลุด, ส่ง Tab/Enter ท้ายรหัส, ความเร็วพิมพ์) — สาเหตุที่ทำให้สแกนแล้วบันทึกผิดบ่อยสุด
//  ทุกอย่างอ่านอย่างเดียว ไม่เขียนลงฐานข้อมูลเลย
// ══════════════════════════════════════════════════════════════
let scanTestLog = [];         // ผลล่าสุดอยู่หน้าสุด
let stKeyTimes = [];          // เวลากดแต่ละปุ่มในช่องทดสอบ ใช้ประเมินว่าเครื่องยิงหรือมือพิมพ์
let stTerminator = '';        // ปุ่มที่ปิดท้ายรหัส (Enter / Tab)
const ST_MAX_LOG = 60;

// ทำให้อักขระที่มองไม่เห็นมองเห็นได้ — เครื่องยิงบางรุ่นแอบส่ง Tab/ขึ้นบรรทัดติดมา
function stVisible(s) {
  return String(s ?? '').replace(/\r/g, '␍').replace(/\n/g, '␊').replace(/\t/g, '␉').replace(/ /g, '·');
}

// วิเคราะห์ข้อความที่อ่านได้ 1 ชิ้น — คืนสิ่งที่ตรวจเจอ ไม่แก้ไม่บันทึกอะไร
function analyzeScan(raw) {
  const s = String(raw ?? '');
  const trimmed = s.trim();
  const code = trimmed.replace(/^\*+|\*+$/g, '');
  const notes = [];
  let bad = false;
  if (s !== trimmed) notes.push('มีช่องว่าง/ขึ้นบรรทัดติดหัวท้าย — ระบบตัดออกให้');
  if (/^\*|\*$/.test(trimmed)) notes.push('มีดาว * ครอบ (Code 39) — ระบบตัดออกให้');
  if (/[\r\n\t]/.test(trimmed)) { notes.push('⚠️ มีอักขระควบคุมแฝงอยู่กลางรหัส'); bad = true; }
  if (/[฀-๿]/.test(code)) { notes.push('⚠️ เป็นภาษาไทย — คีย์บอร์ดเครื่องตั้งเป็นไทยอยู่ เปลี่ยนเป็น EN แล้วสแกนใหม่'); bad = true; }
  if (code.length === 12 && code.startsWith('567')) { notes.push('⚠️ นี่คือรหัส SKU ไม่ใช่ Serial — สแกนบาร์โค้ดอีกอันด้านล่างป้าย'); bad = true; }
  if (!code) { notes.push('⚠️ อ่านได้ค่าว่าง'); bad = true; }
  const item = code ? stock.find(i => String(i.sn) === code) || null : null;
  return { raw: s, code, len: code.length, item, notes, bad };
}

// บันทึกผลลงหน้าทดสอบ — กล้องกับช่องเครื่องยิงเรียกร่วมกัน
function recordScanTest(source, raw, extra) {
  const a = analyzeScan(raw);
  const rec = Object.assign(a, { at: new Date(), source }, extra || {});
  scanTestLog.unshift(rec);
  if (scanTestLog.length > ST_MAX_LOG) scanTestLog.length = ST_MAX_LOG;
  renderScanTest();
  return rec;
}

// บรรทัดสรุปสั้นๆ ที่โชว์ในหน้าจอกล้อง
function scanTestSummary(rec) {
  const where = rec.item ? `${t('พบในระบบ')}: ${rec.item.name} · ${statusText(rec.item.status)}` : t('ไม่พบในระบบ');
  const gap = rec.gapMs != null ? ` · ${(rec.gapMs / 1000).toFixed(1)}s` : '';
  return rec.bad ? rec.notes.filter(n => n.startsWith('⚠️')).join(' ') : where + gap;
}

function renderScanTest() {
  const tb = document.getElementById('st-log');
  if (!tb) return;
  const n = scanTestLog.length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('st-count', n);
  set('st-found', scanTestLog.filter(r => r.item).length);
  set('st-warn', scanTestLog.filter(r => r.bad).length);
  tb.innerHTML = n ? scanTestLog.map(r => `<tr>
      <td class="mono" style="font-size:11px;white-space:nowrap">${r.at.toLocaleTimeString('th-TH', { hour12: false })}</td>
      <td><span class="badge ${r.source === 'กล้อง' ? 'b-blue' : 'b-cyan'}">${escapeHtml(r.source)}</span></td>
      <td class="mono" style="font-weight:600;overflow-wrap:anywhere;min-width:170px">${escapeHtml(stVisible(r.raw))}</td>
      <td style="text-align:center" class="mono">${r.len}</td>
      <td>${r.item ? `<span class="badge b-green">${t('พบ')}</span> ${escapeHtml(r.item.name)}` : `<span class="badge b-gray">${t('ไม่พบ')}</span>`}</td>
      <td style="font-size:11px;color:${r.bad ? 'var(--red)' : 'var(--t2)'};line-height:1.5">${r.notes.map(x => escapeHtml(x)).join('<br>') || '—'}${
        r.gapMs != null ? `<div style="color:var(--t3)">${t('ใช้เวลา')} ${(r.gapMs / 1000).toFixed(1)} ${t('วินาที')}</div>` : ''}${
        r.speed ? `<div style="color:var(--t3)">${escapeHtml(r.speed)}</div>` : ''}</td>
    </tr>`).join('')
    : `<tr><td colspan="6" class="tbl-empty">${t('ยังไม่มีผล — กดเปิดกล้อง หรือยิงบาร์โค้ดลงช่องด้านบน')}</td></tr>`;
}

function clearScanTest() {
  scanTestLog = [];
  renderScanTest();
}

// ── ช่องรับจากเครื่องยิง / พิมพ์เอง ──
function scanTestKey(e) {
  const inp = e.target;
  const now = performance.now();
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();          // Tab ต้องกันไว้ ไม่งั้นโฟกัสหลุดไปที่อื่นแล้วเห็นแค่ว่า "สแกนแล้วเงียบ"
    const value = inp.value;
    if (!value) { stKeyTimes = []; return; }
    // เครื่องยิงส่งทั้งรหัสภายในเสี้ยววินาที คนพิมพ์ห่างกันหลายสิบ-ร้อยมิลลิวินาที
    const gaps = stKeyTimes.slice(1).map((t0, i) => t0 - stKeyTimes[i]);
    const avg = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
    let speed = '';
    if (avg != null) speed = avg < 50 ? `⌨️ ส่งเร็ว (เฉลี่ย ${avg.toFixed(0)} ms/ตัว) — พฤติกรรมของเครื่องยิง` : `⌨️ พิมพ์ช้า (เฉลี่ย ${avg.toFixed(0)} ms/ตัว) — เหมือนพิมพ์มือ ไม่ใช่เครื่องยิง`;
    const rec = recordScanTest(avg != null && avg < 50 ? 'เครื่องยิง' : 'พิมพ์มือ', value, {
      speed: speed + (e.key === 'Tab' ? ' · ปิดท้ายด้วย Tab' : ''),
    });
    if (e.key === 'Tab') rec.notes.unshift('เครื่องนี้ส่ง Tab ปิดท้ายรหัส — ในหน้าจริงโฟกัสอาจหลุดช่อง ควรตั้งเครื่องยิงให้ส่ง Enter แทน');
    stTerminator = e.key;
    inp.value = ''; stKeyTimes = [];
    renderScanTest();
    return;
  }
  stKeyTimes.push(now);
}

function openScanTestCamera() {
  return openCameraScan(CAM_TEST);
}
