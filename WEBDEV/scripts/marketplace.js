/* scripts/marketplace.js */

// ----- Setup -----
const ONE_TIME_RESET_KEY = 'slsu_v10_layout'; 
if (!localStorage.getItem(ONE_TIME_RESET_KEY)) {
  localStorage.clear(); 
  localStorage.setItem(ONE_TIME_RESET_KEY, '1');
}

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
const escapeHtml = (s) => s?.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (msg) => { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2000); };

// ----- Image Helper -----
const convertToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});
const setupFileUpload = (fileId, textId, statusId) => {
    const f = document.getElementById(fileId), t = document.getElementById(textId), s = document.getElementById(statusId);
    if(f && t) f.addEventListener('change', async(e)=>{
        if(e.target.files[0]){
            if(s) s.textContent = e.target.files[0].name;
            try{ t.value = await convertToBase64(e.target.files[0]); }catch(err){ console.error(err); }
        }
    });
};
setupFileUpload('sellFile', 'sellImageInput', 'sellFileStatus');
setupFileUpload('bizFile', 'bizLogoInput', 'bizFileStatus');

// ----- Menu Builder -----
window.toggleMenuBuilder = () => {
    const grid = document.getElementById('menuBuilderGrid');
    const btn = document.getElementById('toggleMenuBtn');
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
    grid.innerHTML = ''; 
    for(let i=1; i<=4; i++) {
        const slotId = `slot_${i}`;
        const div = document.createElement('div');
        div.className = 'menu-slot-card';
        div.innerHTML = `
            <div class="slot-img-wrapper">
                <input type="file" name="qm_file" id="file_${slotId}" accept="image/*" onchange="previewSlotImage(this, 'prev_${slotId}')" />
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
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const label = document.getElementById(labelId);
            label.style.backgroundImage = `url(${e.target.result})`;
            label.innerHTML = ''; label.style.border = 'none';
        }
        reader.readAsDataURL(input.files[0]);
    }
};

// ----- State & Routing -----
let state = { q:'', cat:'', sort:'latest' };

function route(r){
    document.body.dataset.route = r;
    document.querySelectorAll('.nav__links a').forEach(a=> a.classList.remove('active'));
    document.querySelector(`.nav__links a[data-route="${r}"]`)?.classList.add('active');

    document.getElementById('browseSection').style.display = r==='browse' ? 'block' : 'none';
    document.getElementById('businessPage').style.display = r==='business-page' ? 'block' : 'none';
    document.getElementById('sellSection').style.display = r==='sell' ? 'block' : 'none';
    document.getElementById('businessSection').style.display = r==='business' ? 'block' : 'none';
    document.getElementById('mySection').style.display = r==='my' ? 'block' : 'none';

    if(r==='browse') {
        renderCategoryIcons();
        renderFeatured();
        renderActiveSidebar();
        renderListings(); // Only listings
    }
    if(r==='my') { renderMyListings(); renderMyOrders(); renderMyBusinesses(); }
    if(r==='sell') { 
        if(!window.isAddingToBiz) {
            document.getElementById('linkToBizId').value = '';
            document.getElementById('bizLinkNotice').style.display = 'none';
        }
        window.isAddingToBiz = false; 
    }
    history.replaceState(null,'',`#${r}`);
}
window.addEventListener('hashchange', ()=> route(location.hash.slice(1)||'browse'));
document.getElementById('linksMount')?.addEventListener('click', e=>{
    const a = e.target.closest('a[data-route]'); 
    if(a) { e.preventDefault(); route(a.dataset.route); }
});

// ----- 1. RENDER CATEGORY ICONS -----
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
    renderCategoryIcons(); // Re-render to update active state
    renderListings();      // Filter the feed
};

// ----- 2. RENDER FEATURED (Squares) -----
function renderFeatured() {
    const biz = LS.read(LS.keyBiz);
    const container = document.getElementById('featuredBizRow');
    // Take first 3 for the squares
    const featured = biz.slice(0, 3);
    
    if(featured.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; color:var(--muted);">No businesses featured yet.</div>`;
        return;
    }

    container.innerHTML = featured.map(b => `
        <div class="biz-square-card" onclick="openBusiness('${b.id}')">
            <img class="biz-square-img" src="${b.logo || 'https://dummyimage.com/400x400/0f1620/111827.png&text=Biz'}" />
            <div class="biz-square-overlay">
                <div class="biz-square-name">${escapeHtml(b.name)}</div>
                <div style="font-size:0.8rem; color:var(--accent);">${b.category}</div>
            </div>
        </div>
    `).join('');
}

