/* scripts/marketplace.js */

// ----- Setup -----
const ONE_TIME_RESET_KEY = 'slsu_v5_reset'; // Bump version
if (!localStorage.getItem(ONE_TIME_RESET_KEY)) {
  localStorage.clear(); 
  localStorage.setItem(ONE_TIME_RESET_KEY, '1');
}

const LS = {
  keyProducts: 'slsu_products',
  keyCart: 'slsu_cart',
  keyBiz: 'slsu_businesses',
  keyUser: 'slsu_user_profile', // New key for user settings
  read(key){ return JSON.parse(localStorage.getItem(key)) || [] },
  write(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  readObj(key){ return JSON.parse(localStorage.getItem(key)) || {} }
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
// Generic file upload handler
const setupFileUpload = (fileId, textId, statusId, previewId) => {
    const f = document.getElementById(fileId), t = document.getElementById(textId), s = document.getElementById(statusId);
    if(f && t) f.addEventListener('change', async(e)=>{
        if(e.target.files[0]){
            if(s) s.textContent = e.target.files[0].name;
            try{ 
                const b64 = await convertToBase64(e.target.files[0]);
                t.value = b64;
                if(previewId) {
                    const prev = document.getElementById(previewId);
                    if(prev) prev.innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;">`;
                }
            }catch(err){ console.error(err); }
        }
    });
};
setupFileUpload('sellFile', 'sellImageInput', 'sellFileStatus');
setupFileUpload('bizFile', 'bizLogoInput', 'bizFileStatus');
// New setup for settings avatar
setupFileUpload('settingsFile', 'settingsAvatarInput', null, 'settingsAvatarPreview');


// ----- User Profile Logic -----
function loadUserProfile() {
    const user = LS.readObj(LS.keyUser);
    const name = user.username || 'User Student';
    const avatar = user.avatar; 
    const bio = user.bio || 'Student ID: 12345';
    const googleConnected = user.googleConnected || false;

    // Update Sidebar
    const sbName = document.getElementById('sidebarName');
    if(sbName) {
        sbName.textContent = name;
        sbName.nextElementSibling.textContent = bio;
    }
    
    // Update Avatars (Sidebar + Nav)
    const updateAvatarUI = (el) => {
        if(!el) return;
        if(avatar) {
            el.innerHTML = `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            el.innerHTML = name.charAt(0).toUpperCase();
        }
    };

    // Nav Avatar (in partials, might need to wait or query generally)
    const navBtn = document.getElementById('openProfile');
    if(navBtn) updateAvatarUI(navBtn.firstElementChild);

    // Sidebar Avatar
    const sbAvatar = document.querySelector('.sidebar-avatar');
    if(sbAvatar) updateAvatarUI(sbAvatar);

    // Update Settings Form Values
    const sName = document.getElementById('settingsName');
    const sBio = document.getElementById('settingsBio');
    const sAvInput = document.getElementById('settingsAvatarInput');
    const sAvPrev = document.getElementById('settingsAvatarPreview');
    const gBtn = document.getElementById('googleBtn');
    const gText = document.getElementById('googleStatusText');

    if(sName) sName.value = name;
    if(sBio) sBio.value = bio;
    if(sAvInput) sAvInput.value = avatar || '';
    if(sAvPrev && avatar) sAvPrev.innerHTML = `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover;">`;
    
    if(gBtn && gText) {
        if(googleConnected) {
            gText.textContent = 'Connected as ' + name;
            gText.style.color = '#4ade80';
            gBtn.innerHTML = '<i class="ri-check-line"></i> Connected';
            gBtn.classList.add('connected');
        } else {
            gText.textContent = 'Not connected';
            gText.style.color = 'var(--muted)';
            gBtn.innerHTML = '<i class="ri-google-fill"></i> Connect';
            gBtn.classList.remove('connected');
        }
    }
}

// Google Button Logic
document.getElementById('googleBtn')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const user = LS.readObj(LS.keyUser);
    
    if(user.googleConnected) {
        if(confirm('Disconnect Google Account?')) {
            user.googleConnected = false;
            LS.write(LS.keyUser, user);
            toast('Google Account Disconnected');
            loadUserProfile();
        }
    } else {
        // Simulate Auth
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Connecting...';
        setTimeout(() => {
            user.googleConnected = true;
            LS.write(LS.keyUser, user);
            toast('Google Account Connected!');
            loadUserProfile();
        }, 1000);
    }
});

// Save Settings
document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const user = LS.readObj(LS.keyUser);
    
    user.username = f.get('username');
    user.bio = f.get('bio');
    user.avatar = f.get('avatar');
    
    LS.write(LS.keyUser, user);
    toast('Profile Saved!');
    loadUserProfile();
    closeSettingsModal();
});


