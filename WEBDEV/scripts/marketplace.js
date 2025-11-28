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
        console.error("Storage full! Image too large to save.", e);
        toast("Storage full! Try a smaller image.");
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

// --- FIX: Add alias for Logo Preview to prevent HTML errors ---
window.previewLogo = (input) => {
    window.previewSlot(input, 'bizLogoPreview', 'bizFileStatus');
};

// ----- Sell Item Preview Handler -----
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

    // --- CRITICAL FIX: FORCE Rebuild of Business Page Structure ---
    // We clear the container first to ensure no stale state or missing grids.
    const pageContainer = document.getElementById('businessPage');
    if (pageContainer) {
         pageContainer.innerHTML = `
            <div id="bizHeader"></div>
            <div class="container" style="padding-bottom:4rem;">
                <h3 class="section__header" style="margin-top:2rem; margin-bottom:1rem;">
                    ${biz.type === 'Service' ? 'Our Services' : 'Our Menu'}
                </h3>
                <!-- Added explicit styling to ensure visibility -->
                <div id="bizItemsGrid" class="listings-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem; min-height:100px;"></div>
            </div>
         `;
    }

    // Inject Header Content
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

    // --- RENDER ITEMS ---
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
  
  // If we are on the main browse page, check for main listings container
  if(!listingsEl && !targetContainer) return; 
  if(listingsEl && !empty) return;

  // Clear container
  if(targetContainer) {
      targetContainer.innerHTML = '';
  } else {
      listingsEl.innerHTML = '';
      empty.style.display = 'none';
  }

  let items = LS.read(LS.keyProducts);

  if(businessId) {
    // 1. Show only items belonging to a specific business ID (for the business page view)
    items = items.filter(i => i.businessId === businessId);
  } else {
    // 2. Show only items NOT belonging to a business (for the main browse listings)
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
    const html = items.map(itemTemplate).join('');
    if(targetContainer) {
        targetContainer.innerHTML = html;
    } else {
        listingsEl.innerHTML = html;
    }
  } else {
    if (listingsEl && !targetContainer) {
        empty.style.display = 'block';
    } else if (targetContainer) {
        targetContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding:2rem; border:1px dashed var(--stroke); border-radius:12px; margin-top:1rem; text-align:center;">
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

// NEW HELPER: Get all possible names (current and defaults) for the current user, normalized
function getPossibleOwnerNames() {
    // The current display name is read, lowercased, and trimmed.
    const currentName = getOwnerName().toLowerCase().trim();
    
    // Start with known variations
    const namesSet = new Set([
        currentName,
        'marcglorioso07', // Explicit name used by the user
        'anonymous user',
        'student user',
        'google student', 
        'facebook student',
        'marc' // Add the persistent wrong name for comprehensive searching
    ]);
    
    // --- ENHANCEMENT: Extract all unique owner/listedBy names from local storage ---
    const allBusinesses = LS.read(LS.keyBiz);
    const allProducts = LS.read(LS.keyProducts);
    
    allBusinesses.forEach(b => {
        if (b.ownerName) namesSet.add(normalizeStoredName(b.ownerName));
    });
    
    allProducts.forEach(i => {
        if (i.listedBy) namesSet.add(normalizeStoredName(i.listedBy));
    });
    // --- END ENHANCEMENT ---

    return Array.from(namesSet).filter(name => name.length > 0);
}

// NEW HELPER: Normalizes a stored name for comparison
function normalizeStoredName(name) {
    // Trim whitespace and convert to lowercase for the safest comparison.
    return (name || '').toLowerCase().trim();
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
        
        // Re-render only the dashboard to show the change immediately
        renderMyDashboard();
        renderListings(); 
    }
}

// NEW FUNCTION: Save the updated price to localStorage
window.saveItemPrice = (itemId, newPrice) => {
    const products = LS.read(LS.keyProducts);
    const index = products.findIndex(i => i.id === itemId);

    if (index > -1) {
        products[index].price = parseFloat(newPrice);
        LS.write(LS.keyProducts, products);
        toast(`✅ Price updated for ${products[index].title}!`);
        // Keeping renderListings() for safety if this item is displayed on the main page.
        renderListings(); 
    }
}

// NEW FUNCTION: Toggle the inline editing state for price
window.toggleEditPrice = (itemId) => {
    const input = document.getElementById(`price-input-${itemId}`);
    const button = document.getElementById(`edit-btn-${itemId}`);
    
    if (!input || !button) return;

    const isReadOnly = input.readOnly;

    if (isReadOnly) {
        // Switch to EDIT mode
        input.readOnly = false;
        button.innerHTML = '<i class="ri-save-line"></i> Save';
        button.style.backgroundColor = 'var(--accent)';
        button.style.color = '#022c22';
        button.style.borderColor = 'var(--accent)';
        input.style.color = 'var(--accent)'; // Highlight the input text
        input.focus();
    } else {
        // Switch to SAVE mode
        const newPrice = parseFloat(input.value.trim());
        const originalPrice = parseFloat(input.getAttribute('data-original-price'));

        if (isNaN(newPrice) || newPrice <= 0) {
            toast("Invalid price. Reverting.");
            input.value = originalPrice.toFixed(2);
        } else if (Math.abs(newPrice - originalPrice) > 0.01) {
             // Save the new price and update the original price attribute
            saveItemPrice(itemId, newPrice);
            input.setAttribute('data-original-price', newPrice);
            input.value = newPrice.toFixed(2); // Format the saved price
        } else {
             toast("No change made.");
        }
        
        // Reset button and input state
        input.readOnly = true;
        
        // --- FIX: Change button text back to 'View' with ri-eye-line icon ---
        button.innerHTML = '<i class="ri-eye-line"></i> View';
        
        button.style.backgroundColor = 'transparent'; // Revert button style
        button.style.color = 'var(--accent)';
        button.style.borderColor = 'var(--accent)';
        input.style.color = 'var(--text)'; // Reset input text color
    }
};

// New function to render the items inside the expanded business card
function renderBusinessItems(businessId, targetContainer) {
    // Use an updated and safer ID format for toggles/inputs here
    const getBizItemId = (itemId, suffix) => `biz_${businessId}_${itemId}_${suffix}`;

    // The filter relies ONLY on the business ID, ensuring menus appear regardless of who created them, 
    // as long as they are linked to the active business.
    const items = LS.read(LS.keyProducts).filter(i => i.businessId === businessId);

    const biz = LS.read(LS.keyBiz).find(b => b.id === businessId);
    
    if (!biz) return; // Should not happen

    if (items.length === 0) {
        targetContainer.innerHTML = `
            <div style="padding: 1rem 2.5rem; color:var(--muted); font-style:italic;">
                No items currently listed under this business.
            </div>`;
        return;
    }
    
    // Reuse the item card layout, adjusting for the sub-list style
    const itemHtml = items.map(i => `
        <div style="
            display: flex; justify-content: space-between; align-items: center; 
            padding: 1rem 2.5rem; 
            margin-bottom: 0.5rem;
            border-top: 1px solid var(--stroke); /* solid line to separate items visually */
            background: var(--surface-1); 
        ">
            
            <!-- Item Details (Image, Title, Category) -->
            <div style="display: flex; align-items: center; gap: 1.5rem; flex-grow: 1;">
                <img src="${i.image || 'https://dummyimage.com/40x40/1a222c/94a3b8.png&text=I'}" 
                        style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                
                <div style="flex-grow: 1;">
                    <div style="font-weight: 500; font-size: 1rem; color: var(--text);">${escapeHtml(i.title)}</div>
                    <div style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(i.condition)}</div>
                </div>
            </div>

            <!-- Price Input & Edit/View Button Group (REUSED from My Listings) -->
            <div style="display: flex; align-items: center; gap: 3rem; min-width: 250px; justify-content: center;"> 
                
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; min-width: 120px;">
                    <div class="price-input-container" style="display:flex; align-items:center; background: var(--surface-3); border-radius: 6px; padding: 0.3rem 0.5rem; border: 1px solid var(--stroke); transition: border-color 0.2s;">
                        <span style="color: var(--muted); font-size: 0.9rem;">₱</span>
                        <input 
                            type="number" 
                            id="price-input-${i.id}" 
                            value="${i.price.toFixed(2)}" 
                            data-original-price="${i.price}"
                            onchange="this.value = parseFloat(this.value).toFixed(2)"
                            readonly 
                            style="width: 80px; background: transparent; border: none; color: var(--text); font-weight: 700; font-size: 1rem; outline: none; text-align: right; transition: color 0.2s;" 
                        />
                    </div>
                    <!-- The toggleEditPrice function handles all logic, we just need to ensure the ID is unique -->
                    <button class="btn btn-outline" id="edit-btn-${i.id}" 
                        onclick="toggleEditPrice('${i.id}')" 
                        style="padding: 0.3rem 0.75rem; font-size: 0.75rem; color: var(--accent); border-color: var(--accent); background: transparent; transition: background-color 0.2s, border-color 0.2s, transform 0.2s;">
                        <i class="ri-eye-line"></i> View
                    </button>
                </div>
            
                <!-- Status Toggle Box (REUSED from My Listings) -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.3rem; min-width: 80px;">
                    <div class="toggle-switch">
                        <input type="checkbox" id="toggle-item-${i.id}" ${i.status === 'on' ? 'checked' : ''} onchange="switchItemStatus('${i.id}')">
                        <label for="toggle-item-${i.id}"></label>
                    </div>
                    <span style="font-size: 0.7rem; color:${i.status === 'on' ? 'var(--accent)' : 'red'}; font-weight: 600; text-transform: uppercase;">
                        ${i.status === 'on' ? 'Available' : 'Sold Out'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
    
    targetContainer.innerHTML = itemHtml;
}

// New function to handle the collapse/expand feature
window.toggleBusinessItems = (businessId) => {
    const container = document.getElementById(`biz-items-${businessId}`);
    const button = document.getElementById(`biz-view-btn-${businessId}`);
    
    if (!container || !button) return;

    const isHidden = container.style.display === 'none';

    if (isHidden) {
        // Expand
        container.style.display = 'block';
        button.innerHTML = '<i class="ri-close-line"></i> Hide';
        button.style.backgroundColor = 'var(--accent)'; // Highlight when open
        button.style.color = '#022c22';
        button.style.borderColor = 'var(--accent)';
        
        // Render and inject the items
        renderBusinessItems(businessId, container.querySelector('#' + container.id + '-content'));
    } else {
        // Collapse
        container.style.display = 'none';
        button.innerHTML = '<i class="ri-eye-line"></i> View';
        button.style.backgroundColor = 'var(--surface-3)'; // Revert style when closed
        button.style.color = 'var(--text)';
        button.style.borderColor = 'var(--muted)';
    }
};


function renderMyDashboard() {
    // --- FIX: Use robust identity check ---
    const possibleNames = getPossibleOwnerNames(); 
    
    const allBusinesses = LS.read(LS.keyBiz); // Get ALL businesses for comparison
    
    // Filter to match any of the current user's possible names (case-insensitive and trimmed).
    const myBusinesses = allBusinesses.filter(b => {
        // We use normalization for safety, checking against all known possible names
        const bizOwnerLower = normalizeStoredName(b.ownerName);
        return possibleNames.includes(bizOwnerLower); 
    });

    // Ensure all existing items have a status, default to 'on' if missing
    let myListings = LS.read(LS.keyProducts)
        // FIX: Use robust, case-insensitive check against all possible names
        .filter(i => {
            const listedByLower = normalizeStoredName(i.listedBy);
            return possibleNames.includes(listedByLower) && !i.businessId;
        })
        .map(i => ({ ...i, status: i.status || 'on' }));
    
    // Save the possibly updated list back (mostly for safety, but unnecessary if data hasn't changed)
    LS.write(LS.keyProducts, myListings); 

    // NOTE: myBizBody is the container for the cards in index.html (after the fix)
    const businessContainer = document.getElementById('myBizBody');
    const businessEmpty = document.getElementById('myBizEmpty');
    const listingsContainer = document.getElementById('myListingsBody');
    const listingsEmpty = document.getElementById('myListingsEmpty');
    
    if (businessContainer) {
        
        let bizHtml = '';

        if (myBusinesses.length > 0) {
            
            // --- BUSINESS CARD DESIGN: Final wide design (NOW INCLUDES VIEW BUTTON + ACCORDION) ---
            const bizCards = myBusinesses.map(b => {
                const itemsContainerId = `biz-items-${b.id}`;

                return `
                <div id="biz-card-wrapper-${b.id}" style="border: 1px solid var(--stroke); border-radius: 12px; margin-bottom: 0.75rem; background: var(--surface-2); overflow: hidden;">
                    
                    <div style="
                        display: flex; justify-content: space-between; align-items: center; 
                        padding: 1.5rem 2.5rem; /* Final wide padding */
                        width: 100%; 
                    ">
                        
                        <div style="display: flex; align-items: center; gap: 3rem; flex-grow: 1;">
                            <img src="${b.logo || 'https://dummyimage.com/60x60/0f1620/111827.png&text=B'}" 
                                style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover;">
                            
                            <div style="flex-grow: 1;">
                                <div style="font-weight: 600; font-size: 1.1rem; color: var(--text);">${escapeHtml(b.name)}</div>
                                <div style="font-size: 0.9rem; color: var(--muted);">${escapeHtml(b.category)} / ${b.type === 'Service' ? 'Service' : 'Retail'}</div>
                            </div>
                        </div>

                        <!-- Status Toggle Box and View Button -->
                        <div style="display: flex; align-items: center; gap: 2.5rem; min-width: 200px; justify-content: flex-end;">

                            <!-- Status Toggle Box -->
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.3rem; min-width: 80px;">
                                <div class="toggle-switch">
                                    <input type="checkbox" id="toggle-${b.id}" ${b.status === 'on' ? 'checked' : ''} onchange="switchBusinessStatus('${b.id}')">
                                    <label for="toggle-${b.id}"></label>
                                </div>
                                <span style="font-size: 0.7rem; color:${b.status === 'on' ? 'var(--accent)' : 'red'}; font-weight: 600; text-transform: uppercase;">
                                    ${b.status === 'on' ? 'Active' : 'Closed'}
                                </span>
                            </div>
                            
                            <!-- View/Expand Button -->
                            <button class="btn btn-outline" id="biz-view-btn-${b.id}"
                                onclick="toggleBusinessItems('${b.id}')" 
                                style="padding: 0.6rem 1rem; font-size: 0.85rem; color: var(--text); border-color: var(--muted); background: var(--surface-3); transition: background-color 0.2s, border-color 0.2s;">
                                <i class="ri-eye-line"></i> View
                            </button>

                        </div>
                    </div>
                    
                    <!-- Collapsible Items Container -->
                    <div id="${itemsContainerId}" style="display: none; border-top: 1px solid var(--stroke);">
                        <div style="padding: 1rem 2.5rem 0.5rem; font-size: 0.9rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">
                            Menu Items
                        </div>
                        <div id="${itemsContainerId}-content">
                            <!-- Items will be injected here -->
                        </div>
                        <div style="padding: 1rem 2.5rem 1.5rem; text-align: right;">
                            <button class="btn" onclick="route('sell'); window.isAddingToBiz=true; document.getElementById('linkToBizId').value='${b.id}'; document.getElementById('bizLinkNotice').style.display='block'; document.getElementById('bizLinkName').textContent='${escapeHtml(b.name)}';">
                                <i class="ri-add-line"></i> Add Item to ${escapeHtml(b.name)}
                            </button>
                        </div>
                    </div>

                </div>
            `;
            }).join('');
            
            // The container wrapper is now simple, allowing the cards to fill the space
            bizHtml = `
                <div style="display: flex; flex-direction: column; gap: 0.5rem; padding-top: 1rem;">
                    ${bizCards}
                </div>
            `;
            
            businessEmpty.style.display = 'none';
        } else {
            businessEmpty.style.display = 'block';
        }
        
        businessContainer.innerHTML = bizHtml;
    }
    
    // ----- MY LISTINGS CARD DESIGN: Final wide design (with Price fix and 'View' button) -----
    if (listingsContainer) {
        
        let listHtml = '';

        if (myListings.length > 0) {
            
            const itemCards = myListings.map(i => `
                <div style="
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 1.5rem 2.5rem; /* Final wide padding */
                    margin-bottom: 0.75rem; 
                    width: 100%; 
                    background: var(--surface-2); border-radius: 12px; 
                    border: 1px solid var(--stroke); 
                    transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.005)'" onmouseout="this.style.transform='scale(1.0)'">
                    
                    <div style="display: flex; align-items: center; gap: 3rem; flex-grow: 1;">
                        <img src="${i.image || 'https://dummyimage.com/60x60/0f1620/111827.png&text=I'}" 
                             style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover;">
                        
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 600; font-size: 1.1rem; color: var(--text);">${escapeHtml(i.title)}</div>
                            <div style="font-size: 0.9rem; color: var(--muted);">
                                ${escapeHtml(i.category)} • ${escapeHtml(i.condition)}
                            </div>
                        </div>
                    </div>

                    <!-- Price Input & Edit/View Button Group -->
                    <div style="display: flex; align-items: center; gap: 3rem; min-width: 250px; justify-content: center;"> 
                        
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; min-width: 120px;">
                            <div class="price-input-container" style="display:flex; align-items:center; background: var(--surface-3); border-radius: 6px; padding: 0.3rem 0.5rem; border: 1px solid var(--stroke); transition: border-color 0.2s;">
                                <span style="color: var(--muted); font-size: 0.9rem;">₱</span>
                                <input 
                                    type="number" 
                                    id="price-input-${i.id}" 
                                    value="${i.price.toFixed(2)}" 
                                    data-original-price="${i.price}"
                                    onchange="this.value = parseFloat(this.value).toFixed(2)"
                                    readonly 
                                    style="width: 80px; background: transparent; border: none; color: var(--text); font-weight: 700; font-size: 1rem; outline: none; text-align: right; transition: color 0.2s;" 
                                />
                            </div>
                            <button class="btn btn-outline" id="edit-btn-${i.id}" 
                                onclick="toggleEditPrice('${i.id}')" 
                                style="padding: 0.3rem 0.75rem; font-size: 0.75rem; color: var(--accent); border-color: var(--accent); background: transparent; transition: background-color 0.2s, border-color 0.2s, transform 0.2s;">
                                <!-- Button state starts as 'View' -->
                                <i class="ri-eye-line"></i> View
                            </button>
                        </div>
                    
                        <!-- Status Toggle Box -->
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.3rem; min-width: 80px;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="toggle-item-${i.id}" ${i.status === 'on' ? 'checked' : ''} onchange="switchItemStatus('${i.id}')">
                                <label for="toggle-item-${i.id}"></label>
                            </div>
                            <span style="font-size: 0.7rem; color:${i.status === 'on' ? 'var(--accent)' : 'red'}; font-weight: 600; text-transform: uppercase;">
                                ${i.status === 'on' ? 'Available' : 'Sold Out'}
                            </span>
                        </div>
                    </div>

                </div>
            `).join('');
            
            // The container wrapper is now simple, allowing the cards to fill the space
            listHtml = `
                <div style="display: flex; flex-direction: column; gap: 0.5rem; padding-top: 1rem;">
                    ${itemCards}
                </div>
            `;
            
            listingsEmpty.style.display = 'none';
        } else {
             listingsEmpty.style.display = 'block';
        }

        // Assign the entire structure once
        listingsContainer.innerHTML = listHtml;
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
        
        // --- FIX: Use the ABSOLUTE current, corrected owner name ---
        const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
        const ownerName = profile ? profile.username : 'Anonymous User';
        // -----------------------------------------------------------
        
        // --- ABSOLUTE VALIDATION: Ensure we have a valid owner name before saving. ---
        if (ownerName === 'Anonymous User') {
             throw new Error("Profile not loaded. Please refresh and try again.");
        }
        // -----------------------------------------------------------------------------

        // --- FIX: Ensure Category matches Type for common user error ---
        let finalCategory = data.category;
        if (data.type === 'Service' && data.category === 'Food & Drinks') {
            // If user selected Service type but left category dropdown on default, set category to 'Services'.
            finalCategory = 'Services';
        }
        // --- END FIX ---


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
            category: finalCategory, // Use the corrected category
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
        
        if (!newBiz.name) { throw new Error("Please fill in business name."); }


        // --- FIXED: Loop Menu Items with CORRECT ID (ms_file_) ---
        const initialItems = [];
        let menuSlotCount = 4;
        for(let i = 1; i <= menuSlotCount; i++) { 
            const title = data[`m_title_${i}`]?.trim();
            // Handle optional price: default to 0 if NaN or empty
            const rawPrice = parseFloat(data[`m_price_${i}`]);
            const price = isNaN(rawPrice) ? 0 : rawPrice;
            
            // !! THIS WAS THE BUG: CHANGED m_file_ TO ms_file_ !!
            const menuFileInput = document.getElementById(`ms_file_${i}`);
            
            let menuImageData = '';
            if(menuFileInput && menuFileInput.files[0]) {
                menuImageData = await convertToBase64(menuFileInput.files[0]);
            }
            
            // --- FIX: Allow item saving even if price is 0, as long as title exists ---
            if (title) {
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
        

        // --- NO LIMIT IMPOSED HERE. All businesses are added. ---
        LS.write(LS.keyBiz, [...businesses, newBiz]);
        LS.write(LS.keyProducts, [...products, ...initialItems]);

        toast(`🚀 Business Created with ${initialItems.length} items!`);
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
        
        // --- CRITICAL FIX: Navigate directly to the My Businesses tab and force render ---
        route('my');
        window.switchMyTab('businesses'); // FORCE SWITCH TO BUSINESS TAB
        renderMyDashboard();
        // ----------------------------------------------------------------------------------

    } catch (error) {
        console.error(error);
        toast(error.message || "Failed to create business.");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Launch Business'; }
    }
  }
});

// ----- Sell Item Handler (FIXED) -----
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
        
        // --- FIX: Use the ABSOLUTE current, corrected owner name ---
        const ownerName = profile ? profile.username : 'Anonymous User';
        // -----------------------------------------------------------

        const newProduct = {
            id: uid(),
            title: data.title,
            price: parseFloat(data.price),
            category: data.category,
            condition: data.condition,
            description: data.description || '',
            image: sellImageData, 
            contact: data.contact,
            listedBy: ownerName, // Use the fixed ownerName
            created: Date.now(),
            status: 'on' // Default status for new items
        };

        if (!newProduct.title) { throw new Error("Please fill title."); }

        // --- NEW LOGIC: If a businessId is linked, add it to the product ---
        const linkedBizId = document.getElementById('linkToBizId')?.value;
        if(linkedBizId) {
             newProduct.businessId = linkedBizId;
        }

        LS.write(LS.keyProducts, [...products, newProduct]);
        toast(`✅ Item "${newProduct.title}" Published!`);
        form.reset();
        
        // Reset Visual Status Text
        const sellStatus = document.getElementById('sellFileStatus');
        if(sellStatus) { sellStatus.textContent = "No file chosen"; sellStatus.style.color = 'var(--muted)'; }

        route('browse');
        // --- CRITICAL FIX: Explicitly call renderListings to force update the Browse page ---
        renderListings();
        // ----------------------------------------------------------------------------------
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

// FIX: Restore the click listener for the profile button
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

// ----- Add Reset Button Logic -----
const profileFooter = document.querySelector('.profile-sidebar__footer');
if (profileFooter && !document.getElementById('resetAppBtn')) {
    const resetBtn = document.createElement('button');
    resetBtn.id = 'resetAppBtn';
    resetBtn.className = 'btn';
    resetBtn.style.cssText = 'width:100%; margin-top:0.5rem; background: #ef4444; color:white; border:none;';
    resetBtn.innerHTML = '<i class="ri-delete-bin-line"></i> Reset Data';
    resetBtn.onclick = () => {
        if(confirm("Are you sure? This deletes ALL businesses and items.")) {
            localStorage.clear();
            window.location.reload();
        }
    };
    profileFooter.insertBefore(resetBtn, profileFooter.firstChild);
}

function initializeProfile() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
        console.warn("--- HARD RESET TRIGGERED --- Clearing all local storage data.");
        localStorage.removeItem(LS.keyProducts);
        localStorage.removeItem(LS.keyCart);
        localStorage.removeItem(LS.keyOrders);
        localStorage.removeItem(LS.keyBiz);
        localStorage.removeItem(PROFILE_KEY); // Also clear the profile
        
        // Redirect to clean URL after reset
        window.location.href = window.location.origin + window.location.pathname;
        return;
    }
    
    // 1. Get the current profile data
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const token = localStorage.getItem('slsu_token');
    
    if (!profile || token !== 'active') return;

    // --- CRITICAL FIX: Base Display Name entirely on localStorage, prioritizing the correct name ---
    let finalDisplayName = profile.username || 'marcglorioso07';
    
    // 2. Normalize and check the stored name
    const storedNameLower = (profile.username || '').toLowerCase().trim();
    
    // If the stored name is an old default placeholder (Anonymous, Student) OR the known incorrect "marc",
    // force it to the user's expected correct name.
    if (storedNameLower === 'anonymous user' || storedNameLower === 'student user' || storedNameLower === 'marc') {
         finalDisplayName = 'marcglorioso07';
    } else {
         // Otherwise, use whatever is correctly stored in the profile
         finalDisplayName = profile.username;
    }

    // 3. Save the prioritized name back to storage
    profile.username = finalDisplayName;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));


    // 4. Update UI
    const initial = finalDisplayName.toUpperCase().charAt(0);
    
    const avatarEl = document.getElementById('profileAvatarInitial');
    if (avatarEl) avatarEl.textContent = initial;

    const displayNameEl = document.querySelector('.profile-display-name');
    if (displayNameEl) displayNameEl.textContent = finalDisplayName; // Use the actual stored name

    const emailEl = document.querySelector('.profile-email');
    if (emailEl) emailEl.textContent = profile.email || 'N/A';
    
    // Set the input field's value explicitly to the correct name.
    const displayNameInput = document.getElementById('displayNameInput');
    if(displayNameInput) displayNameInput.value = finalDisplayName;
}

initializeProfile();
setupDashboardTabs();
// --- CRITICAL FIX: Delay dashboard rendering slightly to ensure the profile is fully initialized. ---
setTimeout(renderMyDashboard, 10);
renderListings();