// ══════════════════════════════════════════════════════════════
//  MASTER DATA
// ══════════════════════════════════════════════════════════════
async function saveMasterProduct() {
  const cat  = document.getElementById('m-cat').value.trim();
  const name = document.getElementById('m-name').value.trim();
  const code = document.getElementById('m-code').value.trim();
  if (!name) return toast('กรุณาใส่ชื่อสินค้า', 'error');
  try {
    const { data, error } = await supaClient.from('master_products')
      .insert({ category: cat || 'ไม่ระบุ', name, code }).select().single();
    if (error) throw error;
    masterProds.push(data);
    renderMasterProducts(); updateDataLists();
    document.getElementById('m-cat').value = ''; document.getElementById('m-name').value = ''; document.getElementById('m-code').value = '';
    toast('บันทึกต้นแบบสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

function renderMasterProducts() {
  const el = document.getElementById('master-product-list');
  el.innerHTML = masterProds.length ? masterProds.map((p) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--s2);padding:8px 12px;border-radius:var(--r);font-size:12px">
      <span><span class="badge b-blue" style="font-size:9px;margin-right:6px">${p.category || '—'}</span><b style="color:var(--t1)">${p.name}</b> <span class="mono" style="color:var(--t3);font-size:10px">${p.code||''}</span></span>
      <button onclick="deleteMasterProduct('${p.id}')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:15px;padding:0 2px">✕</button>
    </div>`).join('') : '<div style="text-align:center;color:var(--t3);font-size:12px;padding:12px">ยังไม่มีต้นแบบ</div>';
}

async function deleteMasterProduct(id) {
  try {
    const { error } = await supaClient.from('master_products').delete().eq('id', id);
    if (error) throw error;
    masterProds = masterProds.filter(p => p.id !== id);
    renderMasterProducts(); updateDataLists();
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}

async function saveCustomer() {
  const name = document.getElementById('m-cust').value.trim();
  if (!name) return toast('กรุณาใส่ชื่อลูกค้า', 'error');
  if (customers.some(c => c.name === name)) return toast('มีชื่อนี้แล้ว', 'error');
  try {
    const { data, error } = await supaClient.from('customers').insert({ name }).select().single();
    if (error) throw error;
    customers.push(data);
    refreshCustomerSelects(); renderCustomerList();
    document.getElementById('m-cust').value = '';
    toast('เพิ่มลูกค้าสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

function renderCustomerList() {
  const el = document.getElementById('customer-list');
  el.innerHTML = customers.map((c) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--s2);padding:8px 12px;border-radius:var(--r);font-size:12px">
      <span style="color:var(--t1)">👤 ${c.name}</span>
      <button onclick="deleteCustomer('${c.id}')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:15px;padding:0 2px">✕</button>
    </div>`).join('');
}

async function deleteCustomer(id) {
  try {
    const { error } = await supaClient.from('customers').delete().eq('id', id);
    if (error) throw error;
    customers = customers.filter(c => c.id !== id);
    refreshCustomerSelects(); renderCustomerList();
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
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
  const catDl  = document.getElementById('cat-dl');
  const prodDl = document.getElementById('product-dl');
  const codeDl = document.getElementById('code-dl');
  const supDl  = document.getElementById('supplier-dl');
  if (catDl)  catDl.innerHTML  = cats.map(c => `<option value="${c}">`).join('');
  if (prodDl) prodDl.innerHTML = names.map(n => `<option value="${n}">`).join('');
  if (codeDl) codeDl.innerHTML = codes.map(c => `<option value="${c}">`).join('');
  if (supDl)  supDl.innerHTML  = suppliers.map(s => `<option value="${s}">`).join('');
}
