/* scripts/marketplace.js
 *
 * FULL FILE – FIRESTORE + CLOUDINARY
 */

'use strict';

// --------------------------- CLOUDINARY CONFIG ---------------------------
const CLOUDINARY_CLOUD = "dfwlab4gq";
const CLOUDINARY_PRESET = "SLSU-marketplace";

async function uploadImageToCloudinary(file) {
  if (!file) return "";
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: fd
    });

    if (!res.ok) {
      const txt = await res.text();
      alert("Cloudinary upload failed: " + txt);
      return "";
    }

    const data = await res.json();
    return data.secure_url || data.url || "";
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    alert("Cloudinary upload failed. Check console for details.");
    return "";
  }
}
const uploadToCloudinary = uploadImageToCloudinary;


// --------------------------- FIREBASE HANDLES ---------------------------

const firebaseNS = window.firebaseNS || {};
const auth = firebaseNS.auth || null;
const db = firebaseNS.db || null;
const onAuthStateChanged = firebaseNS.onAuthStateChanged || (() => {});
const updateProfile = firebaseNS.updateProfile || (() => Promise.resolve());

const {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} = (firebaseNS.firestore || {});

// Collections (5 tables)
const COL_USERS      = 'users';
const COL_PRODUCTS   = 'products';
const COL_BUSINESS   = 'businesses';
const COL_CARTS      = 'carts';
const COL_ORDERS     = 'orders';

// --------------------------- UTILS / HELPERS ---------------------------

const fmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const uidLocal = () => (Date.now().toString(36) + Math.random().toString(36).slice(2)); // fallback

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

const toast = (msg) => {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
};

// Preview helper (for image previews only – no storage)
const convertToBase64 = (file) => new Promise((resolve) => {
  if (!file || !(file instanceof File)) {
    resolve('');
    return;
  }
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve('');
});

// ----- UNIVERSAL PREVIEW FUNCTION -----
window.previewSlot = (input, imgId, statusId = null) => {
  if (!(input.files && input.files[0])) return;
  const file = input.files[0];

  if (statusId) {
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      statusEl.textContent = file.name;
      statusEl.style.color = 'var(--accent)';
    }
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(imgId);
    if (img) {
      img.src = e.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// Logo preview alias
window.previewLogo = (input) => {
  window.previewSlot(input, 'bizLogoPreview', 'bizFileStatus');

  const placeholder = document.getElementById('bizLogoPlaceholder');
  if (placeholder) {
    const hasFile = input && input.files && input.files[0];
    placeholder.style.display = hasFile ? 'none' : 'block';
  }
};

// Sell item file status text
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'sellFile' && e.target.files[0]) {
    const status = document.getElementById('sellFileStatus');
    if (status) {
      status.textContent = e.target.files[0].name;
      status.style.color = 'var(--accent)';
    }
  }
});

// --------------------------- GLOBAL STATE ---------------------------

let state = { q: '', cat: '' };

let currentUser = null;
let cachedProfile = null;

let cachedProducts = [];   // all products
let cachedBusinesses = []; // all businesses
let cachedOrders = [];     // current user's orders
let cachedCart = [];       // current user's cart (array of {productId, qty})

// --------------------------- ROUTING ---------------------------

function route(r) {
  document.querySelectorAll('.nav-pill').forEach(a => a.classList.remove('active'));
  document.querySelector(`.nav-pill[data-route="${r}"]`)?.classList.add('active');

  const show = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? 'block' : 'none';
  };

  show('heroHeader', r === 'browse');
  show('browseSection', r === 'browse');
  show('businessPage', r === 'business-page');
  show('sellSection', r === 'sell');
  show('businessSection', r === 'business');
  show('mySection', r === 'my');

  if (r === 'browse') {
    renderCategoryIcons();
    renderFeatured(false);
    renderActiveSidebar();
    renderListings();
  }
  if (r === 'my') {
    renderMyDashboard();
  }
  if (r === 'sell') {
    if (!window.isAddingToBiz) {
      const link = document.getElementById('linkToBizId');
      const notice = document.getElementById('bizLinkNotice');
      if (link) link.value = '';
      if (notice) notice.style.display = 'none';
    }
    window.isAddingToBiz = false;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.route = route;

// --------------------------- CATEGORY / BROWSE ---------------------------

const CATEGORIES = [
  { name: 'All',           icon: 'ri-apps-line' },
  { name: 'Food & Drinks', icon: 'ri-restaurant-line' },
  { name: 'Services',      icon: 'ri-service-line' },
  { name: 'Books',         icon: 'ri-book-open-line' },
  { name: 'Uniforms',      icon: 'ri-shirt-line' },
  { name: 'Electronics',   icon: 'ri-computer-line' },
  { name: 'Merch & Printing', icon:'ri-t-shirt-air-line' },
  { name: 'Others',        icon: 'ri-more-line' }
];

function renderCategoryIcons() {
  const container = document.getElementById('categoryIcons');
  if (!container) return;
  container.innerHTML = CATEGORIES.map(c => `
    <div class="cat-icon-item ${state.cat === (c.name === 'All' ? '' : c.name) ? 'active' : ''}"
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

// Search
const searchInput = document.getElementById('q');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    state.q = e.target.value.trim();
    renderListings();
  });
}

// Template for item card
function itemTemplate(i) {
  const biz = i.businessId ? cachedBusinesses.find(b => b.id === i.businessId) : null;
  const isSoldOut = (biz && biz.status === 'off') || (i.status === 'off');

  return `
  <article class="card ${isSoldOut ? 'sold-out' : ''}">
    <img class="card__img" src="${escapeHtml(i.image || 'https://dummyimage.com/800x600/0f1620/111827.png&text=Item')}" />
    ${isSoldOut ? '<div class="sold-out-overlay">SOLD OUT</div>' : ''}
    <div class="card__body">
      <div class="badge">${escapeHtml(i.category)} • ${escapeHtml(i.condition || 'New')}</div>
      <h3>${escapeHtml(i.title)}</h3>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
        <div class="price">${fmt.format(i.price || 0)}</div>
        <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.9rem;"
          onclick="addToCart('${i.id}')" ${isSoldOut ? 'disabled' : ''}>
          <i class="ri-add-line"></i>
        </button>
      </div>
    </div>
  </article>`;
}

function renderListings(businessId = null, targetContainer = null) {
  const listingsEl = targetContainer || document.getElementById('listings');
  const empty = document.getElementById('emptyListings');
  if (!listingsEl && !targetContainer) return;
  if (!targetContainer && !empty) return;

  if (targetContainer) {
    targetContainer.innerHTML = '';
  } else {
    listingsEl.innerHTML = '';
    if (empty) empty.style.display = 'none';
  }

  let items = [...cachedProducts];

  if (businessId) {
    items = items.filter(i => i.businessId === businessId);
  } else {
    items = items.filter(i => !i.businessId);
    if (state.q) {
      const q = state.q.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(q));
    }
    if (state.cat) {
      items = items.filter(i => i.category === state.cat);
    }
  }

  if (items.length > 0) {
    const html = items.map(itemTemplate).join('');
    if (targetContainer) targetContainer.innerHTML = html;
    else listingsEl.innerHTML = html;
  } else {
    if (targetContainer) {
      targetContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1; padding:2rem; border:1px dashed var(--stroke); border-radius:12px; margin-top:1rem; text-align:center;">
          <i class="ri-menu-line" style="font-size:2rem; margin-bottom:0.5rem; color:var(--muted);"></i>
          <p>This business hasn't listed any items yet.</p>
        </div>`;
    } else if (empty) {
      empty.style.display = 'block';
    }
  }
}

