/* =========================
   NovaParts – App Script
   ========================= */

// ---- Tiny helpers (local + safe) ----
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

const stars = (n = 0) => {
  const r = Math.round(n);
  return `<span class="stars" aria-label="${n} out of 5">${"★".repeat(
    r
  )}${"☆".repeat(5 - r)}</span>`;
};

// ---- Theme + year (shared across pages) ----
(function initChrome() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);
  const t = $("#themeToggle");
  if (t)
    t.onclick = () => {
      const next =
        root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    };
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();

/* ============================================================
   PRODUCTS + GRID + FILTERS (Shop header pills)
   ============================================================ */

let NP_ALL = []; // filled by loadProducts()
let NP_FILTER = "All"; // current filter selection

function card(p) {
  const el = document.createElement("div");
  el.className = "card product";
  el.innerHTML = `
    <div class="media">
      <img src="${p.image}" alt="${p.title}">
    </div>
    <div class="body">
      <div class="title-row">
        <strong>${p.title}</strong>
        <span class="price">${money(p.price)}</span>
      </div>
      <div class="small">${p.brand} • ${p.category}</div>
      <div>${stars(p.rating || 0)}</div>
      <div class="cta">
        <button class="btn" data-add="${p.id}">Add to cart</button>
      </div>
      <button class="btn ghost" data-quick="${p.id}">Quick view</button>
    </div>
  `;
  return el;
}

function renderProducts() {
  const grid = $("#productGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const list =
    NP_FILTER === "All"
      ? NP_ALL
      : NP_ALL.filter((p) => p.category === NP_FILTER);
  list.forEach((p) => grid.appendChild(card(p)));
}

function setFilter(cat) {
  NP_FILTER = cat;
  // pills active state
  $$("#filterPills .pill").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-cat") === cat);
  });
  // update hash (for deep link)
  if (location.hash.replace("#", "") !== cat) {
    history.replaceState(null, "", "#" + encodeURIComponent(cat));
  }
  renderProducts();
}

function hydratePillsFromList(list) {
  // keep fixed set (matches your design), but leave dynamic example commented
  // const cats = ['All', ...new Set(list.map(p => p.category))];
  const pills = $("#filterPills");
  if (!pills) return;

  pills.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (btn && btn.dataset.cat) setFilter(btn.dataset.cat);
  });

  // start from hash if present
  const initial = decodeURIComponent(location.hash.replace("#", "")) || "All";
  const valid = [
    "All",
    "GPUs",
    "CPUs",
    "Memory",
    "Storage",
    "Coolers",
    "Cases",
  ];
  setFilter(valid.includes(initial) ? initial : "All");
}

async function loadProducts() {
  const res = await fetch("products.json", { cache: "no-store" });
  const list = await res.json();
  NP_ALL = list;
  window.NP_PRODUCTS = list; // also expose for cart/quick view
  // If there's a grid, we’re on a page that shows products (home or shop)
  if ($("#productGrid")) {
    hydratePillsFromList(list); // safe to call even if no pills on the page
    renderProducts();
  }
}

/* ============================================================
   SIDE CART (slide-in + blur) + TOASTS
   ============================================================ */

const CART_KEY = "novaparts_cart_v3";

const getCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
};
const setCart = (v) => {
  localStorage.setItem(CART_KEY, JSON.stringify(v));
  updateCartUI();
};
const cartCount = () => getCart().reduce((a, b) => a + (b.qty || 0), 0);

function addToCart(id, qty = 1) {
  const c = getCart();
  const line = c.find((x) => x.id === id);
  if (line) line.qty += qty;
  else c.push({ id, qty });
  setCart(c);
  openCart();
  toast("Added to cart");
}

function incItem(id) {
  const c = getCart();
  const line = c.find((x) => x.id === id);
  if (line) line.qty++;
  setCart(c);
  toast("Updated");
}

function decItem(id) {
  const c = getCart();
  const line = c.find((x) => x.id === id);
  if (line) line.qty = Math.max(1, line.qty - 1);
  setCart(c);
  toast("Updated");
}

function removeItem(id) {
  setCart(getCart().filter((x) => x.id !== id));
  toast("Removed");
}

