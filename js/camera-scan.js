// ══════════════════════════════════════════════════════════════
//  CAMERA SCAN — สแกนบาร์โค้ดด้วยกล้อง (มือถือ / เว็บแคม) แทนเครื่องยิงบาร์โค้ด
//
//  ทุกช่องสแกนมีปุ่ม "📷 สแกนด้วยกล้อง" ต่อท้าย กดแล้วเปิดกล้องเต็มจอ ยิงต่อเนื่องได้หลายชิ้น
//  โดยไม่ต้องพิมพ์ ไม่ต้องกด Enter — ผลของแต่ละชิ้นขึ้นในจอสแกนเลย
//
//  โหมดของแต่ละช่อง (ดู CAM_FIELDS):
//   submit — ช่องสแกนทีละชิ้น: ใส่ค่าลงช่องแล้วเรียกฟังก์ชันบันทึกตัวเดียวกับตอนกด Enter
//   append — ช่องวางรายการ SN หลายตัว: ต่อท้ายทีละบรรทัด ตัวซ้ำข้าม
//   fill   — ช่องที่ต้องกรอกอย่างอื่นต่อ (เช่น อาการเสีย): ใส่ค่าแล้วปิดกล้อง
//
//  ไลบรารีอ่านบาร์โค้ด (html5-qrcode, ~370KB) โหลดตอนกดปุ่มครั้งแรกเท่านั้น
//  ไม่ถ่วงหน้าเว็บของคนที่ใช้เครื่องยิงอยู่แล้ว
// ══════════════════════════════════════════════════════════════
const CAM_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';

const CAM_FIELDS = [
  { id: 'i-sn',        mode: 'submit', action: () => doInbound(),   msg: 'i-msg', title: 'รับเข้า — สแกน SN' },
  { id: 'i-bulk',      mode: 'append', title: 'รับเข้าหลายชิ้น — สแกน SN ต่อเนื่อง' },
  { id: 'o-sn',        mode: 'submit', action: () => doOutbound(),  msg: 'o-msg', title: 'โอน / ขาย — สแกน SN' },
  { id: 'o-bulk',      mode: 'append', title: 'โอน / ขายหลายชิ้น — สแกน SN ต่อเนื่อง' },
  { id: 'do-sn-list',  mode: 'append', title: 'สร้าง DO จากรายการ SN' },
  { id: 'dov-add-sn',  mode: 'append', title: 'เพิ่ม SN เข้าใบ DO' },
  { id: 'r-sn',        mode: 'fill',   title: 'รับซ่อม — สแกน SN' },
  { id: 'swap-new-sn', mode: 'fill',   title: 'สแกน SN เครื่องใหม่' },
];

// โหมดทดสอบ (หน้า "ทดสอบสแกน") — ไม่มีช่องปลายทาง อ่านแล้วแค่โชว์ผล ไม่บันทึกอะไร
const CAM_TEST = { id: null, mode: 'test', title: 'ทดสอบสแกน — ไม่บันทึกอะไรลงระบบ' };

let camLibPromise = null;   // สัญญาโหลดไลบรารี (โหลดครั้งเดียว)
let camScanner = null;      // ตัวสแกนที่กำลังเปิดอยู่ (null = ปิด)
let camCfg = null;          // ช่องที่กำลังสแกนให้
let camBusy = false;        // กำลังบันทึกชิ้นก่อนหน้า — ชิ้นใหม่ที่อ่านได้ระหว่างนี้ข้ามไปก่อน
let camLast = { code: '', at: 0 };
let camMark = 0;            // เวลาที่เปิดกล้อง/อ่านชิ้นล่าสุด — โหมดทดสอบใช้วัดว่าอ่านได้ช้าแค่ไหน
let camCount = 0;
let camFeed = [];
let camAudio = null;
let camTorchOn = false;

function loadCamLib() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (!camLibPromise) {
    camLibPromise = new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = CAM_LIB_URL;
      s.onload = () => (window.Html5Qrcode ? ok() : bad(new Error('ไลบรารีโหลดแล้วแต่ใช้ไม่ได้')));
      s.onerror = () => bad(new Error('โหลดไลบรารีไม่ได้'));
      document.head.appendChild(s);
    }).catch(err => { camLibPromise = null; throw err; });   // ล้มเหลวแล้วกดใหม่ต้องลองโหลดใหม่ได้
  }
  return camLibPromise;
}