// Featured businesses
window.renderFeatured = (showAll = false) => {
  const biz = cachedBusinesses.filter(b => b.status !== 'off');
  const container = document.getElementById('featuredBizRow');
  if (!container) return;

  const existingBtn = document.getElementById('seeAllBtnContainer');
  if (existingBtn) existingBtn.remove();

  if (!biz.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1; color:var(--muted); padding:1rem; border:1px dashed var(--stroke); border-radius:12px;">
        No businesses featured yet.
      </div>`;
    return;
  }

  const limit = 6;
  const itemsToShow = showAll ? biz : biz.slice(0, limit);

  container.innerHTML = itemsToShow.map(b => `
    <div class="biz-square-card" onclick="openBusiness('${b.id}')">
      <img class="biz-square-img"
           src="${escapeHtml(b.logo || 'https://dummyimage.com/400x400/0f1620/111827.png&text=Shop')}" />
      <div class="biz-square-overlay">
        <div class="biz-square-name">${escapeHtml(b.name)}</div>
        <div style="font-size:0.85rem; color:#9ca3af;">
          ${escapeHtml(b.category)} • ${b.type === 'Service' ? 'Service' : 'Retail'}
        </div>
      </div>
    </div>
  `).join('');

  if (!showAll && biz.length > limit) {
    const wrapper = document.createElement('div');
    wrapper.id = 'seeAllBtnContainer';
    wrapper.className = 'see-all-container';
    wrapper.innerHTML = `
      <button class="btn-see-all" onclick="renderFeatured(true)">
        <span>See all shops</span>
        <i class="ri-arrow-right-line"></i>
      </button>`;
    container.parentElement.appendChild(wrapper);
  }
};

// Active shops sidebar
function renderActiveSidebar() {
  // Support OLD sidebar id (activeBizList) AND new layout (browseSidebarRanked + activeShopsGrid)
  const oldContainer = document.getElementById('activeBizList');
  const rankedEl = document.getElementById('browseSidebarRanked');
  const activeGrid = document.getElementById('activeShopsGrid');

  const active = cachedBusinesses.filter(b => b.status !== 'off');

  // Old single-column sidebar
  if (oldContainer) {
    if (!active.length) {
      oldContainer.innerHTML = `<div style="color:var(--muted);">No active shops.</div>`;
    } else {
      oldContainer.innerHTML = active.map((b, idx) => `
        <div class="ranked-item" onclick="openBusiness('${b.id}')">
          <div class="rank-num">${idx + 1}</div>
          <img class="rank-img" src="${escapeHtml(b.logo || 'https://dummyimage.com/100x150/0f1620/111827.png&text=Biz')}" />
          <div class="rank-info">
            <div class="rank-title">${escapeHtml(b.name)}</div>
            <div class="rank-sub">${escapeHtml(b.category)}</div>
          </div>
          <div class="rank-status" title="Active"></div>
        </div>
      `).join('');
    }
  }

  // New design (if those elements exist)
  if (rankedEl && activeGrid) {
    if (!active.length) {
      rankedEl.innerHTML = `
        <div class="empty-state" style="color:var(--muted);">
          <p>No active shops yet.</p>
        </div>`;
      activeGrid.innerHTML = '';
      return;
    }

    const top = active.slice(0, 3);
    rankedEl.innerHTML = top.map((b, idx) => `
      <div class="ranked-item" onclick="openBusiness('${b.id}')">
        <img class="rank-img" src="${escapeHtml(b.logo || 'https://dummyimage.com/60x60/0f1620/111827.png&text=Shop')}" />
        <div>
          <div style="font-weight:600;">${idx + 1}. ${escapeHtml(b.name)}</div>
          <div style="font-size:0.8rem; color:var(--muted);">${escapeHtml(b.category)}</div>
        </div>
      </div>`).join('');

    activeGrid.innerHTML = active.map(b => `
      <button class="pill" onclick="openBusiness('${b.id}')">
        <i class="ri-store-3-line"></i> ${escapeHtml(b.name)}
      </button>`).join('');
  }
}

// --------------------------- BUSINESS PAGE (RESTORED OLD DESIGN) ---------------------------

window.openBusiness = (businessId) => {
  const biz = cachedBusinesses.find(b => b.id === businessId);
  if (!biz) {
    toast('Business not found.');
    return;
  }

  const pageContainer = document.getElementById('businessPage');
  if (pageContainer) {
    pageContainer.innerHTML = `
      <div class="container" style="padding-top:1.5rem;">
        <button class="btn btn-outline" onclick="route('browse')" style="margin-bottom:1.5rem;">
          <i class="ri-arrow-left-line"></i> Back
        </button>
      </div>
      <div id="bizHeader"></div>
      <div class="container" style="padding-bottom:4rem;">
        <h3 class="section__header" style="margin-top:2rem; margin-bottom:1rem;">
          ${biz.type === 'Service' ? 'Menu & Services' : 'Menu & Services'}
        </h3>
        <div id="bizItemsGrid"
             class="listings-grid"
             style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.5rem; min-height:100px;">
        </div>
      </div>
    `;
  }

  const headerEl = document.getElementById('bizHeader');
  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container">
        <div class="biz-header-card-alt">
          <div class="biz-header-media-alt">
            <img class="biz-header-logo-alt"
                 src="${escapeHtml(biz.logo || 'https://dummyimage.com/120x120/0f1620/111827.png&text=Shop')}"
                 alt="${escapeHtml(biz.name)} logo" />
          </div>
          <div class="biz-header-info-alt">
            <div class="biz-category-alt">
              ${escapeHtml(biz.type === 'Service' ? 'Service Provider' : biz.category)}
            </div>
            <h1 class="biz-title-alt">${escapeHtml(biz.name)}</h1>
            <p class="biz-description-alt">${escapeHtml(biz.description || 'No description provided.')}</p>
            <div class="biz-details-row-alt">
              <span><i class="ri-user-3-line"></i> Owner: ${escapeHtml(biz.ownerName || '')}</span>
              <span><i class="ri-map-pin-line"></i> ${escapeHtml(biz.location || 'Location not set')}</span>
              ${biz.contact ? `<span><i class="ri-phone-line"></i> ${escapeHtml(biz.contact)}</span>` : ''}
              ${biz.website ? `<span><i class="ri-link"></i> <a href="${escapeHtml(biz.website)}" target="_blank" rel="noopener">Website</a></span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const itemsGridEl = document.getElementById('bizItemsGrid');
  if (itemsGridEl) {
    renderListings(biz.id, itemsGridEl);
  }

  route('business-page');
};

// --------------------------- CART (FIRESTORE) ---------------------------

function getCart() {
  return [...cachedCart];
}

async function saveCart(cart) {
  cachedCart = [...cart];
  updateCartBadge();
  if (!db || !currentUser) return;
  try {
    await setDoc(doc(db, COL_CARTS, currentUser.uid), { items: cart }, { merge: true });
  } catch (err) {
    console.error('Failed to save cart to Firestore:', err);
  }
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count;
}

function renderCart() {
  const cartBody = document.getElementById('cartBody');
  const totalEl = document.getElementById('cartTotal');
  if (!cartBody || !totalEl) return;

  const cart = getCart();

  if (!cart.length) {
    cartBody.innerHTML = `
      <div class="empty-state" style="padding:1rem; text-align:center; color:var(--muted);">
        <i class="ri-shopping-cart-line" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
        <p>Your cart is empty.</p>
      </div>`;
    totalEl.textContent = fmt.format(0);
    return;
  }

  let total = 0;

  const rows = cart.map(entry => {
    const product = cachedProducts.find(p => p.id === entry.productId);
    if (!product) return '';
    const qty = entry.qty || 1;
    const lineTotal = (product.price || 0) * qty;
    total += lineTotal;

    return `
  <div style="display:flex; justify-content:space-between; gap:1rem; padding:0.8rem 0; border-bottom:1px solid var(--stroke);">
    <div style="display:flex; flex-direction:column; gap:0.45rem;">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <img src="${escapeHtml(product.image || 'https://dummyimage.com/60x60/0f1620/111827.png&text=Item')}"
             style="width:48px;height:48px;border-radius:10px;object-fit:cover;">
        <div>
          <div style="font-size:0.95rem; font-weight:600;">
            ${escapeHtml(product.title)}
          </div>
          <div style="font-size:0.8rem; color:var(--muted);">
            ${escapeHtml(product.category || '')}
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:0.6rem; margin-left:3.2rem;">
        <button class="btn-icon"
                style="width:26px;height:26px;font-size:0.85rem;"
                onclick="changeCartQty('${product.id}', -1)">
          <i class="ri-subtract-line"></i>
        </button>
        <span style="min-width:22px; text-align:center; font-weight:700;">
          ${qty}
        </span>
        <button class="btn-icon"
                style="width:26px;height:26px;font-size:0.85rem;"
                onclick="changeCartQty('${product.id}', 1)">
          <i class="ri-add-line"></i>
        </button>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:0.4rem;">
      <div style="font-weight:700; font-size:1rem;">
        ${fmt.format(product.price || 0)}
      </div>
      <button class="btn-icon" onclick="removeFromCart('${product.id}')">
        <i class="ri-delete-bin-line"></i>
      </button>
    </div>
  </div>`;
  }).join('');

  cartBody.innerHTML = rows;
  totalEl.textContent = fmt.format(total);
}

window.addToCart = (productId) => {
  const cart = getCart();
  const existing = cart.find(i => i.productId === productId);
  if (existing) existing.qty += 1;
  else cart.push({ productId, qty: 1 });

  saveCart(cart);
  renderCart();
  const panel = document.getElementById('cartPanel');
  if (panel) panel.classList.add('open');
  toast('Added to cart.');
};

window.removeFromCart = (productId) => {
  const cart = getCart().filter(i => i.productId !== productId);
  saveCart(cart);
  renderCart();
};

window.changeCartQty = (productId, delta) => {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  const newQty = (item.qty || 1) + delta;
  if (newQty <= 0) {
    const idx = cart.indexOf(item);
    if (idx > -1) cart.splice(idx, 1);
  } else {
    item.qty = newQty;
  }
  saveCart(cart);
  renderCart();
};

async function handleCheckout() {
  const cart = getCart();
  if (!cart.length) {
    toast('Your cart is empty.');
    return;
  }
  if (!currentUser || !db) {
    toast('Please login again.');
    return;
  }

  const products = [...cachedProducts];
  let total = 0;
  const items = cart.map(entry => {
    const product = products.find(p => p.id === entry.productId);
    if (!product) return null;
    const qty = entry.qty || 1;
    const lineTotal = (product.price || 0) * qty;
    total += lineTotal;

    return {
      productId: product.id,
      title: product.title,
      category: product.category || '',
      price: product.price,
      quantity: qty,
      subtotal: lineTotal,
      seller: product.listedBy || '',
      sellerUid: product.ownerUid || null
    };
  }).filter(Boolean);

  if (!items.length) {
    toast('Items in cart are no longer available.');
    return;
  }

  const categories = Array.from(
    new Set(items.map(it => it.category || ''))
  ).filter(Boolean);
  const categorySummary = categories.join(', ') || '';

  try {
    await addDoc(collection(db, COL_ORDERS), {
      customerUid: currentUser.uid,
      customerName: cachedProfile?.displayName || currentUser.displayName || currentUser.email || 'Student',
      total,
      date: serverTimestamp ? serverTimestamp() : Date.now(),
      status: 'Pending',
      items,
      categorySummary
    });

    await saveCart([]);
    renderCart();
    const panel = document.getElementById('cartPanel');
    if (panel) panel.classList.remove('open');
    toast('✅ Order placed!');

    route('my');
    window.switchMyTab('orders');
    renderMyDashboard();
  } catch (err) {
    console.error('Checkout failed:', err);
    toast('Failed to place order.');
  }
}

const checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

// --------------------------- PROFILE (FIREBASE USER + users doc) ---------------------------

function applyProfileAvatar(avatarUrl, fallbackInitial) {
  const headerImg = document.getElementById('profileAvatarImageHeader');
  const sidebarImg = document.getElementById('profileAvatarImageSidebar');
  const headerLetter = document.getElementById('profileAvatarInitialHeader');
  const sidebarLetter = document.getElementById('profileAvatarInitialSidebar');

  const applyCircleImg = (img) => {
    if (!img) return;
    img.style.display = 'block';
    img.style.objectFit = 'cover';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.borderRadius = '9999px';
  };

  if (avatarUrl) {
    if (headerImg) {
      headerImg.src = avatarUrl;
      applyCircleImg(headerImg);
    }
    if (sidebarImg) {
      sidebarImg.src = avatarUrl;
      applyCircleImg(sidebarImg);
    }
    if (headerLetter) headerLetter.style.display = 'none';
    if (sidebarLetter) sidebarLetter.style.display = 'none';
  } else {
    if (headerImg) headerImg.style.display = 'none';
    if (sidebarImg) sidebarImg.style.display = 'none';
    if (headerLetter) {
      headerLetter.style.display = 'flex';
      if (fallbackInitial) headerLetter.textContent = fallbackInitial;
    }
    if (sidebarLetter) {
      sidebarLetter.style.display = 'flex';
      if (fallbackInitial) sidebarLetter.textContent = fallbackInitial;
    }
  }
}

async function loadOrCreateUserProfile(user) {
  if (!db || !user) return null;
  const ref = doc(db, COL_USERS, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    cachedProfile = {
      id: snap.id,
      displayName: data.username || user.displayName || 'Student',
      email: data.email || user.email || '',
      avatar: data.avatarUrl || ''
    };
  } else {
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Student');
    const profileDoc = {
      uid: user.uid,
      email: user.email || '',
      username: displayName,
      avatarUrl: ''
    };
    await setDoc(ref, profileDoc);
    cachedProfile = {
      id: user.uid,
      displayName,
      email: profileDoc.email,
      avatar: ''
    };
  }

  const finalName = cachedProfile.displayName || 'Student';
  const initial = finalName.toUpperCase().charAt(0);

  const headerLetter = document.getElementById('profileAvatarInitialHeader');
  const sidebarLetter = document.getElementById('profileAvatarInitialSidebar');
  if (headerLetter) headerLetter.textContent = initial;
  if (sidebarLetter) sidebarLetter.textContent = initial;

  const displayNameEl = document.querySelector('.profile-display-name');
  if (displayNameEl) displayNameEl.textContent = finalName;

  const emailEl = document.querySelector('.profile-email');
  if (emailEl) emailEl.textContent = cachedProfile.email || 'N/A';

  const displayNameInput = document.getElementById('displayNameInput');
  if (displayNameInput) displayNameInput.value = finalName;

  applyProfileAvatar(cachedProfile.avatar || '', initial);

  return cachedProfile;
}

// Save profile name
document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('displayNameInput');
  const newName = input?.value.trim();
  if (!currentUser || !db || !newName) return;

  try {
    const ref = doc(db, COL_USERS, currentUser.uid);
    const emailToUse =
      cachedProfile?.email ||
      currentUser.email ||
      '';

    const avatarToUse =
      cachedProfile?.avatar || '';

    await setDoc(ref, {
      uid: currentUser.uid,
      email: emailToUse,
      username: newName,
      avatarUrl: avatarToUse
    });

    if (updateProfile && typeof updateProfile === 'function') {
      try {
        await updateProfile(currentUser, { displayName: newName });
      } catch (_) {}
    }

    if (!cachedProfile) cachedProfile = {};
    cachedProfile.displayName = newName;
    cachedProfile.email = emailToUse;

    const initial = newName.toUpperCase().charAt(0);

    const headerLetter = document.getElementById('profileAvatarInitialHeader');
    const sidebarLetter = document.getElementById('profileAvatarInitialSidebar');
    if (headerLetter) headerLetter.textContent = initial;
    if (sidebarLetter) sidebarLetter.textContent = initial;

    const displayNameEl = document.querySelector('.profile-display-name');
    if (displayNameEl) displayNameEl.textContent = newName;

    applyProfileAvatar(cachedProfile.avatar || '', initial);
    toast('Profile updated successfully!');
  } catch (err) {
    console.error('Failed to update profile:', err);
    toast('Failed to update profile.');
  }
});