async function updateCartUI() {
  const items = getCart();
  const cc = $("#cartCount");
  if (cc) cc.textContent = cartCount();

  const box = $("#npLines");
  if (!box) return;

  const list =
    window.NP_PRODUCTS || (await (await fetch("products.json")).json());
  let subtotal = 0;
  box.innerHTML = "";

  items.forEach((it) => {
    const p = list.find((x) => x.id === it.id);
    if (!p) return;
    subtotal += p.price * it.qty;
    const row = document.createElement("div");
    row.className = "np-line";
    row.innerHTML = `
      <img src="${p.image}" alt="${p.title}">
      <div class="np-meta">
        <div class="np-title">${p.title}</div>
        <div class="np-muted">${p.brand} • ${p.sku || ""}</div>
        <div class="np-muted">${money(p.price)}</div>
      </div>
      <div class="np-qty">
        <button data-dec="${p.id}">−</button>
        <input value="${it.qty}" disabled>
        <button data-inc="${p.id}">+</button>
        <button class="iconbtn" data-del="${p.id}" title="Remove">🗑</button>
      </div>
    `;
    box.appendChild(row);
  });

  const sub = $("#cartSubtotal");
  if (sub) sub.textContent = money(subtotal);
}

let toastTimer = null;
function toast(msg) {
  const t = $("#npToast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
}

function openCart() {
  const p = $("#npCart");
  const bd = $("#npBackdrop");
  if (p && bd) {
    p.classList.add("open");
    bd.classList.add("show");
  }
}

function closeCart() {
  const p = $("#npCart");
  const bd = $("#npBackdrop");
  if (p && bd) {
    p.classList.remove("open");
    bd.classList.remove("show");
  }
}

// Global clicks (add/quick/cart controls/clear/close/modal)
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) addToCart(add.getAttribute("data-add"));

  const q = e.target.closest("[data-quick]");
  if (q) openQuick(q.getAttribute("data-quick"));

  if (e.target.id === "openCart") openCart();
  if (e.target.id === "closeCart" || e.target.id === "npBackdrop") closeCart();

  const inc = e.target.closest("[data-inc]");
  if (inc) incItem(inc.getAttribute("data-inc"));

  const dec = e.target.closest("[data-dec]");
  if (dec) decItem(dec.getAttribute("data-dec"));

  const del = e.target.closest("[data-del]");
  if (del) removeItem(del.getAttribute("data-del"));

  if (e.target.id === "headerClear") {
    setCart([]);
    toast("Cart cleared");
  }

  if (e.target.id === "modalClose" || e.target.classList.contains("overlay"))
    closeModal();
  if (e.target.id === "modalAdd") {
    addToCart(e.target.getAttribute("data-id"));
    closeModal();
  }
});

// Safety: direct listeners so they’re *always* clickable
document.addEventListener("DOMContentLoaded", function () {
  const clearBtn = $("#headerClear");
  if (clearBtn)
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setCart([]);
      toast("Cart cleared");
    });
  const closeBtn = $("#closeCart");
  if (closeBtn)
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeCart();
    });
});

/* ============================================================
   QUICK VIEW (modal)
   ============================================================ */

async function openQuick(id) {
  var list = window.NP_PRODUCTS;
  if (!list || !list.length) {
    var res = await fetch("products.json", { cache: "no-store" });
    list = await res.json();
  }
  var p = list.find(function (x) {
    return x.id === id;
  });
  if (!p) return;

  var img = document.getElementById("modalImg");
  var title = document.getElementById("modalTitle");
  var desc = document.getElementById("modalDesc");
  var price = document.getElementById("modalPrice");
  var sku = document.getElementById("modalSku");
  var addBtn = document.getElementById("modalAdd");
  var starsEl = document.getElementById("modalStars");
  var modal = document.getElementById("npModal");

  if (img) img.src = p.image;
  if (title) title.textContent = p.title;
  if (desc) desc.textContent = p.description || "";
  if (price) price.textContent = money(p.price);
  if (sku) sku.textContent = p.sku || "";
  if (addBtn) addBtn.setAttribute("data-id", p.id);
  if (starsEl) starsEl.innerHTML = stars(p.rating || 0); // clear then set once

  if (modal) modal.classList.add("show");
}

function closeModal() {
  $("#npModal").classList.remove("show");
}

/* ============================================================
   CHECKOUT SUMMARY (right column), fed from cart
   ============================================================ */