// ----- Navigation & Panels -----
let state = { q:'', cat:'', sort:'latest', tabView:'all' };

function route(r){
    document.body.dataset.route = r;
    const browseLink = document.querySelector('.nav__links a[data-route="browse"]');
    if(browseLink) {
        if(r === 'browse') browseLink.classList.add('active');
        else browseLink.classList.remove('active');
    }
    closePanels();

    document.getElementById('browseSection').style.display = r==='browse' ? 'block' : 'none';
    document.getElementById('businessPage').style.display = r==='business-page' ? 'block' : 'none';
    document.getElementById('sellSection').style.display = r==='sell' ? 'block' : 'none';
    document.getElementById('businessSection').style.display = r==='business' ? 'block' : 'none';
    document.getElementById('mySection').style.display = r==='my' ? 'block' : 'none';

    if(r==='browse') renderListings();
    if(r==='my') { renderMyListings(); renderMyOrders(); renderMyBusinesses(); }
    history.replaceState(null,'',`#${r}`);
}
window.addEventListener('hashchange', ()=> route(location.hash.slice(1)||'browse'));

function closePanels() {
    document.getElementById('profilePanel')?.classList.remove('open');
    document.getElementById('cartPanel')?.classList.remove('open'); 
    document.getElementById('overlay')?.classList.remove('open');
    closeSettingsModal(); // Ensure modal closes too
}

// Global click handler
document.addEventListener('click', e => {
    const a = e.target.closest('a[data-route]'); 
    if(a) { e.preventDefault(); route(a.dataset.route); }
    
    // Panel Triggers
    if(e.target.closest('#openProfile')) {
        document.getElementById('profilePanel').classList.add('open');
        document.getElementById('overlay').classList.add('open');
    }
    if(e.target.closest('#closeProfile')) document.getElementById('profilePanel').classList.remove('open');
    if(e.target.id === 'overlay') closePanels();
    
    if(e.target.closest('#openCart')) {
        document.getElementById('cartPanel').classList.add('open');
        document.getElementById('overlay').classList.add('open');
        renderCart();
    }
    if(e.target.closest('#closeCart')) document.getElementById('cartPanel').classList.remove('open');
    
    // Settings Triggers
    if(e.target.closest('#openSettingsBtn')) {
        document.getElementById('profilePanel').classList.remove('open'); // Close sidebar
        document.getElementById('settingsModal').style.display = 'flex';
        document.getElementById('settingsModal').showModal();
        loadUserProfile(); // Refresh form data
    }
});

window.closeSettingsModal = () => {
    const m = document.getElementById('settingsModal');
    m.style.display = 'none';
    m.close();
    // Re-open sidebar if we just closed settings? optional.
    // For now, let's just close everything to be clean.
    document.getElementById('overlay').classList.remove('open');
};