// Avatar upload → Cloudinary + users doc
const avatarSidebar = document.getElementById('profileAvatarSidebar');
const avatarFileInput = document.getElementById('profileAvatarFile');

function openAvatarPicker() {
  if (avatarFileInput) avatarFileInput.click();
}

if (avatarSidebar && avatarFileInput) {
  avatarSidebar.style.cursor = 'pointer';
  avatarSidebar.addEventListener('click', openAvatarPicker);

  avatarFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentUser || !db) return;

    try {
      const avatarUrl = await uploadToCloudinary(file);
      if (!avatarUrl) return;

      const ref = doc(db, COL_USERS, currentUser.uid);
      const displayName =
        cachedProfile?.displayName ||
        currentUser.displayName ||
        (currentUser.email ? currentUser.email.split('@')[0] : 'Student');

      const emailToUse =
        cachedProfile?.email ||
        currentUser.email ||
        '';

      await setDoc(ref, {
        uid: currentUser.uid,
        email: emailToUse,
        username: displayName,
        avatarUrl
      });

      if (!cachedProfile) cachedProfile = {};
      cachedProfile.avatar = avatarUrl;
      cachedProfile.displayName = displayName;
      cachedProfile.email = emailToUse;

      const initial = displayName.charAt(0).toUpperCase();
      applyProfileAvatar(avatarUrl, initial);
      toast('Profile photo updated!');
    } catch (err) {
      console.error('Avatar upload error', err);
      toast('Failed to update profile photo.');
    } finally {
      avatarFileInput.value = '';
    }
  });
}