async function hydrateSummary() {
  const box = $("#summaryItems");
  if (!box) return;

  const list = await (await fetch("products.json")).json();
  const cart = getCart();
  box.innerHTML = "";

  let subtotal = 0;
  cart.forEach((it) => {
    const p = list.find((x) => x.id === it.id);
    if (!p) return;
    const lineTotal = p.price * it.qty;
    subtotal += lineTotal;
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${p.title} × ${it.qty}</span><span>${money(
      lineTotal
    )}</span>`;
    box.appendChild(row);
  });

  const s1 = $("#sumSubtotal");
  if (s1) s1.textContent = money(subtotal);
  const s2 = $("#sumTotal");
  if (s2) s2.textContent = money(subtotal);
}

/* ============================================================
   CARD PREVIEW + BRAND DETECTION (Visa/Mastercard/AmEx/Discover)
   ============================================================ */

(function initCardPreview() {
  function detect(num) {
    const s = (num || "").replace(/\s+/g, "");
    if (/^4[0-9]{6,}$/.test(s)) return "visa";
    if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))[0-9]{4,}$/.test(s))
      return "mastercard";
    if (/^3[47][0-9]{5,}$/.test(s)) return "amex";
    if (/^6(?:011|5)/.test(s)) return "discover";
    return "";
  }
  const SVGS = {
    visa: `<svg viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg"><path fill="#1A1F71" d="M0 16L3.4 0h6.6L6.6 16H0zm12.8 0L16.3 0h6.4L19.2 16h-6.4zm14.7 0l2.8-4.3h5.2L38.3 16h6.5L46 0h-6.4l-9.2 16h-2.9z"/></svg>`,
    mastercard: `<svg viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg"><circle cx="19" cy="8" r="6" fill="#EB001B"/><circle cx="29" cy="8" r="6" fill="#F79E1B"/><path d="M23 2a6 6 0 000 12 6 6 0 000-12z" fill="#FF5F00"/></svg>`,
    amex: `<svg viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="16" rx="2" fill="#2E77BC"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="8" fill="#fff" font-family="Arial, Helvetica, sans-serif">AMEX</text></svg>`,
    discover: `<svg viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="16" rx="2" fill="#fff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="8" fill="#111" font-family="Arial, Helvetica, sans-serif">DISCOVER</text><circle cx="36" cy="8" r="4" fill="#F79E1B"/></svg>`,
  };

  function update() {
    const name = $("#cc_name")?.value || "";
    const numRaw = ($("#cc_number")?.value || "").replace(/[^\d]/g, "");
    const exp = $("#cc_exp")?.value || "";
    const cvc = $("#cc_cvc")?.value || "";

    const chunks = numRaw.match(/.{1,4}/g) || [];
    const numEl = $("#cardNumberPreview");
    if (numEl) numEl.textContent = chunks.join(" ").padEnd(19, "•");

    const nameEl = $("#cardNamePreview");
    if (nameEl) nameEl.textContent = name || "CARDHOLDER NAME";

    const expEl = $("#cardExpPreview");
    if (expEl) expEl.textContent = exp || "MM/YY";

    const cvcEl = $("#cardCvcPreview");
    if (cvcEl) cvcEl.textContent = cvc || "CVC";

    const brand = detect(numRaw);
    const bEl = $("#cardBrand");
    if (brand && SVGS[brand] && bEl)
      bEl.src = "data:image/svg+xml;base64," + btoa(SVGS[brand]);
    else if (bEl) bEl.removeAttribute("src");
  }

  ["cc_name", "cc_number", "cc_exp", "cc_cvc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      if (id === "cc_number") {
        let v = e.target.value.replace(/[^\d]/g, "");
        if (v.length > 16) v = v.slice(0, 16);
        e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
      }
      if (id === "cc_exp") {
        let v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
        if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
        e.target.value = v;
      }
      update();
    });
  });
  document.addEventListener("DOMContentLoaded", update);
})();

// === Mobile drawer: direct listeners (no optional chaining) ===
document.addEventListener("DOMContentLoaded", function () {
  var drawer = document.getElementById("sideMenu");
  var backdrop = document.getElementById("drawerBackdrop");
  var burger = document.getElementById("hamburger");
  var closeX = document.getElementById("closeDrawer");

  function openDrawer() {
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }
  function closeDrawer() {
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }

  if (burger)
    burger.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        openDrawer();
      },
      false
    );
  if (closeX)
    closeX.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        closeDrawer();
      },
      false
    );
  if (backdrop) backdrop.addEventListener("click", closeDrawer, false);
});

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  updateCartUI();
  hydrateSummary();
});
// Robust theme toggle
(function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#themeToggle,[data-theme-toggle]");
    if (!btn) return;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
})();
// Mobile drawer controls
const drawer = document.getElementById("sideMenu");
const db = document.getElementById("drawerBackdrop");
const openDrawer = () => {
  drawer?.classList.add("open");
  db?.classList.add("show");
};
const closeDrawer = () => {
  drawer?.classList.remove("open");
  db?.classList.remove("show");
};

document.addEventListener("click", (e) => {
  if (e.target.closest("#hamburger")) openDrawer();
  if (e.target.closest("#closeDrawer") || e.target === db) closeDrawer();
});
// Make sure cart buttons always respond
document.addEventListener("click", (e) => {
  if (e.target.id === "headerClear") {
    setCart([]);
    toast("Cart cleared");
  }
  if (e.target.id === "closeCart") {
    closeCart();
  }
});
