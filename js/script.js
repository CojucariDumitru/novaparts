/* ===========================================================
   NOVAPARTS — Cart + Filters + Nav + Checkout + Toasts
   =========================================================== */

const CART_KEY = "novaparts_cart";

/* ---------- helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const money = n => "$" + (Number(n||0)).toFixed(2);
const slug  = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

/* ---------- tiny toast ---------- */
function toast(msg, ok=true){
  const box = document.createElement("div");
  box.textContent = msg;
  Object.assign(box.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    background: ok ? "#2ecc71" : "#e74c3c",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "10px",
    boxShadow: "0 6px 18px rgba(0,0,0,.25)",
    zIndex: 10000,
    fontWeight: 700,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    transition: "opacity .35s ease",
    opacity: "1"
  });
  document.body.appendChild(box);
  setTimeout(()=>{ box.style.opacity="0"; setTimeout(()=>box.remove(), 350); }, 1600);
}

/* ---------- storage ---------- */
const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
const setCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

/* ---------- badge ---------- */
function updateCartBadge(){
  const el = $("#cart-count");
  if (!el) return;
  const count = getCart().reduce((s,i)=>s+(i.qty||1),0);
  el.textContent = count;
}

/* ---------- core cart ops ---------- */
function addToCart(item){
  if (!item || !item.id) return;
  const cart = getCart();
  const idx = cart.findIndex(p => String(p.id) === String(item.id));
  if (idx > -1) cart[idx].qty = (cart[idx].qty||1) + (item.qty||1);
  else cart.push({ id:item.id, title:item.title||"Item", price:Number(item.price)||0, image:item.image||item.img||"", qty:item.qty||1 });
  setCart(cart);
  updateCartBadge();
  renderCart();
  renderCheckoutSummary();
  toast(`Added ${item.title || "item"} to cart`);
}

function decOrRemove(id){
  const cart = getCart();
  const idx = cart.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return;
  const q = cart[idx].qty||1;
  if (q > 1) {
    cart[idx].qty = q-1;
    toast(`Decreased ${cart[idx].title} to ×${cart[idx].qty}`);
  } else {
    const t = cart[idx].title;
    cart.splice(idx,1);
    toast(`Removed ${t} from cart`, false);
  }
  setCart(cart);
  updateCartBadge();
  renderCart();
  renderCheckoutSummary();
}

function hardRemove(id){
  const cart = getCart();
  const idx = cart.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return;
  const t = cart[idx].title;
  cart.splice(idx,1);
  setCart(cart);
  updateCartBadge();
  renderCart();
  renderCheckoutSummary();
  toast(`Removed ${t} from cart`, false);
}

/* ---------- product → item fallback ---------- */
function itemFromCard(btn){
  const card = btn.closest(".product");
  if (!card) return null;

  const title = $(".p-title, .title, h3, h2", card)?.textContent?.trim() || "Item";
  const priceText =
    (card.querySelector(".price")?.textContent) ||
    btn.dataset.price ||
    "0";
  const price = Number(String(priceText).replace(/[^0-9.]/g,"")) || 0;

  const id = card.dataset.id || btn.dataset.add || slug(title);

  const imgEl = $(".p-img, img", card);
  const image = imgEl ? (imgEl.currentSrc || imgEl.src || "") : (btn.dataset.image || "");

  return { id, title, price, image, qty:1 };
}

/* ---------- filters (shop) ---------- */
function initFilters(){
  const wrap = $(".filters");
  const products = $$(".product");
  if (!wrap || !products.length) return;

  function apply(cat){
    products.forEach(p => {
      const c = p.dataset.cat || "";
      p.style.display = (cat === "all" || c === cat) ? "" : "none";
    });
  }

  let current = $(".filters .pill.active")?.dataset.filter || "all";
  apply(current);

  wrap.addEventListener("click", e=>{
    const pill = e.target.closest(".pill[data-filter]");
    if (!pill) return;
    e.preventDefault();
    $$(".filters .pill").forEach(b=>b.classList.remove("active"));
    pill.classList.add("active");
    apply(pill.dataset.filter);
  });
}

/* ---------- cart page render ---------- */
/* needs: #cart-list, #cart-subtotal */
function renderCart(){
  const list = $("#cart-list");
  const sub  = $("#cart-subtotal");
  if (!list) return;

  const cart = getCart();
  list.innerHTML = "";
  let subtotal = 0;

  if (!cart.length){
    list.innerHTML = `<p class="muted">Your cart is empty.</p>`;
    if (sub) sub.textContent = "$0.00";
    return;
  }

  cart.forEach(it=>{
    const qty = it.qty||1;
    const line = (Number(it.price)||0) * qty;
    subtotal += line;

    const row = document.createElement("article");
    row.className = "cart-row";
    row.dataset.id = it.id;
    row.innerHTML = `
      <div class="cart-info">
        <img src="${it.image||"img/placeholder.png"}" alt="">
        <div>
          <div class="cart-title">${it.title}</div>
          <div class="muted">${money(it.price)}</div>
        </div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-dec="${it.id}" aria-label="Decrease">–</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn" data-inc="${it.id}" aria-label="Increase">+</button>
      </div>
      <div class="line-total">${money(line)}</div>
      <button class="btn-remove" data-remove="${it.id}">Remove</button>
    `;
    list.appendChild(row);
  });

  if (sub) sub.textContent = money(subtotal);
}