// Profile & cart panels open/close
const profileBtn = document.getElementById('openProfile');
const profileOverlay = document.getElementById('profileOverlay');
const closeProfile = document.getElementById('closeProfileSidebar');
const cartBtn = document.getElementById('openCart');
const cartPanel = document.getElementById('cartPanel');
const closeCart = document.getElementById('closeCart');

if (cartBtn && cartPanel) {
  cartBtn.addEventListener('click', () => {
    cartPanel.classList.add('open');
    renderCart();
  });
}
if (closeCart && cartPanel) {
  closeCart.addEventListener('click', () => cartPanel.classList.remove('open'));
}

if (profileBtn && profileOverlay) {
  profileBtn.addEventListener('click', () => profileOverlay.classList.add('open'));
  if (closeProfile) closeProfile.addEventListener('click', () => profileOverlay.classList.remove('open'));
}

// --------------------------- BUSINESS CREATE (FORM) ---------------------------

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form || form.id !== 'bizForm') return;

  e.preventDefault();
  if (!db || !currentUser) {
    toast('Please login first.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Launching...';
  }

  try {
    const data = Object.fromEntries(new FormData(form));
    const ownerName =
      cachedProfile?.displayName ||
      currentUser.displayName ||
      (currentUser.email ? currentUser.email.split('@')[0] : 'Student');

    const rawName = (data.name || '').trim();
    if (!rawName) throw new Error('Please fill in business name.');

    let finalCategory = (data.category || '').trim();
    if (!finalCategory) finalCategory = 'Others';
    if (data.type === 'Service' && finalCategory === 'Food & Drinks') {
      finalCategory = 'Services';
    }

    let bizFileInput = document.getElementById('bizFile');
    if (!bizFileInput) {
      bizFileInput = form.querySelector('input[type="file"]:not([id^="ms_file_"])');
    }
    let logoUrl = '';
    if (bizFileInput && bizFileInput.files[0]) {
      logoUrl = await uploadToCloudinary(bizFileInput.files[0]);
    }

    const newBiz = {
      ownerUid: currentUser.uid,
      ownerName,
      name: rawName,
      category: finalCategory,
      type: data.type,
      ownerAge: data.ownerAge || null,
      description: data.description || '',
      logo: logoUrl,
      contact: data.contact || '',
      location: data.location || '',
      website: data.website || '',
      created: serverTimestamp ? serverTimestamp() : Date.now(),
      status: 'on'
    };

    const bizRef = await addDoc(collection(db, COL_BUSINESS), newBiz);
    const bizId = bizRef.id;

    const createdBiz = { id: bizId, ...newBiz };
    cachedBusinesses.push(createdBiz);
    renderActiveSidebar();
    renderFeatured(false);
    renderMyDashboard();

    const initialItems = [];
    for (let iSlot = 1; iSlot <= 4; iSlot++) {
      const title = (data[`m_title_${iSlot}`] || '').trim();
      const rawPrice = parseFloat(data[`m_price_${iSlot}`]);
      const price = isNaN(rawPrice) ? 0 : rawPrice;

      const menuFileInput = document.getElementById(`ms_file_${iSlot}`);
      let menuImageUrl = '';
      if (menuFileInput && menuFileInput.files[0]) {
        menuImageUrl = await uploadToCloudinary(menuFileInput.files[0]);
      }

      if (title) {
        initialItems.push({
          businessId: bizId,
          ownerUid: currentUser.uid,
          listedBy: ownerName,
          title,
          price,
          category: finalCategory,
          condition: data.type === 'Service' ? 'Service' : 'New / Fresh',
          description: data[`m_desc_${iSlot}`] || '',
          image: menuImageUrl,
          contact: newBiz.contact,
          created: serverTimestamp ? serverTimestamp() : Date.now(),
          status: 'on'
        });
      }
    }

    for (const item of initialItems) {
      await addDoc(collection(db, COL_PRODUCTS), item);
    }

    toast(`🚀 Business Created with ${initialItems.length} items!`);
    form.reset();

    const logoStatus = document.getElementById('bizFileStatus');
    const logoPreview = document.getElementById('bizLogoPreview');
    if (logoStatus) {
      logoStatus.textContent = 'No file chosen';
      logoStatus.style.color = 'var(--muted)';
    }
    if (logoPreview) {
      logoPreview.src = '';
      logoPreview.style.display = 'none';
    }
    for (let iSlot = 1; iSlot <= 4; iSlot++) {
      const mp = document.getElementById(`ms_prev_${iSlot}`);
      if (mp) { mp.src = ''; mp.style.display = 'none'; }
    }

    route('my');
    window.switchMyTab('businesses');
    renderMyDashboard();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to create business.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Launch Business';
    }
  }
});

