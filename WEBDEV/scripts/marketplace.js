// ----- one-time cleanup of any old demo data -----
const ONE_TIME_RESET_KEY = 'slsu_reset_done';
if (!localStorage.getItem(ONE_TIME_RESET_KEY)) {
  ['slsu_products','slsu_cart','slsu_my_ids','slsu_orders','slsu_businesses','slsu_my_biz_ids']
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem(ONE_TIME_RESET_KEY, '1');
}

// ----- storage helpers -----
const LS = {
  keyProducts: 'slsu_products',
  keyCart: 'slsu_cart',
  keyMy: 'slsu_my_ids',
  keyOrders: 'slsu_orders',
  keyBiz: 'slsu_businesses',
  keyMyBiz: 'slsu_my_biz_ids',
  read(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback }},
  write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// ----- utilities -----
const fmt = new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP' });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
const toast = (msg) => { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); setTimeout(()=> el.classList.remove('show'), 1800); };

// ----- state & DOM -----
let state = { q: '', cat: '', sort: 'latest', tabView: 'all' };

const hero = document.getElementById('heroHeader');

const listingsEl = document.getElementById('listings');
const emptyListingsEl = document.getElementById('emptyListings');
const cartPanel = document.getElementById('cartPanel');
const cartBody = document.getElementById('cartBody');
const cartTotal = document.getElementById('cartTotal');
const cartCount = document.getElementById('cartCount');
const myListingsBody = document.getElementById('myListingsBody');
const myListingsEmpty = document.getElementById('myListingsEmpty');
const myOrdersBody = document.getElementById('myOrdersBody');
const myOrdersEmpty = document.getElementById('myOrdersEmpty');
const myBizBody = document.getElementById('myBizBody');
const myBizEmpty = document.getElementById('myBizEmpty');

// ----- routing -----
function route(r){
  document.querySelectorAll('.nav__links a').forEach(a=> a.classList.remove('active'));
  document.querySelector(`.nav__links a[data-route="${r}"]`)?.classList.add('active');

  document.getElementById('browseSection').style.display   = r==='browse'   ? 'block' : 'none';
  document.getElementById('sellSection').style.display     = r==='sell'     ? 'block' : 'none';
  document.getElementById('businessSection').style.display = r==='business' ? 'block' : 'none';
  document.getElementById('mySection').style.display       = r==='my'       ? 'block' : 'none';

  // HERO only on Browse
  if (hero) hero.style.display = (r === 'browse') ? 'block' : 'none';

  if(r==='browse') renderListings();
  if(r==='my') { renderMyListings(); renderMyOrders(); renderMyBusinesses(); }

  history.replaceState(null, '', `#${r}`);
}

// hashchange safety (back/forward/manual typing)
window.addEventListener('hashchange', ()=>{
  const r = location.hash.slice(1) || 'browse';
  route(r);
});

// top nav click
document.getElementById('navLinks')?.addEventListener('click', (e)=>{
  const a = e.target.closest('a[data-route]');
  if(!a) return;
  e.preventDefault();
  route(a.dataset.route);
});