// ----- 3. RENDER ACTIVE SIDEBAR -----
function renderActiveSidebar() {
    const biz = LS.read(LS.keyBiz);
    const container = document.getElementById('activeBizList');
    // Simulate "Active" or "Hottest" by listing all businesses
    // In a real app, this would filter by an 'active' status
    
    if(biz.length === 0) {
        container.innerHTML = `<div style="color:var(--muted);">No active shops.</div>`;
        return;
    }

    container.innerHTML = biz.map((b, idx) => `
        <div class="ranked-item" onclick="openBusiness('${b.id}')">
            <div class="rank-num">${idx + 1}</div>
            <img class="rank-img" src="${b.logo || 'https://dummyimage.com/100x150/0f1620/111827.png&text=Biz'}" />
            <div class="rank-info">
                <div class="rank-title">${escapeHtml(b.name)}</div>
                <div class="rank-sub">${b.category}</div>
            </div>
            <div class="rank-status" title="Active"></div>
        </div>
    `).join('');
}

// ----- 4. RENDER MAIN LISTINGS FEED -----
function renderListings(){
    const listingsEl = document.getElementById('listings');
    listingsEl.innerHTML = '';
    
    let items = LS.read(LS.keyProducts);
    // Only individual items (no biz menu items)
    items = items.filter(i => !i.businessId);

    // Apply Filters
    if(state.q) {
        const q = state.q.toLowerCase();
        items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    if(state.cat) {
        items = items.filter(i => i.category === state.cat);
    }

    if(items.length){
        listingsEl.innerHTML = items.map(itemTemplate).join('');
        document.getElementById('emptyListings').style.display = 'none';
    } else {
        document.getElementById('emptyListings').style.display = 'block';
    }
}

// ----- Search Handler -----
document.getElementById('runSearch')?.addEventListener('click', ()=>{
    state.q = document.getElementById('q').value.trim();
    renderListings();
});

function itemTemplate(i){
    return `
    <article class="card">
        <img class="card__img" src="${i.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Item'}" />
        <div class="card__body">
            <div class="badge">${i.category} • ${i.condition}</div>
            <h3 style="font-size:1.05rem;">${escapeHtml(i.title)}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                <div class="price">${fmt.format(i.price)}</div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-outline" onclick="openInquiry('${i.id}')"><i class="ri-chat-1-line"></i></button>
                    <button class="btn" onclick="addToCart('${i.id}')">Add</button>
                </div>
            </div>
        </div>
    </article>`;
}

window.viewAllBiz = () => {
    // Just scrolls to sidebar for now, or could show a full list modal
    document.getElementById('activeBizList').scrollIntoView({ behavior:'smooth' });
}

// ... (Rest of Business Logic: openBusiness, Create, etc. remains same) ...
window.openBusiness = (id) => {
    const b = LS.read(LS.keyBiz).find(x => x.id === id);
    if(!b) return;
    const header = document.getElementById('bizHeader');
    header.innerHTML = `
        <img src="${b.logo || 'https://dummyimage.com/200x200/0f1620/111827.png&text=Logo'}" style="width:120px; height:120px; border-radius:12px; object-fit:cover; box-shadow:0 4px 12px rgba(0,0,0,0.3);" />
        <div style="flex:1;">
            <div class="badge" style="margin-bottom:0.5rem;">${b.type === 'Service' ? 'Service Provider' : 'Food & Retail'}</div>
            <h1 style="font-size:2rem; font-weight:800; margin-bottom:0.5rem;">${escapeHtml(b.name)}</h1>
            <p style="color:var(--muted); margin-bottom:1rem;">${escapeHtml(b.description)}</p>
            <div style="display:flex; gap:1rem; font-size:0.9rem; flex-wrap:wrap;">
                <span><i class="ri-map-pin-line"></i> ${escapeHtml(b.location)}</span>
                <span><i class="ri-phone-line"></i> ${escapeHtml(b.contact)}</span>
            </div>
             <div style="margin-top:1rem;">
                <button class="btn btn-outline" onclick="viewOwner('${b.id}')"><i class="ri-user-smile-line"></i> Meet the Owner</button>
            </div>
        </div>
    `;
    const allItems = LS.read(LS.keyProducts);
    const bizItems = allItems.filter(i => i.businessId === id);
    document.getElementById('bizItemsTitle').textContent = b.type === 'Service' ? 'Our Services' : 'Our Menu';
    const grid = document.getElementById('bizItemsGrid');
    if(bizItems.length){
        grid.innerHTML = bizItems.map(itemTemplate).join('');
        document.getElementById('bizItemsEmpty').style.display = 'none';
    } else {
        grid.innerHTML = '';
        document.getElementById('bizItemsEmpty').style.display = 'block';
    }
    route('business-page');
};

window.viewOwner = (id) => {
    const b = LS.read(LS.keyBiz).find(x => x.id === id);
    if(!b) return;
    const modal = document.getElementById('ownerModal');
    const content = document.getElementById('ownerInfo');
    content.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
             <div style="width:80px; height:80px; background:var(--accent); color:#000; border-radius:50%; font-size:2rem; font-weight:bold; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem auto;">
                ${b.ownerName ? b.ownerName[0].toUpperCase() : 'U'}
             </div>
             <h3 style="font-size:1.3rem; margin-bottom:0.2rem;">${escapeHtml(b.ownerName)}</h3>
             <span class="badge">Age: ${escapeHtml(b.ownerAge)}</span>
        </div>
        <div style="background:var(--surface-3); padding:1rem; border-radius:8px;">
            <h4 style="color:var(--muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem;">About the Business</h4>
            <p>${escapeHtml(b.description)}</p>
        </div>
        <div style="margin-top:1.5rem; text-align:center;">
             <button class="btn" style="width:100%" onclick="document.getElementById('ownerModal').close()">Close Profile</button>
        </div>
    `;
    modal.style.display = "flex";
};

document.getElementById('bizForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const biz = {
        id: uid(),
        type: f.get('type'),
        name: f.get('name'),
        category: f.get('category'),
        ownerName: f.get('ownerName'),
        ownerAge: f.get('ownerAge'),
        description: f.get('description'),
        logo: f.get('logo') || '',
        contact: f.get('contact'),
        location: f.get('location'),
        website: f.get('website') || '',
        owner: 'You'
    };
    
    const allBiz = LS.read(LS.keyBiz);
    LS.write(LS.keyBiz, [biz, ...allBiz]);

    const itemNames = f.getAll('qm_name');
    const itemPrices = f.getAll('qm_price');
    const itemDescs = f.getAll('qm_desc'); 
    const itemFiles = f.getAll('qm_file'); 
    
    const newProducts = [];
    for (let i = 0; i < itemNames.length; i++) {
        if(!itemNames[i].trim()) continue;
        let imgData = '';
        if(itemFiles[i] && itemFiles[i].size > 0) {
            try { imgData = await convertToBase64(itemFiles[i]); } catch(err) { console.error(err); }
        }
        newProducts.push({
            id: uid(),
            businessId: biz.id,
            title: itemNames[i],
            price: parseFloat(itemPrices[i]) || 0,
            category: biz.category, 
            condition: 'New',
            description: itemDescs[i] || 'Menu Item', 
            image: imgData, 
            contact: biz.contact,
            seller: 'You'
        });
    }

    if(newProducts.length > 0) {
        const allProds = LS.read(LS.keyProducts);
        LS.write(LS.keyProducts, [...newProducts, ...allProds]);
    }

    e.target.reset();
    document.getElementById('menuBuilderGrid').style.display = 'none';
    document.getElementById('toggleMenuBtn').innerHTML = '<i class="ri-layout-grid-line"></i> Create Menu';
    document.getElementById('toggleMenuBtn').classList.remove('btn-outline');
    toast('Business & Menu Launched!');
    route('my');
    document.querySelector('[data-tab="biz"]').click();
});

window.addItemToBiz = (bizId, bizName) => {
    window.isAddingToBiz = true;
    const notice = document.getElementById('bizLinkNotice');
    const input = document.getElementById('linkToBizId');
    input.value = bizId;
    document.getElementById('bizLinkName').textContent = bizName;
    notice.style.display = 'block';
    route('sell');
};

document.getElementById('sellForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const item = {
        id: uid(),
        businessId: f.get('businessId'), 
        title: f.get('title'),
        price: parseFloat(f.get('price')) || 0,
        category: f.get('category'),
        condition: f.get('condition'),
        description: f.get('description'),
        image: f.get('image') || '',
        contact: f.get('contact'),
        seller: 'You'
    };
    const all = LS.read(LS.keyProducts);
    LS.write(LS.keyProducts, [item, ...all]);
    e.target.reset();
    toast('Item Published!');
    route('my');
    document.querySelector(`[data-tab="${item.businessId ? 'biz' : 'listings'}"]`).click();
});

function renderMyBusinesses(){
    const biz = LS.read(LS.keyBiz).filter(b => b.owner === 'You');
    const el = document.getElementById('myBizBody');
    if(!biz.length) { el.innerHTML=''; document.getElementById('myBizEmpty').style.display='block'; return; }
    document.getElementById('myBizEmpty').style.display='none';
    el.innerHTML = biz.map(b => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:0.8rem;">
                    <img src="${b.logo || 'https://dummyimage.com/100x100/0f1620/111827.png&text=Logo'}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;" />
                    <div>
                        <div style="font-weight:bold;">${escapeHtml(b.name)}</div>
                        <div style="font-size:0.8rem; color:var(--muted);">${b.type} • ${b.category}</div>
                    </div>
                </div>
            </td>
            <td>
                <button class="btn btn-outline" onclick="addItemToBiz('${b.id}', '${escapeHtml(b.name)}')" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
                    <i class="ri-add-line"></i> Add ${b.type==='Service'?'Service':'Item'}
                </button>
            </td>
            <td>
                <button class="btn btn-outline" onclick="deleteBiz('${b.id}')"><i class="ri-delete-bin-line"></i></button>
            </td>
        </tr>
    `).join('');
}
window.deleteBiz = (id) => {
    if(!confirm('Delete business?')) return;
    const all = LS.read(LS.keyBiz).filter(b => b.id !== id);
    LS.write(LS.keyBiz, all);
    renderMyBusinesses();
};