// --------------------------- SELL ITEM (FORM) ---------------------------

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form || form.id !== 'sellForm') return;

  e.preventDefault();
  if (!db || !currentUser) {
    toast('Please login first.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processing.';
  }

  toast('Processing image.');

  try {
    const data = Object.fromEntries(new FormData(form));
    const ownerName =
      cachedProfile?.displayName ||
      currentUser.displayName ||
      (currentUser.email ? currentUser.email.split('@')[0] : 'Student');

    const sellFileInput = document.getElementById('sellFile');
    let imageUrl = '';
    if (sellFileInput && sellFileInput.files[0]) {
      imageUrl = await uploadToCloudinary(sellFileInput.files[0]);
    } else if (data.image && data.image.trim()) {
      imageUrl = data.image.trim();
    }

    if (!data.title) throw new Error('Please fill title.');

    const linkedBizId = document.getElementById('linkToBizId')?.value || data.businessId || '';

    const newProduct = {
      ownerUid: currentUser.uid,
      listedBy: ownerName,
      title: data.title,
      price: parseFloat(data.price) || 0,
      category: data.category,
      condition: data.condition,
      description: data.description || '',
      image: imageUrl,
      contact: data.contact || '',
      created: serverTimestamp ? serverTimestamp() : Date.now(),
      status: 'on',
      businessId: linkedBizId || null
    };

    await addDoc(collection(db, COL_PRODUCTS), newProduct);

    toast(`✅ Item "${newProduct.title}" Published!`);
    form.reset();

    const sellStatus = document.getElementById('sellFileStatus');
    if (sellStatus) {
      sellStatus.textContent = 'No file selected';
      sellStatus.style.color = 'var(--muted)';
    }

    route('browse');
    renderListings();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to list item.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-upload-2-line"></i> Publish';
    }
  }
});