// ----- Browse & Marketplace Logic (Standard) -----
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
                             <div><div class="badge" style="margin-bottom:0.4rem;">${b.category}</div><h3 style="font-size:1.1rem; cursor:pointer;" onclick="openBusiness('${b.id}')">${escapeHtml(b.name)}</h3></div>
                             <button class="btn btn-outline" onclick="viewOwner('${b.id}')" style="padding:0.4rem;"><i class="ri-user-3-line"></i></button>
                        </div>
                        <div class="toolbar" style="margin-top:auto;"><button class="btn" style="width:100%" onclick="openBusiness('${b.id}')">View</button></div>
                    </div>
                </article>`).join('');
        }
    }
    let prodHTML = '';
    if(state.tabView !== 'businesses'){
        let items = LS.read(LS.keyProducts).slice();
        const catMap = {books:'Books', electronics:'Electronics'};
        if(catMap[state.tabView]) items = items.filter(i => i.category === catMap[state.tabView]);
        if(q) items = items.filter(i => JSON.stringify(i).toLowerCase().includes(q));
        if(state.cat) items = items.filter(i => i.category === state.cat);
        if(items.length){
            if(state.tabView === 'all' && bizHTML) prodHTML += `<h3 class="grid-header" style="margin-top:2rem; border-top:1px solid var(--stroke); padding-top:1.5rem;"><i class="ri-shopping-bag-3-line"></i> Marketplace Items</h3>`;
            prodHTML += items.map(i => `
            <article class="card">
                <img class="card__img" src="${i.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Item'}" />
                <div class="card__body">
                    <div class="badge">${i.category} • ${i.condition}</div>
                    <h3 style="font-size:1.05rem;">${escapeHtml(i.title)}</h3>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                        <div class="price">${fmt.format(i.price)}</div>
                        <div style="display:flex; gap:0.5rem;"><button class="btn btn-outline" onclick="openInquiry('${i.id}')"><i class="ri-chat-1-line"></i></button><button class="btn" onclick="addToCart('${i.id}')">Add</button></div>
                    </div>
                </div>
            </article>`).join('');
        }
    }
    listingsEl.innerHTML = bizHTML + prodHTML;
    document.getElementById('emptyListings').style.display = (bizHTML || prodHTML) ? 'none' : 'block';
}

// Business & Owner Views
window.openBusiness = (id) => {
    const b = LS.read(LS.keyBiz).find(x => x.id === id); if(!b) return;
    document.getElementById('bizHeader').innerHTML = `<h1 style="font-size:2rem; font-weight:800;">${escapeHtml(b.name)}</h1><p style="color:var(--muted);">${escapeHtml(b.description)}</p>`;
    const bizItems = LS.read(LS.keyProducts).filter(i => i.businessId === id);
    const grid = document.getElementById('bizItemsGrid');
    grid.innerHTML = bizItems.length ? bizItems.map(i=>`<article class="card"><div class="card__body"><h3>${escapeHtml(i.title)}</h3></div></article>`).join('') : '';
    document.getElementById('bizItemsEmpty').style.display = bizItems.length ? 'none' : 'block';
    route('business-page');
};
window.viewOwner = (id) => {
    const b = LS.read(LS.keyBiz).find(x => x.id === id); if(!b) return;
    document.getElementById('ownerInfo').innerHTML = `<h3 style="text-align:center">${escapeHtml(b.ownerName)}</h3>`;
    const m = document.getElementById('ownerModal'); m.style.display='flex'; m.showModal();
};
window.closeOwnerModal = () => { const m=document.getElementById('ownerModal'); m.style.display='none'; m.close(); };

// Standard Cart & Sell Logic
window.addToCart = (id) => { const c=LS.read(LS.keyCart); const r=c.find(x=>x.id===id); if(r)r.qty++; else c.push({id, qty:1}); LS.write(LS.keyCart, c); updateCart(); toast('Added'); };
function updateCart(){ 
    const c=LS.read(LS.keyCart); document.getElementById('cartCount').textContent=c.reduce((n,x)=>n+x.qty,0);
    document.getElementById('cartBody').innerHTML = c.map(x=>`<div>${x.id} (x${x.qty})</div>`).join('');
}
document.getElementById('closeCart').onclick = ()=> closePanels();
// Initialize
loadUserProfile(); // LOAD PROFILE ON START
updateCart();
route(location.hash.slice(1)||'browse');