// ── ปุ่มข้างช่องสแกน ──
function injectCameraButtons() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;   // เบราว์เซอร์/ที่อยู่เว็บนี้เปิดกล้องไม่ได้
  CAM_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el || el.dataset.camBtn) return;
    el.dataset.camBtn = '1';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm cam-btn';
    b.textContent = t('📷 สแกนด้วยกล้อง');
    b.addEventListener('click', () => openCameraScan(f.id));
    el.insertAdjacentElement('afterend', b);
  });
}

// ── หน้าจอสแกน ──
function buildCamOverlay() {
  let o = document.getElementById('cam-scan');
  if (o) return o;
  o = document.createElement('div');
  o.id = 'cam-scan';
  o.innerHTML = `
    <div class="cam-top">
      <div id="cam-title" class="cam-title"></div>
      <button type="button" id="cam-close-x" class="cam-x" aria-label="ปิด">✕</button>
    </div>
    <div id="cam-reader"></div>
    <div id="cam-status" class="cam-status"></div>
    <div id="cam-feed" class="cam-feed"></div>
    <div class="cam-bottom">
      <button type="button" id="cam-torch" class="cam-torch" style="display:none">🔦 ไฟฉาย</button>
      <span id="cam-count" class="cam-count"></span>
      <button type="button" id="cam-done" class="cam-done">✓ เสร็จสิ้น</button>
    </div>`;
  document.body.appendChild(o);
  o.querySelector('#cam-close-x').addEventListener('click', closeCameraScan);
  o.querySelector('#cam-done').addEventListener('click', closeCameraScan);
  o.querySelector('#cam-torch').addEventListener('click', toggleCamTorch);
  return o;
}

function setCamStatus(text, isErr) {
  const el = document.getElementById('cam-status'); if (!el) return;
  el.textContent = text;
  el.classList.toggle('err', !!isErr);
}

function renderCamFeed() {
  const el = document.getElementById('cam-feed'); if (!el) return;
  el.innerHTML = camFeed.slice(0, 5).map(f =>
    `<div class="cam-row ${f.ok ? 'ok' : 'no'}"><span class="mono">${escapeHtml(f.code)}</span><span>${escapeHtml(f.text)}</span></div>`).join('');
  const c = document.getElementById('cam-count');
  if (c) c.textContent = camCount ? `${t('สำเร็จ')} ${camCount}` : '';
}

function camBeep(ok) {
  try {
    if (camAudio) {
      if (camAudio.state === 'suspended') camAudio.resume();
      const o = camAudio.createOscillator(), g = camAudio.createGain();
      o.frequency.value = ok ? 1200 : 320; g.gain.value = 0.08;
      o.connect(g); g.connect(camAudio.destination);
      o.start(); o.stop(camAudio.currentTime + (ok ? 0.09 : 0.25));
    }
  } catch (e) { /* ไม่มีเสียงก็ยังใช้ได้ */ }
  try { if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 60, 80]); } catch (e) {}
}

function camErrorText(err) {
  const n = err && (err.name || '');
  const m = String((err && err.message) || err || '');
  if (n === 'NotAllowedError' || /permission|denied|not allowed/i.test(m))
    return 'ไม่ได้อนุญาตให้ใช้กล้อง — กดไอคอนกุญแจ/กล้องข้างช่องที่อยู่เว็บ แล้วเลือก "อนุญาต" จากนั้นกดสแกนใหม่';
  if (n === 'NotFoundError' || /no camera|not found|requested device/i.test(m))
    return 'ไม่พบกล้องในเครื่องนี้';
  if (n === 'NotReadableError' || /in use|could not start/i.test(m))
    return 'เปิดกล้องไม่ได้ — อาจมีแอปอื่นใช้กล้องอยู่ ปิดแอปนั้นแล้วลองใหม่';
  if (/โหลด/.test(m)) return 'โหลดตัวสแกนไม่ได้ — ตรวจอินเทอร์เน็ตแล้วกดสแกนใหม่';
  return 'เปิดกล้องไม่สำเร็จ: ' + m;
}