// --------------------------- MY DASHBOARD ---------------------------

window.switchMyTab = (tab) => {
  const tabs = document.querySelectorAll('#myTabs .tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`#myTabs .tab[data-tab="${tab}"]`)?.classList.add('active');

  const views = {
    listings: document.getElementById('myListings'),
    orders: document.getElementById('myOrders'),
    businesses: document.getElementById('myBusinesses')
  };
  Object.keys(views).forEach(k => {
    if (views[k]) views[k].style.display = (k === tab ? 'block' : 'none');
  });
};

function renderBusinessItems(businessId, container) {
  if (!container) return;
  const items = cachedProducts.filter(p => p.businessId === businessId);
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1rem 2.5rem; color:var(--muted);">
        No items yet.
      </div>`;
    return;
  }
  const itemHtml = items.map(i => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 2.5rem; border-top:1px solid var(--stroke);">
      <div style="display:flex; align-items:center; gap:1rem;">
        <img src="${escapeHtml(i.image || 'https://dummyimage.com/60x60/0f1620/111827.png&text=I')}"
             style="width:48px; height:48px; border-radius:10px; object-fit:cover;">
        <div>
          <div style="font-weight:600;">${escapeHtml(i.title)}</div>
          <div style="font-size:0.85rem; color:var(--muted);">
            ${escapeHtml(i.category)} • ${escapeHtml(i.condition)}
          </div>
        </div>
      </div>
      <div style="font-weight:700;">${fmt.format(i.price || 0)}</div>
    </div>`).join('');

  container.innerHTML = itemHtml;
}

window.toggleBusinessItems = (businessId) => {
  const container = document.getElementById(`biz-items-${businessId}`);
  const button = document.getElementById(`biz-view-btn-${businessId}`);
  if (!container || !button) return;

  const isHidden = container.style.display === 'none' || !container.style.display;
  if (isHidden) {
    container.style.display = 'block';
    button.innerHTML = '<i class="ri-close-line"></i> Hide';
    button.style.backgroundColor = 'var(--accent)';
    button.style.color = '#022c22';
    button.style.borderColor = 'var(--accent)';

    const inner = container.querySelector(`#${container.id}-content`);
    renderBusinessItems(businessId, inner);
  } else {
    container.style.display = 'none';
    button.innerHTML = '<i class="ri-eye-line"></i> View';
    button.style.backgroundColor = 'var(--surface-3)';
    button.style.color = 'var(--text)';
    button.style.borderColor = 'var(--muted)';
  }
};

// Toggle status of a business
window.switchBusinessStatus = async (businessId) => {
  if (!db) return;
  const biz = cachedBusinesses.find(b => b.id === businessId);
  if (!biz) return;
  const newStatus = biz.status === 'on' ? 'off' : 'on';
  try {
    await updateDoc(doc(db, COL_BUSINESS, businessId), { status: newStatus });
  } catch (err) {
    console.error('Failed to update business status', err);
    toast('Failed to update business status.');
  }
};

// Toggle item status
window.switchItemStatus = async (itemId) => {
  if (!db) return;
  const item = cachedProducts.find(p => p.id === itemId);
  if (!item) return;
  const newStatus = item.status === 'on' ? 'off' : 'on';
  try {
    await updateDoc(doc(db, COL_PRODUCTS, itemId), { status: newStatus });
  } catch (err) {
    console.error('Failed to update item status', err);
    toast('Failed to update item status.');
  }
};

// Edit price inline
window.toggleEditPrice = async (id) => {
  const input = document.getElementById(`price-input-${id}`);
  const btn = document.getElementById(`edit-btn-${id}`);
  if (!input || !btn) return;

  const isReadOnly = input.hasAttribute('readonly');
  if (isReadOnly) {
    input.removeAttribute('readonly');
    input.focus();
    input.select();
    btn.innerHTML = '<i class="ri-check-line"></i> Save';
  } else {
    let newVal = parseFloat(input.value);
    if (isNaN(newVal) || newVal < 0) {
      toast('Invalid price.');
      const original = parseFloat(input.dataset.originalPrice || '0');
      input.value = original.toFixed(2);
      input.setAttribute('readonly', 'readonly');
      btn.innerHTML = '<i class="ri-eye-line"></i> View';
      return;
    }

    input.value = newVal.toFixed(2);
    input.setAttribute('readonly', 'readonly');
    btn.innerHTML = '<i class="ri-eye-line"></i> View';

    if (db) {
      try {
        await updateDoc(doc(db, COL_PRODUCTS, id), { price: newVal });
        toast('Price updated.');
      } catch (err) {
        console.error('Failed to update price', err);
        toast('Failed to update price.');
      }
    }
  }
};

// Delete order from My Orders
window.deleteOrder = async (orderId) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, COL_ORDERS, orderId));
    toast('Order deleted.');
  } catch (err) {
    console.error('Failed to delete order', err);
    toast('Failed to delete order.');
  }
};

// NEW: Delete listing (Items tab)
window.deleteListing = async (itemId) => {
  if (!db || !currentUser) return;
  const item = cachedProducts.find(p => p.id === itemId);
  if (!item) return;
  if (item.ownerUid && item.ownerUid !== currentUser.uid) {
    toast('You can only delete your own items.');
    return;
  }
  if (!confirm('Delete this item? This cannot be undone.')) return;

  try {
    await deleteDoc(doc(db, COL_PRODUCTS, itemId));
    toast('Item deleted.');
  } catch (err) {
    console.error('Failed to delete item', err);
    toast('Failed to delete item.');
  }
};