function renderMyListings(){
    const items = LS.read(LS.keyProducts).filter(i => i.seller === 'You');
    const el = document.getElementById('myListingsBody');
    if(!items.length) { el.innerHTML=''; document.getElementById('myListingsEmpty').style.display='block'; return; }
    document.getElementById('myListingsEmpty').style.display='none';
    el.innerHTML = items.map(i => `
        <tr>
            <td>${escapeHtml(i.title)}</td>
            <td>${fmt.format(i.price)}</td>
            <td>${i.businessId ? '<span class="badge">Biz Item</span>' : 'Personal'}</td>
            <td><button class="btn btn-outline" onclick="deleteItem('${i.id}')"><i class="ri-delete-bin-line"></i></button></td>
        </tr>
    `).join('');
}
window.deleteItem = (id) => {
    if(!confirm('Delete item?')) return;
    const all = LS.read(LS.keyProducts).filter(i => i.id !== id);
    LS.write(LS.keyProducts, all);
    renderMyListings();
}

window.addToCart = (id) => {
    const cart = LS.read(LS.keyCart);
    const exists = cart.find(x=>x.id===id);
    if(exists) exists.qty++; else cart.push({id, qty:1});
    LS.write(LS.keyCart, cart);
    updateCart();
    toast('Added to cart');
};
function updateCart(){
    const cart = LS.read(LS.keyCart);
    document.getElementById('cartCount').textContent = cart.reduce((n,x)=>n+x.qty,0);
    const prods = LS.read(LS.keyProducts);
    let total = 0;
    document.getElementById('cartBody').innerHTML = cart.map(c=>{
        const p = prods.find(x=>x.id===c.id);
        if(!p) return '';
        total += p.price * c.qty;
        return `<div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
            <div>${escapeHtml(p.title)} <span class="badge">x${c.qty}</span></div>
            <div>${fmt.format(p.price * c.qty)}</div>
        </div>`;
    }).join('');
    document.getElementById('cartTotal').textContent = fmt.format(total);
}
document.getElementById('closeCart').onclick = ()=> document.getElementById('cartPanel').classList.remove('open');
document.getElementById('openCart').onclick = ()=> { document.getElementById('cartPanel').classList.add('open'); updateCart(); };
updateCart();
route(location.hash.slice(1)||'browse');