async function openCameraScan(fieldOrCfg) {
  const cfg = typeof fieldOrCfg === 'string' ? CAM_FIELDS.find(f => f.id === fieldOrCfg) : fieldOrCfg;
  if (!cfg || camScanner || camCfg) return;   // เปิดซ้อนไม่ได้
  camCfg = cfg; camCount = 0; camFeed = []; camLast = { code: '', at: 0 }; camBusy = false; camTorchOn = false; camMark = Date.now();

  const o = buildCamOverlay();
  document.getElementById('cam-title').textContent = t(cfg.title);
  document.getElementById('cam-torch').style.display = 'none';
  renderCamFeed();
  setCamStatus(t('กำลังเปิดกล้อง...'));
  o.classList.add('open');
  document.body.classList.add('cam-open');

  // ฟังก์ชันบันทึกหลายตัวเรียก .focus() ที่ช่องหลังบันทึกเสร็จ — บนมือถือจะเด้งคีย์บอร์ดบังกล้อง
  // inputmode="none" ห้ามคีย์บอร์ดขึ้นระหว่างเปิดกล้อง
  const el = cfg.id ? document.getElementById(cfg.id) : null;
  cfg.prevInputmode = el ? el.getAttribute('inputmode') : null;
  if (el) el.setAttribute('inputmode', 'none');

  // ต้องสร้างตอนผู้ใช้กดปุ่ม ไม่งั้นเบราว์เซอร์ไม่ยอมให้ส่งเสียง
  try { const C = window.AudioContext || window.webkitAudioContext; if (C && !camAudio) camAudio = new C(); } catch (e) {}

  try {
    await loadCamLib();
    const F = window.Html5QrcodeSupportedFormats || {};
    const formats = ['CODE_128', 'CODE_39', 'CODE_93', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'CODABAR', 'QR_CODE', 'DATA_MATRIX']
      .map(k => F[k]).filter(v => v !== undefined);
    const scanner = new window.Html5Qrcode('cam-reader', {
      formatsToSupport: formats.length ? formats : undefined,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },   // ใช้ตัวอ่านของเบราว์เซอร์ถ้ามี — เร็วและแม่นกว่า
      verbose: false,
    });
    camScanner = scanner;
    await scanner.start(
      { facingMode: 'environment' },
      // กรอบกว้างเตี้ย เพราะบาร์โค้ดของ SN เป็นแบบเส้น (ไม่ใช่ QR)
      { fps: 12, qrbox: (w, h) => ({ width: Math.floor(w * 0.92), height: Math.floor(Math.max(90, Math.min(h * 0.45, 180))) }) },
      onCamDecode, () => {});
    // ค่าเริ่มต้นของกล้องเว็บความละเอียดต่ำและไม่โฟกัสต่อเนื่อง บาร์โค้ดเส้นเล็กเลยอ่านยาก — ขอเพิ่ม (ไม่รองรับก็ข้ามได้)
    try { await scanner.applyVideoConstraints({ width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      if (torch.isSupported()) document.getElementById('cam-torch').style.display = '';
    } catch (e) {}
    let info = '';
    if (cfg.mode === 'test') {   // บอกว่าเครื่องนี้ใช้ตัวอ่านแบบไหนและกล้องได้ความละเอียดเท่าไหร่ — ไว้วินิจฉัยเวลาอ่านยาก
      let res = '';
      try { const st = scanner.getRunningTrackSettings(); if (st && st.width) res = ' · ' + t('กล้อง') + ' ' + st.width + '×' + st.height; } catch (e) {}
      info = ' — ' + ('BarcodeDetector' in window ? t('ตัวอ่านของเบราว์เซอร์') : t('ตัวอ่านแบบไลบรารี (ช้ากว่า)')) + res;
    }
    setCamStatus(t('เล็งบาร์โค้ดให้อยู่ในกรอบ — ยิงต่อเนื่องได้เลย') + info);
  } catch (err) {
    console.warn('camera scan:', err);
    try { if (camScanner) await camScanner.clear(); } catch (e) {}
    camScanner = null;
    setCamStatus(camErrorText(err), true);   // ค้างหน้าจอไว้ให้อ่าน แล้วผู้ใช้กดปิดเอง
  }
}

async function toggleCamTorch() {
  try {
    const torch = camScanner.getRunningTrackCameraCapabilities().torchFeature();
    camTorchOn = !camTorchOn;
    await torch.apply(camTorchOn);
    document.getElementById('cam-torch').classList.toggle('on', camTorchOn);
  } catch (e) { camTorchOn = false; }
}

async function closeCameraScan() {
  const cfg = camCfg, scanner = camScanner;
  if (!cfg) return;
  camCfg = null; camScanner = null;   // ตั้งก่อน await กันชิ้นที่อ่านได้ระหว่างปิดถูกบันทึกซ้ำ
  const o = document.getElementById('cam-scan');
  if (o) o.classList.remove('open');
  document.body.classList.remove('cam-open');
  const el = cfg.id ? document.getElementById(cfg.id) : null;
  if (el) { if (cfg.prevInputmode == null) el.removeAttribute('inputmode'); else el.setAttribute('inputmode', cfg.prevInputmode); }
  try { if (scanner) { await scanner.stop(); await scanner.clear(); } } catch (e) { /* หยุดไม่ได้ก็ปล่อย — กล้องปิดเองตอนออกจากหน้า */ }
  camTorchOn = false;
}

// อ่านบาร์โค้ดได้ 1 ชิ้น
async function onCamDecode(raw) {
  const cfg = camCfg;
  if (!cfg || camBusy) return;
  const code = String(raw || '').trim().replace(/^\*+|\*+$/g, '');   // Code 39 มีดาว * ครอบหัวท้าย
  if (!code) return;
  const now = Date.now();
  if (code === camLast.code && now - camLast.at < 3000) return;    // ยิงซ้ำตัวเดิมค้างอยู่หน้ากล้อง
  camLast = { code, at: now };
  camBusy = true;
  const el = cfg.id ? document.getElementById(cfg.id) : null;
  let ok = true, text = '';
  try {
    if (cfg.mode === 'test') {
      // ทดสอบ: ไม่แตะช่องไหนเลย แค่วิเคราะห์แล้วโชว์ (ตัวช่วยอยู่ใน js/scan-test.js)
      const rec = recordScanTest('กล้อง', raw, { gapMs: now - camMark });
      camMark = now;
      ok = !rec.bad; text = scanTestSummary(rec);
      if (ok) camCount++;
    } else if (cfg.mode === 'append') {
      const have = (el.value || '').split(/[\s,]+/).filter(Boolean);
      if (have.includes(code)) { ok = false; text = t('ซ้ำกับที่สแกนไว้แล้ว'); }
      else {
        el.value = (el.value && !/\n$/.test(el.value) ? el.value + '\n' : el.value) + code;
        camCount++; text = `${t('เพิ่มแล้ว')} (${have.length + 1})`;
      }
    } else if (cfg.mode === 'fill') {
      el.value = code;
      el.dispatchEvent(new Event('input', { bubbles: true }));   // ให้ช่องค้นหา/ตรวจ SN ที่ผูกไว้ทำงานต่อ
      camBeep(true);
      camBusy = false;
      await closeCameraScan();
      toast(`${t('ได้ SN')}: ${code}`, 'success');
      return;
    } else {
      el.value = code;
      await cfg.action();   // ตัวเดียวกับตอนกด Enter — กัน SN ซ้ำ/สแกนภาษาไทย/รหัส SKU ทำงานครบเหมือนเดิม
      const m = cfg.msg && document.getElementById(cfg.msg);
      text = m ? m.textContent.trim() : '';
      ok = /^✅/.test(text);
      if (ok) camCount++;
      if (!text) text = '—';
    }
  } catch (err) { ok = false; text = String(err.message || err); }
  camFeed.unshift({ code, ok, text });
  camBeep(ok);
  renderCamFeed();
  camBusy = false;
}

document.addEventListener('DOMContentLoaded', injectCameraButtons);