// NEW: Delete business (Business tab) + its items
window.deleteBusiness = async (businessId) => {
  if (!db || !currentUser) return;
  const biz = cachedBusinesses.find(b => b.id === businessId);
  if (!biz) return;
  if (biz.ownerUid && biz.ownerUid !== currentUser.uid) {
    toast('You can only delete your own business.');
    return;
  }
  if (!confirm('Delete this business and all its items? This cannot be undone.')) return;

  try {
    await deleteDoc(doc(db, COL_BUSINESS, businessId));

    const productsToDelete = cachedProducts.filter(
      p => p.businessId === businessId && p.ownerUid === currentUser.uid
    );
    for (const p of productsToDelete) {
      await deleteDoc(doc(db, COL_PRODUCTS, p.id));
    }

    toast('Business deleted.');
  } catch (err) {
    console.error('Failed to delete business', err);
    toast('Failed to delete business.');
  }
};

function renderMyDashboard() {
  if (!currentUser) return;
  const uid = currentUser.uid;

  const allBusinesses = [...cachedBusinesses];
  const myBusinesses = allBusinesses.filter(b => b.ownerUid === uid);

  const allProducts = [...cachedProducts];
  const myListings = allProducts.filter(i => i.ownerUid === uid && !i.businessId);

  const allOrders = [...cachedOrders];

  const businessContainer = document.getElementById('myBizBody');
  const businessEmpty = document.getElementById('myBizEmpty');
  const listingsContainer = document.getElementById('myListingsBody');
  const listingsEmpty = document.getElementById('myListingsEmpty');
  const ordersBody = document.getElementById('myOrdersBody');
  const ordersEmpty = document.getElementById('myOrdersEmpty');

  // ORDERS
  if (ordersBody) {
    if (allOrders.length) {
      if (ordersEmpty) ordersEmpty.style.display = 'none';
      const rows = allOrders.map(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        const firstTitle = items[0]?.title || '';
        const nameText = items.length > 1
          ? `${firstTitle} +${items.length - 1} more`
          : firstTitle;

        let categoryText = o.categorySummary || '';
        if (!categoryText && items.length) {
          const categories = Array.from(
            new Set(items.map(it => it.category || ''))
          ).filter(Boolean);
          categoryText = categories.join(', ');
        }

        return `
        <tr>
          <td>${escapeHtml(o.id || '')}</td>
          <td>${escapeHtml(o.customerName || '')}</td>
          <td>${escapeHtml(nameText || '')}</td>
          <td>${escapeHtml(categoryText || '')}</td>
          <td>${fmt.format(o.total || 0)}</td>
          <td>${o.date instanceof Date ? o.date.toLocaleString() : (o.date || '')}</td>
          <td>${escapeHtml(o.status || '')}</td>
          <td>
            <button class="btn-icon" onclick="deleteOrder('${o.id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
      ordersBody.innerHTML = rows;
    } else {
      ordersBody.innerHTML = '';
      if (ordersEmpty) ordersEmpty.style.display = 'block';
    }
  }

  // BUSINESSES
  if (businessContainer) {
    let bizHtml = '';
    if (myBusinesses.length > 0) {
const bizCards = myBusinesses.map(b => {
  const itemsContainerId = `biz-items-${b.id}`;
  return `
        <div id="biz-card-wrapper-${b.id}"
             class="my-biz-row"
             style="border:1px solid var(--stroke); border-radius:12px; margin-bottom:0.75rem; background:var(--surface-2); overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:1.5rem 2.5rem; width:100%;">
            <div class="my-biz-main"
                 style="display:flex; align-items:center; gap:3rem; flex-grow:1;">
              <img src="${escapeHtml(b.logo || 'https://dummyimage.com/60x60/0f1620/111827.png&text=B')}"
                   style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
              <div style="flex-grow:1;">
                <div style="font-weight:600; font-size:1.1rem; color:var(--text);">${escapeHtml(b.name)}</div>
                <div style="font-size:0.9rem; color:var(--muted);">${escapeHtml(b.category)} / ${b.type === 'Service' ? 'Service' : 'Retail'}</div>
              </div>
            </div>
         <div class="my-biz-right"
              style="display:flex; align-items:center; gap:2.5rem; min-width:260px; justify-content:flex-end;">

                <div style="font-weight:600; font-size:1.1rem; color:var(--text);">${escapeHtml(b.name)}</div>
                <div style="font-size:0.9rem; color:var(--muted);">${escapeHtml(b.category)} / ${b.type === 'Service' ? 'Service' : 'Retail'}</div>
              </div>
            </div>
         <div style="display:flex; align-items:center; gap:2.5rem; min-width:260px; justify-content:flex-end;">

  <!-- toggle column (unchanged) -->
  <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem; min-width:80px;">
    <div class="toggle-switch">
      <input type="checkbox" id="toggle-${b.id}" ${b.status === 'on' ? 'checked' : ''} 
             onchange="switchBusinessStatus('${b.id}')">
      <label for="toggle-${b.id}"></label>
    </div>
    <span style="font-size:0.7rem; color:${b.status === 'on' ? 'var(--accent)' : 'red'}; font-weight:600; text-transform:uppercase;">
      ${b.status === 'on' ? 'Active' : 'Closed'}
    </span>
  </div>

  <!-- view + delete on the right side -->
  <div style="display:flex; align-items:center; gap:0.75rem;">
    <button class="btn btn-outline" id="biz-view-btn-${b.id}"
            onclick="toggleBusinessItems('${b.id}')"
            style="padding:0.6rem 1rem; font-size:0.85rem; color:var(--text); border-color:var(--muted); background:var(--surface-3);">
      <i class="ri-eye-line"></i> View
    </button>

    <button class="btn-icon" onclick="deleteBusiness('${b.id}')" title="Delete business">
      <i class="ri-delete-bin-line"></i>
    </button>
  </div>

</div>

          </div>
          <div id="${itemsContainerId}" style="display:none; border-top:1px solid var(--stroke);">
            <div style="padding:1rem 2.5rem 0.5rem; font-size:0.9rem; font-weight:700; color:var(--muted); text-transform:uppercase;">
              Menu Items
            </div>
            <div id="${itemsContainerId}-content"></div>
            <div style="padding:1rem 2.5rem 1.5rem; text-align:right;">
              <button class="btn" onclick="
                route('sell');
                window.isAddingToBiz = true;
                document.getElementById('linkToBizId').value='${b.id}';
                document.getElementById('bizLinkNotice').style.display='block';
                document.getElementById('bizLinkName').textContent='${escapeHtml(b.name)}';">
                <i class="ri-add-line"></i> Add Item to ${escapeHtml(b.name)}
              </button>
            </div>
          </div>
        </div>`;
      }).join('');
      bizHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem; padding-top:1rem;">${bizCards}</div>`;
      if (businessEmpty) businessEmpty.style.display = 'none';
    } else {
      bizHtml = '';
      if (businessEmpty) businessEmpty.style.display = 'block';
    }
    businessContainer.innerHTML = bizHtml;
  }

  // MY LISTINGS
  if (listingsContainer) {
    let listHtml = '';
if (myListings.length > 0) {
  const itemCards = myListings.map(i => `
        <div class="my-listing-row"
             style="display:flex; justify-content:space-between; align-items:center;
                    padding:1.5rem 2.5rem; margin-bottom:0.75rem; width:100%;
                    background:var(--surface-2); border-radius:12px; border:1px solid var(--stroke);
                    transition:transform 0.2s;"
             onmouseover="this.style.transform='scale(1.005)'"
             onmouseout="this.style.transform='scale(1.0)'">
          <div class="my-listing-main"
               style="display:flex; align-items:center; gap:3rem; flex-grow:1;">
            <img src="${escapeHtml(i.image || 'https://dummyimage.com/60x60/0f1620/111827.png&text=I')}"
                 style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
            <div style="flex-grow:1;">
              <div style="font-weight:600; font-size:1.1rem; color:var(--text);">${escapeHtml(i.title)}</div>
              <div style="font-size:0.9rem; color:var(--muted);">
                ${escapeHtml(i.category)} • ${escapeHtml(i.condition)}
              </div>
            </div>
          </div>
          <div class="my-listing-right"
               style="display:flex; align-items:center; gap:3rem; min-width:270px; justify-content:center;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; min-width:120px;">
              <div class="price-input-container"
                   style="display:flex; align-items:center; background:var(--surface-3); border-radius:6px; padding:0.3rem 0.5rem; border:1px solid var(--stroke);">
                <span style="color:var(--muted); font-size:0.9rem;">₱</span>
                <input type="number"
                       id="price-input-${i.id}"
                       value="${(i.price || 0).toFixed(2)}"
                       data-original-price="${i.price || 0}"
                       onchange="this.value = parseFloat(this.value).toFixed(2)"
                       readonly
                       style="width:80px; background:transparent; border:none; color:var(--text); font-weight:700; font-size:1rem; outline:none; text-align:right;">
              </div>
              <button class="btn btn-outline" id="edit-btn-${i.id}"
                      onclick="toggleEditPrice('${i.id}')"
                      style="padding:0.3rem 0.75rem; font-size:0.75rem; color:var(--accent); border-color:var(--accent); background:transparent;">
                <i class="ri-eye-line"></i> View
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:1rem; min-width:120px;">
              <div style="display:flex; flex-direction:column; align-items:center;">
                <div class="toggle-switch">
                  <input type="checkbox" id="toggle-item-${i.id}" ${i.status === 'on' ? 'checked' : ''} 
                    onchange="switchItemStatus('${i.id}')">
                  <label for="toggle-item-${i.id}"></label>
                </div>
                <span style="font-size:0.7rem; color:${i.status === 'on' ? 'var(--accent)' : 'red'}; font-weight:600;">
                  ${i.status === 'on' ? 'Available' : 'Sold Out'}
                </span>
              </div>
              <button class="btn-icon" onclick="deleteListing('${i.id}')" title="Delete item">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>`).join('');


      listHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem; padding-top:1rem;">${itemCards}</div>`;
      if (listingsEmpty) listingsEmpty.style.display = 'none';
    } else {
      if (listingsEmpty) listingsEmpty.style.display = 'block';
    }
    listingsContainer.innerHTML = listHtml;
  }
}

// Tabs click + small hover
document.querySelectorAll('#myTabs .tab').forEach(tab => {
  tab.style.transition = 'transform 0.15s ease';
  tab.addEventListener('click', () => {
    window.switchMyTab(tab.getAttribute('data-tab'));
  });
  tab.addEventListener('mouseenter', () => {
    tab.style.transform = 'translateY(-1px)';
  });
  tab.addEventListener('mouseleave', () => {
    tab.style.transform = '';
  });
});

// --------------------------- FIREBASE LISTENERS (DATA) ---------------------------

function startDataListeners(user) {
  if (!db || !user) return;

  onSnapshot(collection(db, COL_PRODUCTS), (snap) => {
    cachedProducts = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    if (document.querySelector('[data-route="browse"].active')) {
      renderListings();
      renderActiveSidebar();
      renderFeatured(false);
    }
    if (document.getElementById('mySection').style.display === 'block') {
      renderMyDashboard();
    }
    updateCartBadge();
    renderCart();
  });

  onSnapshot(collection(db, COL_BUSINESS), (snap) => {
    cachedBusinesses = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    if (document.querySelector('[data-route="browse"].active')) {
      renderActiveSidebar();
      renderFeatured(false);
    }
    if (document.getElementById('mySection').style.display === 'block') {
      renderMyDashboard();
    }
  });

  const qOrders = query(
    collection(db, COL_ORDERS),
    where('customerUid', '==', user.uid)
  );
  onSnapshot(qOrders, (snap) => {
    cachedOrders = snap.docs.map(d => {
      const data = d.data();
      let date = data.date;
      if (date && date.toDate) {
        date = date.toDate();
      }
      return {
        id: d.id,
        ...data,
        date
      };
    });
    renderMyDashboard();
  });

  onSnapshot(doc(db, COL_CARTS, user.uid), (snap) => {
    if (!snap.exists()) {
      cachedCart = [];
    } else {
      const data = snap.data();
      cachedCart = Array.isArray(data.items) ? data.items : [];
    }
    updateCartBadge();
  });
}

// --------------------------- AUTH STATE ---------------------------

if (!auth || !db) {
  console.error('Firebase auth/db not found on window.firebaseNS. Make sure init script is correct.');
} else {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    if (!user) {
      return;
    }
    await loadOrCreateUserProfile(user);
    startDataListeners(user);
  });
}

// --------------------------- INITIAL ROUTE ---------------------------

document.addEventListener('DOMContentLoaded', () => {
  renderCategoryIcons();
  renderListings();
  renderActiveSidebar();
  renderFeatured(false);
  updateCartBadge();
  renderCart();
  route('browse');
});
