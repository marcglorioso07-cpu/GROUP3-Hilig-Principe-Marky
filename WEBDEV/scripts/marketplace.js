/* scripts/marketplace.js */

// ----- Storage -----
const LS = {
  keyProducts: 'slsu_products',
  keyCart: 'slsu_cart',
  keyOrders: 'slsu_orders',
  keyBiz: 'slsu_businesses',
  read(key){ return JSON.parse(localStorage.getItem(key)) || [] },
  write(key, val){ 
    try {
      localStorage.setItem(key, JSON.stringify(val)); 
    } catch (e) {
      if(e.name === 'QuotaExceededError') {
        alert("Storage full! Your images are too large. Please try smaller photos.");
      } else {
        console.error("Storage Error:", e);
      }
    }
  }
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
  if (!file || !(file instanceof File)) {
      resolve('');
      return;
  }
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => {
      console.error("Image conversion error:", error);
      resolve('');
  };
});

// ----- UNIVERSAL PREVIEW FUNCTION -----
// Used by both Logo and Menu items via onchange=""
window.previewSlot = (input, imgId, statusId = null) => {
  if (!(input.files && input.files[0])) return;
  
  const file = input.files[0];
  
  // Update the Text Status (if provided, like for the Logo)
  if(statusId) {
      const statusEl = document.getElementById(statusId);
      if(statusEl) {
          statusEl.textContent = file.name;
          statusEl.style.color = 'var(--accent)';
      }
  }

  // Update the Image Preview
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(imgId);
    if(img) {
      img.src = e.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// ----- Sell Item Preview Handler -----
// Since sell form is separate, we attach listener here
document.addEventListener('change', (e) => {
    if(e.target && e.target.id === 'sellFile' && e.target.files[0]) {
        const status = document.getElementById('sellFileStatus');
        if(status) {
            status.textContent = e.target.files[0].name;
            status.style.color = 'var(--accent)';
        }
    }
});


// ----- State & Routing -----
let state = { q:'', cat:'' };

function route(r){
  document.querySelectorAll('.nav-pill').forEach(a=> a.classList.remove('active'));
  document.querySelector(`.nav-pill[data-route="${r}"]`)?.classList.add('active');

  const show = (id, on) => { const el=document.getElementById(id); if(el) el.style.display = on ? 'block' : 'none'; };

  show('heroHeader', r === 'browse');
  show('browseSection', r==='browse');
  show('businessPage', r==='business-page');
  show('sellSection', r==='sell');
  show('businessSection', r==='business');
  show('mySection', r==='my');

  if(r==='browse') {
    renderCategoryIcons();
    renderFeatured(false);
    renderActiveSidebar();
    renderListings();
  }
  if(r==='my') {
    renderMyDashboard();
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

// ----- Featured & Active Shops -----
window.renderFeatured = (showAll = false) => {
  const biz = LS.read(LS.keyBiz).filter(b => b.status !== 'off');
  const container = document.getElementById('featuredBizRow');
  if(!container) return;

  const existingBtn = document.getElementById('seeAllBtnContainer');
  if(existingBtn) existingBtn.remove();

  if(!biz.length) {
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--muted); padding:1rem; border:1px dashed var(--stroke); border-radius:12px;">No businesses featured yet.</div>`;
    return;
  }

  const limit = 6;
  const itemsToShow = showAll ? biz : biz.slice(0, limit);

  container.innerHTML = itemsToShow.map(b => `
    <div class="biz-square-card" onclick="openBusiness('${b.id}')">
      <img class="biz-square-img" src="${b.logo || 'https://dummyimage.com/400x400/0f1620/111827.png&text=Biz'}" />
      <div class="biz-square-overlay">
        <div class="biz-square-name">${escapeHtml(b.name)}</div>
        <div style="font-size:0.8rem; color:var(--accent);">${escapeHtml(b.category)}</div>
      </div>
    </div>
  `).join('');

  if(biz.length > limit) {
    const btnContainer = document.createElement('div');
    btnContainer.id = 'seeAllBtnContainer';
    btnContainer.className = 'see-all-container';
    
    if (showAll) {
         btnContainer.innerHTML = `
          <button class="btn-see-all" onclick="renderFeatured(false)">
            Show Less <i class="ri-arrow-up-s-line"></i>
          </button>
        `;
    } else {
        btnContainer.innerHTML = `
          <button class="btn-see-all" onclick="renderFeatured(true)">
            Show All Shops (${biz.length}) <i class="ri-arrow-down-s-line"></i>
          </button>
        `;
    }
    container.parentNode.insertBefore(btnContainer, container.nextSibling);
  }
};

function renderActiveSidebar() {
  const biz = LS.read(LS.keyBiz).filter(b => b.status !== 'off');
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

// ----- Business Page Logic -----
window.openBusiness = (businessId) => {
    const biz = LS.read(LS.keyBiz).find(b => b.id === businessId);
    if (!biz) {
        toast("Business not found.");
        return;
    }

    const headerEl = document.getElementById('bizHeader');
    if(headerEl) {
        headerEl.innerHTML = `
            <div class="biz-header-card-alt">
                <img class="biz-header-logo-alt" src="${biz.logo || 'https://dummyimage.com/100x100/0f1620/111827.png&text=L'}" alt="${escapeHtml(biz.name)} Logo" />
                <div class="biz-header-info-alt">
                    <div class="biz-category-alt">${escapeHtml(biz.type === 'Service' ? 'Service Provider' : biz.category)}</div>
                    <h1 class="biz-title-alt">${escapeHtml(biz.name)}</h1>
                    <p class="biz-description-alt">${escapeHtml(biz.description || 'No description provided.')}</p>
                    <div class="biz-details-row-alt">
                        <span><i class="ri-map-pin-line"></i> ${escapeHtml(biz.location || 'N/A')}</span>
                        <span><i class="ri-phone-line"></i> ${escapeHtml(biz.contact)}</span>
                        ${biz.website ? `<span><i class="ri-link"></i> <a href="${biz.website}" target="_blank">Website</a></span>` : ''}
                    </div>
                    <button class="btn btn-owner-alt"><i class="ri-user-star-line"></i> Meet the Owner</button>
                </div>
            </div>
        `;
    }

    const servicesTitleEl = document.querySelector('#businessPage h3.section__header');
    if (servicesTitleEl) {
        servicesTitleEl.textContent = biz.type === 'Service' ? 'Our Services' : 'Our Menu';
    }

    const itemsGridEl = document.getElementById('bizItemsGrid');
    if(itemsGridEl) {
        renderListings(biz.id, itemsGridEl);
    }
    
    route('business-page');
};
window.openBusiness = openBusiness;

// ----- Listings -----
document.getElementById('runSearch')?.addEventListener('click', ()=>{
  state.q = document.getElementById('q')?.value.trim() || '';
  renderListings();
});

function itemTemplate(i){
  const biz = i.businessId ? LS.read(LS.keyBiz).find(b => b.id === i.businessId) : null;
  // Check if the business is closed OR if the item itself is marked off (sold out)
  const isSoldOut = (biz && biz.status === 'off') || (i.status === 'off');

  return `
  <article class="card ${isSoldOut ? 'sold-out' : ''}">
    <img class="card__img" src="${i.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Item'}" />
    ${isSoldOut ? '<div class="sold-out-overlay">SOLD OUT</div>' : ''}
    <div class="card__body">
      <div class="badge">${escapeHtml(i.category)} • ${escapeHtml(i.condition || 'New')}</div>
      <h3>${escapeHtml(i.title)}</h3>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
        <div class="price">${fmt.format(i.price)}</div>
        <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.9rem;" onclick="addToCart('${i.id}')" ${isSoldOut ? 'disabled' : ''}>
          <i class="ri-add-line"></i>
        </button>
      </div>
    </div>
  </article>`;
}

function renderListings(businessId = null, targetContainer = null){
  const listingsEl = targetContainer || document.getElementById('listings');
  const empty = document.getElementById('emptyListings');
  
  if(!listingsEl || (listingsEl === document.getElementById('listings') && !empty)) return;

  listingsEl.innerHTML = '';
  if (listingsEl === document.getElementById('listings')) empty.style.display = 'none';

  let items = LS.read(LS.keyProducts);

  if(businessId) {
    items = items.filter(i => i.businessId === businessId);
  } else {
    items = items.filter(i => !i.businessId);

    if(state.q) {
      const q = state.q.toLowerCase();
      items = items.filter(i => (i.title||'').toLowerCase().includes(q)); 
    }
    if(state.cat) {
      items = items.filter(i => i.category === state.cat);
    }
  }

  if(items.length > 0) {
    listingsEl.innerHTML = items.map(itemTemplate).join('');
  } else {
    if (listingsEl === document.getElementById('listings')) {
        empty.style.display = 'block';
    } else if (targetContainer) {
        listingsEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding:2rem; border:1px dashed var(--stroke); border-radius:12px; margin-top:1rem;">
                                  <i class="ri-menu-line" style="font-size: 2rem; margin-bottom: 0.5rem; color:var(--muted);"></i>
                                  <p>This business hasn't listed any items yet.</p>
                                </div>`;
    }
  }
}

// ----- DASHBOARD LOGIC -----
const PROFILE_KEY = 'slsu_profile';

function getOwnerName() {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    return profile ? profile.username : 'Anonymous User';
}

window.switchBusinessStatus = (businessId) => {
    const businesses = LS.read(LS.keyBiz);
    const index = businesses.findIndex(b => b.id === businessId);

    if (index > -1) {
        const currentStatus = businesses[index].status;
        businesses[index].status = currentStatus === 'on' ? 'off' : 'on';
        LS.write(LS.keyBiz, businesses);
        
        // --- ADDED THIS LINE FOR CLEARER FEEDBACK ---
        const statusText = businesses[index].status === 'on' ? 'Active' : 'Sold Out / Closed';
        toast(`Business is now: ${statusText}`);
        
        renderMyDashboard();
        renderFeatured();
        renderActiveSidebar();
        renderListings(); 
    }
}

// NEW FUNCTION: Toggle status for a single item
window.switchItemStatus = (itemId) => {
    const products = LS.read(LS.keyProducts);
    const index = products.findIndex(i => i.id === itemId);

    if (index > -1) {
        // Ensure the status field exists, defaulting to 'on' if missing
        const currentStatus = products[index].status || 'on'; 
        products[index].status = currentStatus === 'on' ? 'off' : 'on';
        LS.write(LS.keyProducts, products);
        
        const statusText = products[index].status === 'on' ? 'Available' : 'SOLD OUT';
        toast(`Item is now: ${statusText}`);
        
        renderMyDashboard();
        renderListings(); 
    }
}


function renderMyDashboard() {
    const ownerName = getOwnerName();
    
    const myBusinesses = LS.read(LS.keyBiz).filter(b => b.ownerName === ownerName);
    
    // Ensure all existing items have a status, default to 'on' if missing
    let myListings = LS.read(LS.keyProducts)
        .filter(i => i.listedBy === ownerName && !i.businessId)
        .map(i => ({ ...i, status: i.status || 'on' }));
    // Save the possibly updated list back
    LS.write(LS.keyProducts, myListings); 

    const businessBody = document.getElementById('myBizBody');
    const businessEmpty = document.getElementById('myBizEmpty');
    const listingsBody = document.getElementById('myListingsBody');
    const listingsEmpty = document.getElementById('myListingsEmpty');
    
    if (businessBody) {
        businessBody.innerHTML = ''; 
        if (myBusinesses.length > 0) {
            const rows = myBusinesses.map(b => `
                <tr>
                    <td onclick="openBusiness('${b.id}')" style="cursor:pointer;">
                        <img src="${b.logo || 'https://dummyimage.com/50x50/0f1620/111827.png&text=B'}" style="width:35px; height:35px; border-radius:8px; object-fit:cover;">
                    </td>
                    <td onclick="openBusiness('${b.id}')" style="cursor:pointer;">
                      <b style="color:white; text-decoration:underline; text-decoration-color:var(--muted);">${escapeHtml(b.name)}</b><br>
                      <span style="font-size:0.8rem; color:var(--muted);">${escapeHtml(b.category)}</span>
                    </td>
                    <td>${b.type === 'Service' ? 'Service' : 'Retail'}</td>
                    <td>
                        <!-- BUSINESS TOGGLE SWITCH -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:0.2rem;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="toggle-${b.id}" ${b.status === 'on' ? 'checked' : ''} onchange="switchBusinessStatus('${b.id}')">
                                <label for="toggle-${b.id}"></label>
                            </div>
                            <!-- Status Label below switch -->
                            <span style="font-size:0.7rem; color:${b.status === 'on' ? 'var(--accent)' : 'red'}; font-weight:600;">
                                ${b.status === 'on' ? 'ACTIVE' : 'CLOSED'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="openBusiness('${b.id}')">View</button>
                    </td>
                </tr>
            `).join('');
            businessBody.innerHTML = rows;
            if (businessEmpty) businessEmpty.style.display = 'none';
        } else {
            if (businessEmpty) businessEmpty.style.display = 'block';
        }
    }
    
    if (listingsBody) {
        listingsBody.innerHTML = '';
        if (myListings.length > 0) {
            const rows = myListings.map(i => `
                <tr>
                    <td><img src="${i.image || 'https://dummyimage.com/50x50/0f1620/111827.png&text=I'}" style="width:35px; height:35px; border-radius:8px; object-fit:cover;"></td>
                    <td><b>${escapeHtml(i.title)}</b></td>
                    <td style="color:var(--muted);">${fmt.format(i.price)}</td>
                    <td>${escapeHtml(i.category)}</td>
                    <td>
                        <!-- ITEM TOGGLE SWITCH -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:0.2rem;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="toggle-item-${i.id}" ${i.status === 'on' ? 'checked' : ''} onchange="switchItemStatus('${i.id}')">
                                <label for="toggle-item-${i.id}"></label>
                            </div>
                            <!-- Status Label below switch -->
                            <span style="font-size:0.7rem; color:${i.status === 'on' ? 'var(--accent)' : 'red'}; font-weight:600;">
                                ${i.status === 'on' ? 'AVAILABLE' : 'SOLD OUT'}
                            </span>
                        </div>
                    </td>
                    <td>${escapeHtml(i.condition)}</td>
                    <td><button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Edit</button></td>
                </tr>
            `).join('');
            listingsBody.innerHTML = rows;
            if (listingsEmpty) listingsEmpty.style.display = 'none';
        } else {
             if (listingsEmpty) listingsEmpty.style.display = 'block';
        }
    }
    
    const activeTab = document.querySelector('#myTabs .tab.active')?.getAttribute('data-tab') || 'listings';
    window.switchMyTab(activeTab);
}

window.switchMyTab = (tabId) => {
    const tabsContent = ['myListings', 'myOrders', 'myBusinesses'];
    tabsContent.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });

    const selectedContent = document.getElementById(`my${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (selectedContent) selectedContent.style.display = 'block';

    document.querySelectorAll('#myTabs .tab').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
};

function setupDashboardTabs() {
    document.querySelectorAll('#myTabs .tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.getAttribute('data-tab');
            if (tabId) window.switchMyTab(tabId);
        });
    });
}

// ----- Business Form Handler (FIXED) -----
document.addEventListener('submit', async (e) => {
  if (e.target && e.target.id === 'bizForm') {
    e.preventDefault();
    const form = e.target;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processing...'; }
    
    toast("Processing images...");

    try {
        const data = Object.fromEntries(new FormData(form));
        const businesses = LS.read(LS.keyBiz);
        const products = LS.read(LS.keyProducts);
        const ownerName = getOwnerName(); 

        // --- FIXED: Find Logo Input Smartly ---
        // Try ID "bizFile", fallback to looking for input[type=file] that ISN'T a menu file
        let bizFileInput = document.getElementById('bizFile');
        if (!bizFileInput) {
             bizFileInput = form.querySelector('input[type="file"]:not([id^="ms_file_"])');
        }
        
        let bizLogoData = '';
        if(bizFileInput && bizFileInput.files[0]) {
            bizLogoData = await convertToBase64(bizFileInput.files[0]);
        }

        const newBiz = {
            id: uid(),
            name: data.name,
            category: data.category,
            type: data.type,
            ownerName: ownerName, 
            ownerAge: data.ownerAge,
            description: data.description,
            logo: bizLogoData, 
            contact: data.contact,
            location: data.location,
            website: data.website,
            created: Date.now(),
            status: 'on',
        };

        // --- FIXED: Loop Menu Items with CORRECT ID (ms_file_) ---
        const initialItems = [];
        let menuSlotCount = 4;
        for(let i = 1; i <= menuSlotCount; i++) { 
            const title = data[`m_title_${i}`]?.trim();
            const price = parseFloat(data[`m_price_${i}`]);
            
            // !! THIS WAS THE BUG: CHANGED m_file_ TO ms_file_ !!
            const menuFileInput = document.getElementById(`ms_file_${i}`);
            
            let menuImageData = '';
            if(menuFileInput && menuFileInput.files[0]) {
                menuImageData = await convertToBase64(menuFileInput.files[0]);
            }
            
            if (title && price > 0) {
                initialItems.push({
                    id: uid(),
                    businessId: newBiz.id, 
                    title: title,
                    price: price,
                    category: newBiz.category, 
                    condition: newBiz.type === 'Service' ? 'Service' : 'New / Fresh',
                    description: data[`m_desc_${i}`] || '',
                    image: menuImageData, 
                    contact: newBiz.contact,
                    listedBy: ownerName, 
                    created: Date.now(),
                    status: 'on' // Default status for new items
                });
            }
        }
        
        if (!newBiz.name) { throw new Error("Please fill in business name."); }

        LS.write(LS.keyBiz, [...businesses, newBiz]);
        LS.write(LS.keyProducts, [...products, ...initialItems]);

        toast(`🚀 Business "${newBiz.name}" Launched!`);
        form.reset();
        
        // Reset Visual Status Text & Preview
        const logoStatus = document.getElementById('bizFileStatus');
        const logoPreview = document.getElementById('bizLogoPreview');
        if(logoStatus) { logoStatus.textContent = "No file chosen"; logoStatus.style.color = 'var(--muted)'; }
        if(logoPreview) { logoPreview.src = ''; logoPreview.style.display = 'none'; }
        
        // Reset Menu Previews
        for(let i=1; i<=4; i++) {
            const mp = document.getElementById(`ms_prev_${i}`);
            if(mp) { mp.src = ''; mp.style.display = 'none'; }
        }
        
        route('browse');

    } catch (error) {
        console.error(error);
        toast(error.message || "Failed to create business.");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Launch Business'; }
    }
  }
});

// ----- Sell Item Handler -----
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'sellForm') {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processing...'; }
        
        toast("Processing image...");

        try {
            const data = Object.fromEntries(new FormData(form));
            const products = LS.read(LS.keyProducts);
            const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');

            const sellFileInput = document.getElementById('sellFile');
            let sellImageData = '';
            if(sellFileInput && sellFileInput.files[0]) {
                sellImageData = await convertToBase64(sellFileInput.files[0]);
            }

            const newProduct = {
                id: uid(),
                title: data.title,
                price: parseFloat(data.price),
                category: data.category,
                condition: data.condition,
                description: data.description || '',
                image: sellImageData, 
                contact: data.contact,
                listedBy: profile ? profile.username : 'Anonymous User',
                created: Date.now(),
                status: 'on' // Default status for new items
            };

            if (!newProduct.title) { throw new Error("Please fill title."); }

            LS.write(LS.keyProducts, [...products, newProduct]);
            toast(`✅ Item "${newProduct.title}" Published!`);
            form.reset();
            
            // Reset Visual Status Text
            const sellStatus = document.getElementById('sellFileStatus');
            if(sellStatus) { sellStatus.textContent = "No file chosen"; sellStatus.style.color = 'var(--muted)'; }

            route('browse');
        } catch (error) {
            console.error(error);
            toast(error.message || "Failed to list item.");
        } finally {
             if(submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="ri-upload-2-line"></i> Publish'; }
        }
    }
});

// ----- Init -----
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

document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const newName = document.getElementById('displayNameInput')?.value.trim();
    
    if (profile && newName) {
        profile.username = newName;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        const avatarEl = document.getElementById('profileAvatarInitial');
        if (avatarEl) avatarEl.textContent = newName.charAt(0).toUpperCase();
        toast('Profile updated successfully!');
    }
});

function initializeProfile() {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const token = localStorage.getItem('slsu_token');
    
    if (!profile || token !== 'active') return;

    const initial = (profile.username || 'U').toUpperCase().charAt(0);
    const displayName = profile.username || 'Student User';
    const email = profile.email || 'N/A';
    
    const avatarEl = document.getElementById('profileAvatarInitial');
    if (avatarEl) avatarEl.textContent = initial;

    const displayNameEl = document.querySelector('.profile-display-name');
    if (displayNameEl) displayNameEl.textContent = displayName;

    const emailEl = document.querySelector('.profile-email');
    if (emailEl) emailEl.textContent = email;
    
    const displayNameInput = document.getElementById('displayNameInput');
    if(displayNameInput) displayNameInput.value = displayName;
}

initializeProfile();
setupDashboardTabs();
renderListings();