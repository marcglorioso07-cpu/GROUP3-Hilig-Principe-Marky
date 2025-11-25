/* scripts/marketplace.js */

// ----- Storage -----
const LS = {
  keyProducts: 'slsu_products',
  keyCart: 'slsu_cart',
  keyOrders: 'slsu_orders',
  keyBiz: 'slsu_businesses',
  read(key){ return JSON.parse(localStorage.getItem(key)) || [] },
  write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

const fmt = new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP' });
const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2));
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (msg) => {
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2000);
};

// ----- Image Helper -----
const convertToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

const setupFileUpload = (fileId, textId, statusId) => {
  const f = document.getElementById(fileId);
  const t = document.getElementById(textId);
  const s = document.getElementById(statusId);
  if(!f || !t) return;

  f.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    if (s) s.textContent = e.target.files[0].name;
    try { t.value = await convertToBase64(e.target.files[0]); }
    catch(err){ console.error(err); }
  });
};

setupFileUpload('sellFile', 'sellImageInput', 'sellFileStatus');
setupFileUpload('bizFile', 'bizLogoInput', 'bizFileStatus');

// ----- Menu Builder -----
window.toggleMenuBuilder = () => {
  const grid = document.getElementById('menuBuilderGrid');
  const btn = document.getElementById('toggleMenuBtn');
  if(!grid || !btn) return;

  if(grid.children.length === 0) initMenuGrid();

  const isHidden = window.getComputedStyle(grid).display === 'none';
  if (isHidden) {
    grid.style.display = 'grid';
    btn.innerHTML = '<i class="ri-eye-off-line"></i> Hide Menu Builder';
    btn.classList.add('btn-outline');
    setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  } else {
    grid.style.display = 'none';
    btn.innerHTML = '<i class="ri-layout-grid-line"></i> Create Menu';
    btn.classList.remove('btn-outline');
  }
};

window.initMenuGrid = () => {
  const grid = document.getElementById('menuBuilderGrid');
  if(!grid) return;
  grid.innerHTML = '';

  for(let i=1; i<=4; i++) {
    const slotId = `slot_${i}`;
    const div = document.createElement('div');
    div.className = 'menu-slot-card';
    div.innerHTML = `
      <div class="slot-img-wrapper">
        <input type="file" name="qm_file" id="file_${slotId}" accept="image/*"
          onchange="previewSlotImage(this, 'prev_${slotId}')" />
        <label for="file_${slotId}" id="prev_${slotId}">
          <i class="ri-image-add-line"></i>
          <span>Add Photo</span>
        </label>
      </div>
      <div class="slot-body">
        <input name="qm_name" placeholder="Item Name" class="slot-input-title" />
        <textarea name="qm_desc" placeholder="Description..." class="slot-input-desc" rows="2"></textarea>
        <div class="slot-price-row">
          <span style="color:var(--accent); font-weight:bold;">₱</span>
          <input name="qm_price" type="number" placeholder="0.00" class="slot-input-price" />
        </div>
      </div>
    `;
    grid.appendChild(div);
  }
};

window.previewSlotImage = (input, labelId) => {
  if (!(input.files && input.files[0])) return;
  const reader = new FileReader();
  reader.onload = e => {
    const label = document.getElementById(labelId);
    if(!label) return;
    label.style.backgroundImage = `url(${e.target.result})`;
    label.innerHTML = '';
    label.style.border = 'none';
  };
  reader.readAsDataURL(input.files[0]);
};

// ----- State & Routing -----
let state = { q:'', cat:'' };

