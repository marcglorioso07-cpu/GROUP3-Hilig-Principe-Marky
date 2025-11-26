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

// ----- Dynamic Menu Slot Logic & Base64 Encoder (HTTP 431 Fix) -----

let menuSlotCount = 3; 

window.previewSlot = async (input, imgId) => {
  if (!(input.files && input.files[0])) return;
  
  const file = input.files[0];
  const img = document.getElementById(imgId);
  // Target the hidden input by constructing its ID (e.g., ms_image_1_input)
  const hiddenInputId = imgId.replace('ms_prev_', 'ms_image_') + '_input';
  const hiddenInput = document.getElementById(hiddenInputId);

  // 1. Show Preview
  const reader = new FileReader();
  reader.onload = e => {
    if(img) {
      img.src = e.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);

  // 2. Convert to Base64 and store in the hidden input
  if (hiddenInput) {
      try {
          hiddenInput.value = await convertToBase64(file);
      } catch(err) {
          console.error("Error converting to Base64:", err);
          hiddenInput.value = ''; // Clear on error
      }
  }
};

window.addMenuItemSlot = () => {
    menuSlotCount++;
    const slotId = menuSlotCount;
    const addButton = document.getElementById('addNewItemSlot');
    
    // 1. New Item Slot HTML
    const newItemSlotHTML = `
        <div class="menu-slot-card" id="ms_${slotId}">
            <div class="menu-slot-img">
                <label for="ms_file_${slotId}">
                    <img id="ms_prev_${slotId}" src="" style="display:none;" />
                    <div class="placeholder"><i class="ri-image-add-line"></i><span>Photo</span></div>
                </label>
                <input type="file" id="ms_file_${slotId}" accept="image/*" onchange="previewSlot(this, 'ms_prev_${slotId}')" hidden />
                <input type="hidden" name="m_image_${slotId}" id="ms_image_${slotId}_input" value="" />
            </div>
            <div class="menu-slot-body">
                <input class="slot-input title" name="m_title_${slotId}" placeholder="Item Name" />
                <textarea class="slot-input desc" name="m_desc_${slotId}" rows="2" placeholder="Desc..."></textarea>
                <div class="slot-price-box">
                    <span>₱</span><input type="number" name="m_price_${slotId}" placeholder="0.00" />
                </div>
            </div>
        </div>
    `;

    // 2. New Add Button HTML
    const newAddButtonHTML = `
        <div class="menu-slot-card add-button-slot" id="addNewItemSlot" onclick="addMenuItemSlot()" style="cursor:pointer; background:var(--surface-3); border-style:dashed; border-color:var(--muted);">
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.5rem; padding:1rem; color:var(--muted);">
                <i class="ri-add-circle-line" style="font-size: 2.5rem;"></i>
                <span style="font-weight:600;">Add More Item</span>
                <span style="font-size:0.75rem;">(No limit)</span>
            </div>
        </div>
    `;

    // 3. Replace existing Add Button with the new Item Slot
    if (addButton) addButton.outerHTML = newItemSlotHTML;

    // 4. Insert the new Add Button after the new Item Slot
    const newItem = document.getElementById(`ms_${slotId}`);
    if (newItem) {
        newItem.insertAdjacentHTML('afterend', newAddButtonHTML);
    }
    
    toast(`Menu slot ${slotId} added.`);
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

// ----- Business Page Logic -----
window.openBusiness = (businessId) => {
    const biz = LS.read(LS.keyBiz).find(b => b.id === businessId);
    if (!biz) {
        toast("Business not found.");
        return;
    }

    // Render Business Header/Details (MATCHING USER'S EXAMPLE IMAGE)
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

    // Update the Section Title to be dynamic
    const servicesTitleEl = document.querySelector('#businessPage h3.section__header');
    if (servicesTitleEl) {
        servicesTitleEl.textContent = biz.type === 'Service' ? 'Our Services' : 'Our Menu';
    }

    // Render only the products associated with this business
    const itemsGridEl = document.getElementById('bizItemsGrid');
    if(itemsGridEl) {
        renderListings(biz.id, itemsGridEl);
    }
    
    route('business-page');
};
window.openBusiness = openBusiness;


// ----- Listings (Modified to support filtering) -----
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

// Function modified to accept businessId and an optional target container
function renderListings(businessId = null, targetContainer = null){
  const listingsEl = targetContainer || document.getElementById('listings');
  const empty = document.getElementById('emptyListings');
  
  // Guard against null elements for the main feed
  if(!listingsEl || (listingsEl === document.getElementById('listings') && !empty)) return;

  listingsEl.innerHTML = '';
  if (listingsEl === document.getElementById('listings')) empty.style.display = 'none';

  let items = LS.read(LS.keyProducts);

  // 1. Filter by Business ID (if provided)
  if(businessId) {
    // Show only items linked to this business
    items = items.filter(i => i.businessId === businessId);
  } else {
    // 2. Filter for the main Browse feed: only show items *without* a businessId
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
    // Show empty message only for the main Browse feed
    if (listingsEl === document.getElementById('listings')) {
        empty.style.display = 'block';
    } else if (targetContainer) {
        // Show a custom empty message for the business page
        listingsEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding:2rem; border:1px dashed var(--stroke); border-radius:12px; margin-top:1rem;">
                                  <i class="ri-menu-line" style="font-size: 2rem; margin-bottom: 0.5rem; color:var(--muted);"></i>
                                  <p>This business hasn't listed any items yet.</p>
                                </div>`;
    }
  }
}

// ----- Sell Item Form Handler (NEW) -----
const sellForm = document.getElementById('sellForm');
if(sellForm) {
    sellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const products = LS.read(LS.keyProducts);
        const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');

        // 1. Construct the new product object
        const newProduct = {
            id: uid(),
            // Important: businessId is deliberately excluded here,
            // or set to null/undefined, so it appears in the Fresh Listings feed.
            title: data.title,
            price: parseFloat(data.price),
            category: data.category,
            condition: data.condition,
            description: data.description || '',
            image: data.image || '', // This contains the Base64/URL
            contact: data.contact,
            listedBy: profile ? profile.username : 'Anonymous User',
            created: Date.now(),
        };

        // 2. Simple validation
        if (!newProduct.title || newProduct.price <= 0 || !newProduct.contact) {
            toast("Please fill in required fields.");
            return;
        }

        // 3. Save to localStorage
        LS.write(LS.keyProducts, [...products, newProduct]);

        // 4. Provide feedback and redirect
        toast(`✅ Item "${newProduct.title}" Published to Fresh Listings!`);
        e.target.reset();
        route('browse'); // Go back to browse to see the new listing
    });
}

// ----- Business Form Handler -----
const bizForm = document.getElementById('bizForm');
if(bizForm) {
  bizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const businesses = LS.read(LS.keyBiz);
    const products = LS.read(LS.keyProducts);
    
    // 1. Construct the business object
    const newBiz = {
        id: uid(),
        name: data.name,
        category: data.category,
        type: data.type,
        ownerName: data.ownerName,
        ownerAge: data.ownerAge,
        description: data.description,
        logo: data.logo, // This is the Base64/URL from the hidden input
        contact: data.contact,
        location: data.location,
        website: data.website,
        created: Date.now(),
    };

    // 2. Construct initial menu items and add them to products list
    const initialItems = [];
    // Iterate up to the current total number of slots
    for(let i = 1; i <= menuSlotCount; i++) { 
        const title = data[`m_title_${i}`]?.trim();
        const price = parseFloat(data[`m_price_${i}`]);
        const image = data[`m_image_${i}`]?.trim();

        // Only add items with a title and price
        if (title && price > 0) {
            const item = {
                id: uid(),
                businessId: newBiz.id, // CRITICAL: Link item to business ID
                title: title,
                price: price,
                category: newBiz.category, // Inherit category from business
                condition: newBiz.type === 'Service' ? 'Service' : 'New / Fresh',
                description: data[`m_desc_${i}`] || '',
                image: image || '',
                contact: newBiz.contact,
                listedBy: newBiz.ownerName,
                created: Date.now(),
            };
            initialItems.push(item);
        }
    }
    
    // Basic validation: must have at least one menu item if Food/Retail
    if (newBiz.type !== 'Service' && initialItems.length === 0) {
        toast("Please add at least one item to your initial menu.");
        return;
    }

    // 3. Save to localStorage
    LS.write(LS.keyBiz, [...businesses, newBiz]);
    LS.write(LS.keyProducts, [...products, ...initialItems]);

    // 4. Provide feedback and redirect
    toast(`🚀 Business "${newBiz.name}" Launched!`);
    e.target.reset();
    route('browse'); // Go back to browse to see the new listing
  });
}


// ----- Profile Initialization -----
const PROFILE_KEY = 'slsu_profile';

function initializeProfile() {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const token = localStorage.getItem('slsu_token');
    
    if (!profile || token !== 'active') {
        // Not logged in or profile is empty
        return;
    }

    const initial = (profile.username || 'U').toUpperCase().charAt(0);
    const displayName = profile.username || 'Student User';
    const email = profile.email || 'N/A';
    
    // 1. Update main nav avatar
    const avatarEl = document.getElementById('profileAvatarInitial');
    if (avatarEl) {
        avatarEl.textContent = initial;
    }

    // 2. Update profile sidebar details
    const sidebarAvatarEl = document.querySelector('.profile-sidebar__user .profile-avatar-letter');
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;

    const displayNameEl = document.querySelector('.profile-display-name');
    if (displayNameEl) displayNameEl.textContent = displayName;

    const emailEl = document.querySelector('.profile-email');
    if (emailEl) emailEl.textContent = email;
    
    // 3. Update settings input
    const displayNameInput = document.getElementById('displayNameInput');
    if(displayNameInput) {
        displayNameInput.value = displayName;
    }
}

// ----- Sidebar Toggles (Cart & Profile) -----
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

// Save Profile Button Logic
document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const newName = document.getElementById('displayNameInput')?.value.trim();
    
    if (profile && newName) {
        profile.username = newName;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        initializeProfile(); // Re-render profile with new name
        toast('Profile updated successfully!');
    }
});

// Init
initializeProfile(); 
renderListings();