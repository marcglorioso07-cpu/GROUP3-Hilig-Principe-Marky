/* scripts/marketplace.js */

// ----- Setup -----
const ONE_TIME_RESET_KEY = 'slsu_v4_reset'; 
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

// ----- Menu Builder Logic -----
window.addQuickRow = () => {
    const container = document.getElementById('quickMenuContainer');
    const emptyMsg = document.getElementById('quickMenuEmpty');
    if(emptyMsg) emptyMsg.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'quick-row';
    div.innerHTML = `
        <input name="qm_name" placeholder="Item / Service Name" required />
        <input name="qm_price" type="number" placeholder="Price" required style="width:100px;" />
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()"><i class="ri-close-line"></i></button>
    `;
    container.appendChild(div);
};

// ----- State & Routing -----
let state = { q:'', cat:'', sort:'latest', tabView:'all' };

function route(r){
    document.body.dataset.route = r;
    // Highlight "Browse" only if on browse
    const browseLink = document.querySelector('.nav__links a[data-route="browse"]');
    if(browseLink) {
        if(r === 'browse') browseLink.classList.add('active');
        else browseLink.classList.remove('active');
    }

    // Panels Logic: Close profile sidebar and overlay on navigation
    closePanels();

    document.getElementById('browseSection').style.display = r==='browse' ? 'block' : 'none';
    document.getElementById('businessPage').style.display = r==='business-page' ? 'block' : 'none';
    document.getElementById('sellSection').style.display = r==='sell' ? 'block' : 'none';
    document.getElementById('businessSection').style.display = r==='business' ? 'block' : 'none';
    document.getElementById('mySection').style.display = r==='my' ? 'block' : 'none';

    if(r==='browse') renderListings();
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

// Global click handler for data-route links
document.addEventListener('click', e => {
    const a = e.target.closest('a[data-route]'); 
    if(a) { 
        e.preventDefault(); 
        route(a.dataset.route); 
    }
});

// ----- PROFILE SIDEBAR & OVERLAY TRIGGERS -----
function openProfile() {
    document.getElementById('profilePanel').classList.add('open');
    document.getElementById('overlay').classList.add('open');
}
function closePanels() {
    document.getElementById('profilePanel')?.classList.remove('open');
    document.getElementById('cartPanel')?.classList.remove('open'); // Close cart too if open
    document.getElementById('overlay')?.classList.remove('open');
}

// Event Delegation for Nav Buttons
document.addEventListener('click', e => {
    // Open Profile
    if(e.target.closest('#openProfile')) {
        openProfile();
    }
    // Close Profile (X button)
    if(e.target.closest('#closeProfile')) {
        closePanels();
    }
    // Close Overlay (Clicking outside)
    if(e.target.id === 'overlay') {
        closePanels();
    }
    // Open Cart
    if(e.target.closest('#openCart')) {
        document.getElementById('cartPanel').classList.add('open');
        document.getElementById('overlay').classList.add('open');
        renderCart();
    }
    // Close Cart
    if(e.target.closest('#closeCart')) {
        closePanels();
    }
});


// ----- Browse Logic -----
document.getElementById('runSearch')?.addEventListener('click', ()=>{
    state.q = document.getElementById('q').value.trim();
    state.cat = document.getElementById('cat').value;
    state.sort = document.getElementById('sort').value;
    renderListings();
});
document.getElementById('viewTabs')?.addEventListener('click', e=>{
    const t = e.target.closest('.tab');
    if(t){
        document.querySelectorAll('#viewTabs .tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        state.tabView = t.dataset.view;
        renderListings();
    }
});

function renderListings(){
    const listingsEl = document.getElementById('listings');
    listingsEl.innerHTML = '';
    const q = state.q.toLowerCase();
    
    // 1. Businesses
    let bizHTML = '';
    if(state.tabView === 'all' || state.tabView === 'businesses'){
        let biz = LS.read(LS.keyBiz).slice();
        if(q) biz = biz.filter(b => JSON.stringify(b).toLowerCase().includes(q));
        if(state.cat) biz = biz.filter(b => b.category === state.cat);
        
        if(biz.length){
             if(state.tabView === 'all') bizHTML += `<h3 class="grid-header"><i class="ri-store-2-line"></i> Featured Businesses</h3>`;
             bizHTML += biz.map(b => `
                <article class="card">
                    <div style="position:relative;">
                        <img class="card__img" src="${b.logo || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Business'}" onclick="openBusiness('${b.id}')" style="cursor:pointer" />
                        <div class="badge" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); border-color:rgba(255,255,255,0.2);">
                            ${b.type === 'Service' ? '<i class="ri-service-line"></i> Service' : '<i class="ri-restaurant-line"></i> Menu'}
                        </div>
                    </div>
                    <div class="card__body">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                             <div>
                                <div class="badge" style="margin-bottom:0.4rem;">${b.category}</div>
                                <h3 style="font-size:1.1rem; cursor:pointer;" onclick="openBusiness('${b.id}')">${escapeHtml(b.name)}</h3>
                             </div>
                             <button class="btn btn-outline" onclick="viewOwner('${b.id}')" title="View Owner" style="padding:0.4rem;"><i class="ri-user-3-line"></i></button>
                        </div>
                        <p style="color:var(--muted); font-size:0.9rem; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(b.description)}</p>
                        <div class="toolbar" style="margin-top:auto;">
                             <button class="btn" style="width:100%" onclick="openBusiness('${b.id}')">
                                ${b.type === 'Service' ? 'View Services' : 'View Menu'} <i class="ri-arrow-right-line"></i>
                             </button>
                        </div>
                    </div>
                </article>
             `).join('');
        }
    }

    // 2. Products
    let prodHTML = '';
    if(state.tabView !== 'businesses'){
        let items = LS.read(LS.keyProducts).slice();
        const catMap = {books:'Books', electronics:'Electronics'};
        if(catMap[state.tabView]) items = items.filter(i => i.category === catMap[state.tabView]);
        
        if(q) items = items.filter(i => JSON.stringify(i).toLowerCase().includes(q));
        if(state.cat) items = items.filter(i => i.category === state.cat);

        if(state.sort==='price_asc') items.sort((a,b)=>a.price-b.price);
        else if(state.sort==='price_desc') items.sort((a,b)=>b.price-a.price);
        else items.sort((a,b)=> a.id < b.id ? 1 : -1);

        if(items.length){
            if(state.tabView === 'all' && bizHTML) prodHTML += `<h3 class="grid-header" style="margin-top:2rem; border-top:1px solid var(--stroke); padding-top:1.5rem;"><i class="ri-shopping-bag-3-line"></i> Marketplace Items</h3>`;
            prodHTML += items.map(itemTemplate).join('');
        }
    }

    listingsEl.innerHTML = bizHTML + prodHTML;
    document.getElementById('emptyListings').style.display = (bizHTML || prodHTML) ? 'none' : 'block';
}

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
             <button class="btn" style="width:100%" onclick="closeOwnerModal()">Close Profile</button>
        </div>
    `;
    modal.style.display = "flex";
    modal.showModal();
};
window.closeOwnerModal = () => {
    document.getElementById('ownerModal').style.display = 'none';
    document.getElementById('ownerModal').close(); 
}

// ----- Create Business with Quick Menu -----
document.getElementById('bizForm')?.addEventListener('submit', e => {
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
    if(itemNames.length > 0) {
        const newProducts = itemNames.map((name, index) => {
            if(!name.trim()) return null;
            return {
                id: uid(),
                businessId: biz.id,
                title: name,
                price: parseFloat(itemPrices[index]) || 0,
                category: biz.category,
                condition: 'New',
                description: 'Listed from Quick Menu',
                image: '', 
                contact: biz.contact,
                seller: 'You'
            };
        }).filter(Boolean);
        const allProds = LS.read(LS.keyProducts);
        LS.write(LS.keyProducts, [...newProducts, ...allProds]);
    }
    e.target.reset();
    document.getElementById('quickMenuContainer').innerHTML = '';
    document.getElementById('quickMenuEmpty').style.display = 'block';
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