// ----- filters -----
document.getElementById('runSearch').addEventListener('click', ()=>{
  state.q = document.getElementById('q').value.trim();
  state.cat = document.getElementById('cat').value;
  state.sort = document.getElementById('sort').value;
  renderListings();
});
document.getElementById('q').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('runSearch').click(); });
document.getElementById('viewTabs').addEventListener('click', (e)=>{
  const t = e.target.closest('.tab'); if(!t) return;
  document.querySelectorAll('#viewTabs .tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  state.tabView = t.dataset.view;
  renderListings();
});

// ----- render listings -----
function renderListings(){
  const all = LS.read(LS.keyProducts, []);
  let items = all.slice();

  if(state.tabView !== 'all'){
    const map = { books: 'Books', uniforms:'Uniforms', electronics:'Electronics' };
    items = items.filter(i=> i.category === map[state.tabView]);
  }
  if(state.q){
    const q = state.q.toLowerCase();
    items = items.filter(i=> `${i.title} ${i.category} ${i.description}`.toLowerCase().includes(q));
  }
  if(state.cat){ items = items.filter(i=> i.category === state.cat); }

  if(state.sort==='price_asc') items.sort((a,b)=> a.price - b.price);
  else if(state.sort==='price_desc') items.sort((a,b)=> b.price - a.price);
  else items.sort((a,b)=> a.id < b.id ? 1 : -1);

  listingsEl.innerHTML = items.map(cardTemplate).join('');
  emptyListingsEl.style.display = items.length? 'none' : 'block';
}
function cardTemplate(item){
  return `
  <article class="card" data-id="${item.id}">
    <img class="card__img" src="${item.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=No+Photo'}" alt="${item.title}"/>
    <div class="card__body">
      <div class="badge">${item.category} • ${item.condition}</div>
      <h3 style="font-size:1.05rem;">${escapeHtml(item.title)}</h3>
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="price">${fmt.format(item.price)}</div>
        <div class="toolbar">
          <button class="btn" onclick='addToCart("${item.id}")'><i class="ri-add-line"></i> Add</button>
          <button class="btn btn-outline" onclick='openInquiry("${item.id}")'><i class="ri-chat-1-line"></i> Message</button>
        </div>
      </div>
    </div>
  </article>`;
}
function escapeHtml(s){ return s?.replace(/[&<>\"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }

// ----- cart -----
function getCart(){ return LS.read(LS.keyCart, []); }
function setCart(v){ LS.write(LS.keyCart, v); updateCartBadge(); }
function updateCartBadge(){ const c = getCart().reduce((n, r)=> n + r.qty, 0); cartCount.textContent = c; }

window.addToCart = function(id){
  const p = LS.read(LS.keyProducts, []).find(x=>x.id===id); if(!p) return;
  const cart = getCart();
  const row = cart.find(r=> r.id===id);
  if(row) row.qty += 1; else cart.push({ id, qty:1 });
  setCart(cart);
  renderCart(); toast('Added to cart');
};

function renderCart(){
  const cart = getCart();
  const products = LS.read(LS.keyProducts, []);
  if(!cart.length){ cartBody.innerHTML = `<div class="empty"><i class='ri-shopping-bag-3-line'></i>Your cart is empty.</div>`; cartTotal.textContent = fmt.format(0); return; }
  let total = 0;
  cartBody.innerHTML = cart.map(row=>{
    const item = products.find(p=>p.id===row.id);
    const price = item ? item.price*row.qty : 0; total += price;
    return `<div style="display:grid; grid-template-columns:64px 1fr auto; gap:.7rem; align-items:center;">
      <img src="${item?.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=No+Photo'}" style="width:64px; height:64px; object-fit:cover; border-radius:10px;"/>
      <div>
        <div style="font-weight:700;">${escapeHtml(item?.title || 'Deleted item')}</div>
        <div class="badge">x${row.qty} • ${fmt.format(item?.price || 0)}</div>
      </div>
      <div style="display:flex; gap:.35rem;">
        <button class="btn btn-outline" onclick='decQty("${row.id}")'><i class="ri-subtract-line"></i></button>
        <button class="btn btn-outline" onclick='incQty("${row.id}")'><i class="ri-add-line"></i></button>
        <button class="btn" onclick='removeFromCart("${row.id}")'><i class="ri-delete-bin-6-line"></i></button>
      </div>
    </div>`;
  }).join('');
  cartTotal.textContent = fmt.format(total);
}
window.decQty = (id)=>{ const c=getCart(); const r=c.find(x=>x.id===id); if(!r) return; r.qty=Math.max(0,r.qty-1); if(r.qty===0) LS.write(LS.keyCart, c.filter(x=>x.id!==id)); else setCart(c); renderCart(); }
window.incQty = (id)=>{ const c=getCart(); const r=c.find(x=>x.id===id); if(!r) return; r.qty+=1; setCart(c); renderCart(); }
window.removeFromCart = (id)=>{ setCart(getCart().filter(x=>x.id!==id)); renderCart(); }

// ----- checkout -> creates "orders" -----
document.getElementById('checkoutBtn').addEventListener('click', ()=>{
  const cart = getCart(); if(!cart.length) return toast('Cart empty');
  const products = LS.read(LS.keyProducts, []);
  const orders = LS.read(LS.keyOrders, []);
  const payload = cart.map(row=>{
    const item = products.find(p=>p.id===row.id); if(!item) return null;
    return { id: uid(), productId: item.id, title: item.title, seller: item.seller || 'Seller', contact: item.contact, qty: row.qty, price: item.price, date: new Date().toISOString(), buyer: 'You' };
  }).filter(Boolean);
  LS.write(LS.keyOrders, [...orders, ...payload]);
  setCart([]); renderCart(); toast('Checkout complete! Sellers will contact you.');
});

// ----- sell form -----
document.getElementById('sellForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const f = new FormData(e.target);
  const product = {
    id: uid(),
    title: f.get('title').trim(),
    price: parseFloat(f.get('price')) || 0,
    category: f.get('category'),
    condition: f.get('condition'),
    description: f.get('description')?.trim() || '',
    image: f.get('image')?.trim() || '',
    contact: f.get('contact')?.trim() || '',
    seller: 'You'
  };
  const all = LS.read(LS.keyProducts, []);
  LS.write(LS.keyProducts, [product, ...all]);
  const mine = LS.read(LS.keyMy, []);
  LS.write(LS.keyMy, [product.id, ...mine]);
  e.target.reset();
  toast('Listing published');
  route('my');
  selectMyTab('listings');
});

// ----- business form -----
document.getElementById('bizForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const f = new FormData(e.target);
  const biz = {
    id: uid(),
    name: f.get('name').trim(),
    category: f.get('category'),
    description: (f.get('description')||'').trim(),
    logo: (f.get('logo')||'').trim(),
    contact: (f.get('contact')||'').trim(),
    location: (f.get('location')||'').trim(),
    website: (f.get('website')||'').trim(),
    owner: 'You',
    created: new Date().toISOString()
  };
  const all = LS.read(LS.keyBiz, []);
  LS.write(LS.keyBiz, [biz, ...all]);
  const mine = LS.read(LS.keyMyBiz, []);
  LS.write(LS.keyMyBiz, [biz.id, ...mine]);
  e.target.reset();
  toast('Business published');
  route('my');
  selectMyTab('biz');
});

// ----- dashboard tabs -----
function selectMyTab(which){
  const tabs = document.querySelectorAll('#myTabs .tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`#myTabs .tab[data-tab="${which}"]`)?.classList.add('active');

  document.getElementById('myListings').style.display   = which==='listings' ? 'block' : 'none';
  document.getElementById('myOrders').style.display     = which==='orders'   ? 'block' : 'none';
  document.getElementById('myBusinesses').style.display = which==='biz'      ? 'block' : 'none';
}
document.getElementById('myTabs').addEventListener('click', (e)=>{
  const t = e.target.closest('.tab'); if(!t) return;
  selectMyTab(t.dataset.tab);
});

// ----- render "my" data -----
function renderMyListings(){
  const ids = new Set(LS.read(LS.keyMy, []));
  const all = LS.read(LS.keyProducts, []);
  const mine = all.filter(x=> ids.has(x.id));
  if(!mine.length){ myListingsBody.innerHTML=''; myListingsEmpty.style.display='block'; return; }
  myListingsEmpty.style.display='none';
  myListingsBody.innerHTML = mine.map(item=>`
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:.6rem;">
          <img src="${item.image || 'https://dummyimage.com/120x90/0f1620/111827.png&text=No+Photo'}" style="width:56px; height:56px; object-fit:cover; border-radius:8px;"/>
          <div>
            <div style="font-weight:700;">${escapeHtml(item.title)}</div>
            <div class="badge">${item.condition}</div>
          </div>
        </div>
      </td>
      <td>${fmt.format(item.price)}</td>
      <td>${item.category}</td>
      <td><span class="badge"><i class="ri-checkbox-circle-line"></i> Active</span></td>
      <td>
        <div class="toolbar">
          <button class="btn btn-outline" onclick='editListing("${item.id}")'><i class="ri-edit-2-line"></i></button>
          <button class="btn" onclick='deleteListing("${item.id}")'><i class="ri-delete-bin-6-line"></i></button>
        </div>
      </td>
    </tr>`).join('');
}
window.deleteListing = (id)=>{
  if(!confirm('Delete this listing?')) return;
  const mine = new Set(LS.read(LS.keyMy, [])); mine.delete(id); LS.write(LS.keyMy, Array.from(mine));
  const all = LS.read(LS.keyProducts, []).filter(x=> x.id !== id); LS.write(LS.keyProducts, all);
  toast('Listing deleted'); renderMyListings(); renderListings();
}
window.editListing = (id)=>{
  const all = LS.read(LS.keyProducts, []);
  const item = all.find(x=> x.id===id); if(!item) return;
  const title = prompt('Title', item.title); if(title===null) return;
  const price = parseFloat(prompt('Price (PHP)', item.price))||item.price;
  const desc = prompt('Description', item.description) ?? item.description;
  item.title = title.trim(); item.price = price; item.description = (desc||'').trim();
  LS.write(LS.keyProducts, all); toast('Listing updated'); renderMyListings(); renderListings();
}

function renderMyOrders(){
  const ids = new Set(LS.read(LS.keyMy, []));
  const orders = LS.read(LS.keyOrders, []).filter(o=> ids.has(o.productId));
  if(!orders.length){ myOrdersBody.innerHTML=''; myOrdersEmpty.style.display='block'; return; }
  myOrdersEmpty.style.display='none';
  myOrdersBody.innerHTML = orders.slice().reverse().map(o=>`
    <tr>
      <td>${o.buyer}</td>
      <td>${escapeHtml(o.title)}</td>
      <td>Interested in ${o.qty} × (${fmt.format(o.price)} each). Reach them back!</td>
      <td>${new Date(o.date).toLocaleString()}</td>
    </tr>`).join('');
}

function renderMyBusinesses(){
  const ids = new Set(LS.read(LS.keyMyBiz, []));
  const all = LS.read(LS.keyBiz, []);
  const mine = all.filter(x=> ids.has(x.id));
  if(!mine.length){ myBizBody.innerHTML=''; myBizEmpty.style.display='block'; return; }
  myBizEmpty.style.display='none';
  myBizBody.innerHTML = mine.map(b=>`
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:.6rem;">
          <img src="${b.logo || 'https://dummyimage.com/120x90/0f1620/111827.png&text=Logo'}" style="width:56px; height:56px; object-fit:cover; border-radius:8px;"/>
          <div><div style="font-weight:700;">${escapeHtml(b.name)}</div></div>
        </div>
      </td>
      <td>${b.category}</td>
      <td>${escapeHtml(b.contact || '')}</td>
      <td>${escapeHtml(b.location || '')}</td>
      <td>
        <div class="toolbar">
          <button class="btn btn-outline" onclick='editBusiness("${b.id}")'><i class="ri-edit-2-line"></i></button>
          <button class="btn" onclick='deleteBusiness("${b.id}")'><i class="ri-delete-bin-6-line"></i></button>
        </div>
      </td>
    </tr>`).join('');
}
window.deleteBusiness = (id)=>{
  if(!confirm('Delete this business?')) return;
  const mine = new Set(LS.read(LS.keyMyBiz, [])); mine.delete(id); LS.write(LS.keyMyBiz, Array.from(mine));
  const all = LS.read(LS.keyBiz, []).filter(x=> x.id !== id); LS.write(LS.keyBiz, all);
  toast('Business deleted'); renderMyBusinesses();
}
window.editBusiness = (id)=>{
  const all = LS.read(LS.keyBiz, []);
  const b = all.find(x=> x.id===id); if(!b) return;
  const name = prompt('Business name', b.name); if(name===null) return;
  const desc = prompt('Description', b.description) ?? b.description;
  const contact = prompt('Contact', b.contact) ?? b.contact;
  b.name = name.trim(); b.description = (desc||'').trim(); b.contact = (contact||'').trim();
  LS.write(LS.keyBiz, all); toast('Business updated'); renderMyBusinesses();
}

// ----- inquiry -----
window.openInquiry = (id)=>{
  const item = LS.read(LS.keyProducts, []).find(p=>p.id===id); if(!item) return;
  const note = prompt(`Send a message to seller (contact: ${item.contact})`, 'Hi! Is this still available?');
  if(note===null) return;
  const orders = LS.read(LS.keyOrders, []);
  orders.push({ id: uid(), productId: id, title: item.title, seller: item.seller||'Seller', contact: item.contact, qty: 1, price: item.price, date: new Date().toISOString(), buyer: 'You', message: note });
  LS.write(LS.keyOrders, orders);
  toast('Message sent to seller');
}

// ----- panel + init -----
document.getElementById('openCart').addEventListener('click', ()=>{ cartPanel.classList.add('open'); renderCart(); });
document.getElementById('closeCart').addEventListener('click', ()=> cartPanel.classList.remove('open'));
document.getElementById('year').textContent = new Date().getFullYear();
updateCartBadge();

// initial route
route(location.hash.slice(1) || 'browse');
renderListings();
