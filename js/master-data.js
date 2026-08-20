// ══════════════════════════════════════════════════════════════
//  MASTER DATA
// ══════════════════════════════════════════════════════════════
let editingMasterId = null;   // ไม่ null = ฟอร์มต้นแบบสินค้ากำลังอยู่ในโหมดแก้ไข

async function saveMasterProduct() {
  const cat    = document.getElementById('m-cat').value.trim();
  const subcat = document.getElementById('m-subcat').value.trim();
  const name   = document.getElementById('m-name').value.trim();
  const code   = document.getElementById('m-code').value.trim();
  if (!name) return toast('กรุณาใส่ชื่อสินค้า', 'error');
  try {
    const row = { category: cat || 'ไม่ระบุ', name, code };
    if (subcat) row.subcategory = subcat;
    let data, error;
    if (editingMasterId) {
      ({ data, error } = await supaClient.from('master_products')
        .update({ ...row, subcategory: subcat || null }).eq('id', editingMasterId).select());
      // ยังไม่ได้รันสคริปต์เพิ่ม update policy — RLS จะคืน 200 พร้อม 0 แถวโดยไม่แจ้ง error
      if (!error && (!data || !data.length)) throw new Error('ไม่มีสิทธิ์แก้ไขต้นแบบ — ยังไม่ได้รันสคริปต์ตั้ง update policy ให้ master_products');
      if (!error) data = data[0];
    } else {
      ({ data, error } = await supaClient.from('master_products').insert(row).select().single());
    }
    // ยังไม่ได้รันสคริปต์เพิ่มคอลัมน์ subcategory — บันทึกส่วนที่เหลือไปก่อน ไม่ให้ฟอร์มพังทั้งใบ
    if (error && subcat && /subcategory/i.test(error.message || '')) {
      const plain = { category: cat || 'ไม่ระบุ', name, code };
      if (editingMasterId) {
        ({ data, error } = await supaClient.from('master_products').update(plain).eq('id', editingMasterId).select());
        if (!error) data = data[0];
      } else {
        ({ data, error } = await supaClient.from('master_products').insert(plain).select().single());
      }
      if (!error) toast('บันทึกแล้ว แต่ยังเก็บหมวดหมู่ย่อยไม่ได้ — ต้องรันสคริปต์เพิ่มคอลัมน์ก่อน', 'warning');
    }
    if (error) throw error;

    if (editingMasterId) Object.assign(masterProds.find(p => p.id === editingMasterId), data);
    else masterProds.push(data);
    const wasEditing = editingMasterId;
    cancelEditMasterProduct();
    renderMasterProducts(); updateDataLists();
    toast(wasEditing ? 'แก้ไขต้นแบบสำเร็จ' : 'บันทึกต้นแบบสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

function editMasterProduct(id) {
  const p = masterProds.find(x => x.id === id); if (!p) return;
  editingMasterId = id;
  document.getElementById('m-cat').value    = p.category === 'ไม่ระบุ' ? '' : (p.category || '');
  document.getElementById('m-subcat').value = p.subcategory || '';
  document.getElementById('m-name').value   = p.name || '';
  document.getElementById('m-code').value   = p.code || '';
  document.getElementById('mp-save-btn').textContent = '💾 บันทึกการแก้ไข';
  document.getElementById('mp-cancel-btn').style.display = 'inline-flex';
  document.getElementById('m-subcat').focus();
}

function cancelEditMasterProduct() {
  editingMasterId = null;
  ['m-cat', 'm-subcat', 'm-name', 'm-code'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('mp-save-btn').textContent = '+ บันทึกต้นแบบ';
  document.getElementById('mp-cancel-btn').style.display = 'none';
}

function renderMasterProducts() {
  const el = document.getElementById('master-product-list');
  el.innerHTML = masterProds.length ? masterProds.map((p) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--s2);padding:8px 12px;border-radius:var(--r);font-size:12px">
      <span><span class="badge b-blue" style="font-size:9px;margin-right:6px">${p.category || '—'}</span>${p.subcategory ? `<span class="cat-sub"><span class="cat-sub-arrow">↳</span><span class="badge b-purple" style="font-size:9px">${p.subcategory}</span></span>` : ''}<b style="color:var(--t1)">${p.name}</b> <span class="mono" style="color:var(--t3);font-size:10px">${p.code||''}</span></span>
      <span style="display:flex;gap:2px;flex-shrink:0">
        <button onclick="editMasterProduct('${p.id}')" title="แก้ไขหมวดหมู่/ชื่อ/รหัส" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:13px;padding:0 2px">✏️</button>
        <button onclick="deleteMasterProduct('${p.id}')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:15px;padding:0 2px">✕</button>
      </span>
    </div>`).join('') : '<div style="text-align:center;color:var(--t3);font-size:12px;padding:12px">ยังไม่มีต้นแบบ</div>';
}

async function deleteMasterProduct(id) {
  const p = masterProds.find(x => x.id === id); if (!p) return;
  if (!confirm(`ลบต้นแบบสินค้า "${p.name}"?\n(ไม่กระทบสินค้าในคลัง — ลบแค่ตัวต้นแบบที่ใช้เติมชื่ออัตโนมัติ)`)) return;
  try {
    const { error } = await supaClient.from('master_products').delete().eq('id', id);
    if (error) throw error;
    masterProds = masterProds.filter(p => p.id !== id);
    if (editingMasterId === id) cancelEditMasterProduct();
    renderMasterProducts(); updateDataLists();
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}

let editingCustomerId = null;   // ไม่ null = ฟอร์มลูกค้ากำลังอยู่ในโหมดแก้ไข

async function saveCustomer() {
  const name = document.getElementById('m-cust').value.trim();
  const address = document.getElementById('m-cust-addr').value.trim();
  if (!name) return toast('กรุณาใส่ชื่อลูกค้า', 'error');
  // ที่อยู่ต้องมี เพราะเป็นตัวที่พิมพ์ลงหัวใบ DO — ปล่อยว่างไว้แล้วต้องมานั่งพิมพ์ใหม่ทุกใบ
  if (!address) return toast('กรุณาใส่ที่อยู่ลูกค้า (ใช้พิมพ์บนใบ DO)', 'error');
  if (customers.some(c => c.name === name && c.id !== editingCustomerId)) return toast('มีชื่อนี้แล้ว', 'error');
  try {
    if (editingCustomerId) {
      const { data, error } = await supaClient.from('customers')
        .update({ name, address }).eq('id', editingCustomerId).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('ไม่มีสิทธิ์แก้ไข — ยังไม่ได้รันสคริปต์ตั้ง update policy');
      Object.assign(customers.find(c => c.id === editingCustomerId), data[0]);
      toast('แก้ไขลูกค้าสำเร็จ', 'success');
    } else {
      const { data, error } = await supaClient.from('customers').insert({ name, address }).select().single();
      if (error) throw error;
      customers.push(data);
      toast('เพิ่มลูกค้าสำเร็จ', 'success');
    }
    cancelEditCustomer();
    refreshCustomerSelects(); renderCustomerList();
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id); if (!c) return;
  editingCustomerId = id;
  document.getElementById('m-cust').value = c.name;
  document.getElementById('m-cust-addr').value = c.address || '';
  document.getElementById('cust-save-btn').textContent = '💾 บันทึกการแก้ไข';
  document.getElementById('cust-cancel-btn').style.display = 'inline-flex';
  document.getElementById('m-cust-addr').focus();
}

function cancelEditCustomer() {
  editingCustomerId = null;
  document.getElementById('m-cust').value = '';
  document.getElementById('m-cust-addr').value = '';
  document.getElementById('cust-save-btn').textContent = '+ เพิ่มลูกค้า';
  document.getElementById('cust-cancel-btn').style.display = 'none';
}

function renderCustomerList() {
  const el = document.getElementById('customer-list');
  el.innerHTML = customers.map((c) => `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;background:var(--s2);padding:8px 12px;border-radius:var(--r);font-size:12px">
      <span style="color:var(--t1);min-width:0">👤 ${c.name}
        <div style="color:${c.address ? 'var(--t3)' : 'var(--orange)'};font-size:11px;line-height:1.5;margin-top:2px;white-space:pre-wrap">${c.address || '⚠️ ยังไม่มีที่อยู่ — กด ✏️ เพื่อเพิ่ม'}</div>
      </span>
      <span style="display:flex;gap:2px;flex-shrink:0">
        <button onclick="editCustomer('${c.id}')" title="แก้ไขชื่อ/ที่อยู่" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:13px;padding:0 2px">✏️</button>
        <button onclick="deleteCustomer('${c.id}')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:15px;padding:0 2px">✕</button>
      </span>
    </div>`).join('');
}

async function deleteCustomer(id) {
  const c = customers.find(x => x.id === id); if (!c) return;
  // ฐานข้อมูลกันไม่ให้ลบลูกค้าที่ยังถูกอ้างถึง (งานซ่อม/ใบ DO) — บอกเหตุผลก่อน
  // ดีกว่าปล่อยให้ยิงไปแล้วเด้ง error ดิบๆ ของ Postgres กลับมา
  const jobs = repairJobs.filter(j => j.customerId === id).length;
  const dos  = doHistory.filter(d => d.customer === c.name).length;
  if (jobs || dos) {
    const ref = [jobs ? `งานซ่อม ${jobs} รายการ` : '', dos ? `ใบ DO ${dos} ใบ` : ''].filter(Boolean).join(' และ ');
    return toast(`ลบ "${c.name}" ไม่ได้ — ยังมี${ref}อ้างถึงอยู่ (ถ้าต้องการแก้ชื่อ/ที่อยู่ ให้กด ✏️ แทน)`, 'error');
  }
  if (!confirm(`ลบลูกค้า "${c.name}"?`)) return;
  try {
    const { error } = await supaClient.from('customers').delete().eq('id', id);
    if (error) throw error;
    customers = customers.filter(x => x.id !== id);
    if (editingCustomerId === id) cancelEditCustomer();
    refreshCustomerSelects(); renderCustomerList();
    toast(`ลบลูกค้า "${c.name}" แล้ว`, 'info');
  } catch (err) {
    // 23503 = foreign key violation — ยังมีตารางอื่นอ้างถึงอยู่ (เช่นงานซ่อมที่โหลดมาไม่ครบ)
    if (err.code === '23503') toast(`ลบ "${c.name}" ไม่ได้ — ยังมีงานซ่อมหรือใบ DO อ้างถึงลูกค้ารายนี้อยู่`, 'error');
    else toast('ลบล้มเหลว: ' + err.message, 'error');
  }
}

function refreshCustomerSelects() {
  ['o-cust', 'r-cust'].forEach(id => {
    const s = document.getElementById(id); if (!s) return;
    const prev = s.value;
    s.innerHTML = customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (customers.some(c => c.id === prev)) s.value = prev;
  });
  // ตัวกรองลูกค้าในหน้าประวัติ — เก็บค่าเป็น "ชื่อลูกค้า" (ตรงกับ dispatched_to)
  const hist = document.getElementById('o-hist-cust');
  if (hist) {
    const prev = hist.value;
    hist.innerHTML = '<option value="">— ทุกลูกค้า —</option>' + customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    hist.value = prev;
  }
}

function updateDataLists() {
  const cats  = [...new Set([...stock.map(i => i.category), ...masterProds.map(p => p.category)])].filter(Boolean);
  const names = [...new Set([...stock.map(i => i.name), ...masterProds.map(p => p.name)])];
  const codes = [...new Set([...stock.map(i => i.code), ...masterProds.map(p => p.code)])].filter(c => c && c !== '-');
  const suppliers = [...new Set(stock.map(i => i.supplier).filter(Boolean))];
  const subcats = [...new Set([...masterProds.map(p => p.subcategory), ...stock.map(i => i.subcategory)].filter(Boolean))];
  const subDl = document.getElementById('subcat-dl');
  if (subDl) subDl.innerHTML = subcats.map(s => `<option value="${s}">`).join('');
  const catDl  = document.getElementById('cat-dl');
  const prodDl = document.getElementById('product-dl');
  const codeDl = document.getElementById('code-dl');
  const supDl  = document.getElementById('supplier-dl');
  if (catDl)  catDl.innerHTML  = cats.map(c => `<option value="${c}">`).join('');
  if (prodDl) prodDl.innerHTML = names.map(n => `<option value="${n}">`).join('');
  if (codeDl) codeDl.innerHTML = codes.map(c => `<option value="${c}">`).join('');
  if (supDl)  supDl.innerHTML  = suppliers.map(s => `<option value="${s}">`).join('');
}