/* ---------- checkout summary render ---------- */
/* needs: #summary-list, #summary-subtotal, #summary-total */
function renderCheckoutSummary(){
  const list = $("#summary-list");
  const sub  = $("#summary-subtotal");
  const tot  = $("#summary-total");
  if (!list) return;

  const cart = getCart();
  list.innerHTML = "";
  let subtotal = 0;

  cart.forEach(it=>{
    const qty = it.qty||1;
    const line = (Number(it.price)||0) * qty;
    subtotal += line;

    const el = document.createElement("div");
    el.className = "sum-item";
    el.style.display = "grid";
    el.style.gridTemplateColumns = "auto 1fr auto";
    el.style.gap = "10px";
    el.style.alignItems = "center";

    el.innerHTML = `
      <img src="${it.image||'img/placeholder.png'}" alt="" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.05);padding:4px;">
      <div>
        <div style="font-weight:700">${it.title} <span class="muted" style="font-weight:600">×${qty}</span></div>
      </div>
      <div style="font-weight:700">${money(line)}</div>
    `;
    list.appendChild(el);
  });

  if (sub) sub.textContent = money(subtotal);
  if (tot) tot.textContent = money(subtotal); // shipping free in demo
}

/* ---------- checkout form (demo) ---------- */
function initCheckoutForm(){
  const form = $("#checkout-form");
  if (!form) return;
  form.addEventListener("submit", e=>{
    e.preventDefault();
    alert("✅ Order placed (demo). No payment processed.");
    localStorage.removeItem(CART_KEY);
    updateCartBadge();
    renderCheckoutSummary();
    window.location.href = "index.html";
  });
}

/* ---------- card preview (optional) ---------- */
function initCardPreview(){
  const name = $("#cc-name"), number = $("#cc-number"), exp = $("#cc-exp"), cvc = $("#cc-cvc");
  const pvName = $("#pv-name"), pvNumber = $("#pv-number"), pvExp = $("#pv-exp"), pvCvc = $("#pv-cvc");
  if (!name || !pvName) return;

  const fmtNum = v => v.replace(/\D/g,"").slice(0,16).replace(/(\d{4})(?=\d)/g,"$1 ").trim();
  const fmtExp = v => { const s = v.replace(/\D/g,"").slice(0,4); return s.length<=2 ? s : s.slice(0,2)+"/"+s.slice(2); };
  const fmtCvc = v => v.replace(/\D/g,"").slice(0,4);

  name.addEventListener("input", ()=> pvName.textContent = name.value.trim() || "CARDHOLDER NAME");
  number.addEventListener("input", ()=> { number.value = fmtNum(number.value); pvNumber.textContent = number.value || "•••• •••• •••• ••••"; });
  exp.addEventListener("input", ()=> { exp.value = fmtExp(exp.value); pvExp.textContent = exp.value || "MM/YY"; });
  cvc.addEventListener("input", ()=> { cvc.value = fmtCvc(cvc.value); pvCvc.textContent = cvc.value ? "•".repeat(cvc.value.length) : "•••"; });
}

/* ---------- active nav ---------- */
function markActiveNav(){
  const links = $$(".site-header .nav a");
  if (!links.length) return;
  const path = location.pathname.split("/").pop() || "index.html";
  links.forEach(a=>{
    const href = (a.getAttribute("href")||"").split("/").pop();
    const match = (path === "" || path === "index.html")
      ? (href === "" || href === "index.html")
      : (href === path);
    a.classList.toggle("active", !!match);
  });
}

/* ---------- delegated clicks (universal) ---------- */
document.addEventListener("click", (e)=>{
  // Preferred: data-add button
  const addBtn = e.target.closest("[data-add]");
  if (addBtn){
    e.preventDefault();
    const item = {
      id:    addBtn.dataset.add,
      title: addBtn.dataset.title || "Item",
      price: Number(addBtn.dataset.price || "0"),
      image: addBtn.dataset.image || ""
    };
    addToCart(item.id ? item : itemFromCard(addBtn));
    return;
  }

  // Fallback: any "Add to cart" button inside .product
  const plainAdd = e.target.closest(".product .btn, .product button");
  if (plainAdd){
    const txt = (plainAdd.textContent || "").toLowerCase();
    if (txt.includes("add to cart") || txt.includes("add") || plainAdd.classList.contains("add-to-cart")){
      e.preventDefault();
      const item = itemFromCard(plainAdd);
      if (item) addToCart(item);
      return;
    }
  }

  // qty +/-
  const inc = e.target.closest("[data-inc], .qty-plus");
  if (inc){
    e.preventDefault();
    const id = inc.dataset.inc || inc.closest(".cart-row")?.dataset.id;
    if (!id) return;
    const cart = getCart();
    const item = cart.find(i => String(i.id) === String(id));
    if (item) addToCart({ ...item, qty:1 });
    return;
  }

  const dec = e.target.closest("[data-dec], .qty-minus");
  if (dec){
    e.preventDefault();
    const id = dec.dataset.dec || dec.closest(".cart-row")?.dataset.id;
    if (!id) return;
    decOrRemove(id);
    return;
  }

  const rem = e.target.closest("[data-remove], .remove-line, .btn-remove");
  if (rem){
    e.preventDefault();
    const id = rem.dataset.remove || rem.closest(".cart-row")?.dataset.id;
    if (!id) return;
    hardRemove(id);
    return;
  }
});

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  updateCartBadge();
  initFilters();
  renderCart();
  renderCheckoutSummary();
  initCheckoutForm();
  initCardPreview();
  markActiveNav();
});