function route(r){
  // update active nav link pills
  document.querySelectorAll('.nav-pill').forEach(a=> a.classList.remove('active'));
  document.querySelector(`.nav-pill[data-route="${r}"]`)?.classList.add('active');

  // show/hide sections
  const show = (id, on) => { const el=document.getElementById(id); if(el) el.style.display = on ? 'block' : 'none'; };

  // Hero only on browse
  show('heroHeader', r === 'browse');

  show('browseSection', r==='browse');
  show('businessPage', r==='business-page');
  show('sellSection', r==='sell');
  show('businessSection', r==='business');
  show('mySection', r==='my');

  if(r==='browse') {
    renderCategoryIcons();
    renderFeatured();
    renderActiveSidebar();
    renderListings();
  }
  if(r==='my') {
    // Basic dashboard render placeholders
    const listBody = document.getElementById('myListingsBody');
    if(listBody) listBody.innerHTML = '<tr><td style="padding:1rem; color:#94a3b8;">Loading items...</td></tr>';
  }
  if(r==='sell') {
    if(!window.isAddingToBiz) {
      const link = document.getElementById('linkToBizId');
      const notice = document.getElementById('bizLinkNotice');
      if(link) link.value = '';
      if(notice) notice.style.display = 'none';
    }
    window.isAddingToBiz = false;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.route = route;

// ----- Categories -----
const CATEGORIES = [
  { name:'All', icon:'ri-apps-line' },
  { name:'Food & Drinks', icon:'ri-restaurant-line' },
  { name:'Services', icon:'ri-service-line' },
  { name:'Books', icon:'ri-book-open-line' },
  { name:'Uniforms', icon:'ri-shirt-line' },
  { name:'Electronics', icon:'ri-computer-line' },
  { name:'Others', icon:'ri-more-line' }
];

function renderCategoryIcons() {
  const container = document.getElementById('categoryIcons');
  if(!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <div class="cat-icon-item ${state.cat === (c.name==='All'?'':c.name) ? 'active' : ''}"
         onclick="filterCategory('${c.name === 'All' ? '' : c.name}')">
      <div class="cat-icon-box"><i class="${c.icon}"></i></div>
      <span class="cat-label">${c.name}</span>
    </div>
  `).join('');
}

window.filterCategory = (catName) => {
  state.cat = catName;
  renderCategoryIcons();
  renderListings();
};

// ----- Featured Businesses -----
function renderFeatured() {
  const biz = LS.read(LS.keyBiz);
  const container = document.getElementById('featuredBizRow');
  if(!container) return;

  const featured = biz.slice(0, 3);
  if(!featured.length) {
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--muted); padding:1rem; border:1px dashed var(--stroke); border-radius:12px;">No businesses featured yet.</div>`;
    return;
  }

  container.innerHTML = featured.map(b => `
    <div class="biz-square-card" onclick="openBusiness('${b.id}')">
      <img class="biz-square-img" src="${b.logo || 'https://dummyimage.com/400x400/0f1620/111827.png&text=Biz'}" />
      <div class="biz-square-overlay">
        <div class="biz-square-name">${escapeHtml(b.name)}</div>
        <div style="font-size:0.8rem; color:var(--accent);">${escapeHtml(b.category)}</div>
      </div>
    </div>
  `).join('');
}

// ----- Active Shops Sidebar -----
function renderActiveSidebar() {
  const biz = LS.read(LS.keyBiz);
  const container = document.getElementById('activeBizList');
  if(!container) return;

  if(!biz.length) {
    container.innerHTML = `<div style="color:var(--muted);">No active shops.</div>`;
    return;
  }

  container.innerHTML = biz.map((b, idx) => `
    <div class="ranked-item" onclick="openBusiness('${b.id}')">
      <div class="rank-num">${idx + 1}</div>
      <img class="rank-img" src="${b.logo || 'https://dummyimage.com/100x150/0f1620/111827.png&text=Biz'}" />
      <div class="rank-info">
        <div class="rank-title">${escapeHtml(b.name)}</div>
        <div class="rank-sub">${escapeHtml(b.category)}</div>
      </div>
      <div class="rank-status" title="Active"></div>
    </div>
  `).join('');
}

// ----- Listings -----
document.getElementById('runSearch')?.addEventListener('click', ()=>{
  state.q = document.getElementById('q')?.value.trim() || '';
  renderListings();
});

function itemTemplate(i){
  return `
  <article class="card">
    <img class="card__img" src="${i.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Item'}" />
    <div class="card__body">
      <div class="badge">${escapeHtml(i.category)} • ${escapeHtml(i.condition || 'New')}</div>
      <h3>${escapeHtml(i.title)}</h3>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
        <div class="price">${fmt.format(i.price)}</div>
        <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.9rem;" onclick="addToCart('${i.id}')">
          <i class="ri-add-line"></i>
        </button>
      </div>
    </div>
  </article>`;
}

function renderListings(){
  const listingsEl = document.getElementById('listings');
  const empty = document.getElementById('emptyListings');
  if(!listingsEl || !empty) return;

  listingsEl.innerHTML = '';
  empty.style.display = 'none';

  let items = LS.read(LS.keyProducts);

  if(state.q) {
    const q = state.q.toLowerCase();
    items = items.filter(i => (i.title||'').toLowerCase().includes(q));
  }
  if(state.cat) {
    items = items.filter(i => i.category === state.cat);
  }

  if(items.length > 0) {
    listingsEl.innerHTML = items.map(itemTemplate).join('');
  } else {
    empty.style.display = 'block';
  }
}

// ----- Sidebar Toggles (Cart & Profile) -----
// These ensure the new sidebars work correctly
const cartBtn = document.getElementById('openCart');
const cartPanel = document.getElementById('cartPanel');
const closeCart = document.getElementById('closeCart');

if(cartBtn && cartPanel) {
    cartBtn.addEventListener('click', () => cartPanel.classList.add('open'));
    if(closeCart) closeCart.addEventListener('click', () => cartPanel.classList.remove('open'));
}

const profileBtn = document.getElementById('openProfile');
const profileOverlay = document.getElementById('profileOverlay');
const closeProfile = document.getElementById('closeProfileSidebar');

if(profileBtn && profileOverlay) {
    profileBtn.addEventListener('click', () => profileOverlay.classList.add('open'));
    if(closeProfile) closeProfile.addEventListener('click', () => profileOverlay.classList.remove('open'));
}

// Init
renderListings();
