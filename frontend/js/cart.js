import { apiFetch, fmt, fmtMoney } from './api.js';

export let cart = JSON.parse(localStorage.getItem("cart") || "[]");

export function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

export function toggleCart() {
  const overlay = document.getElementById("cart-overlay");
  const sidebar = document.getElementById("cart-sidebar");
  
  if (sidebar.classList.contains("translate-x-full")) {
    overlay.classList.remove("hidden");
    sidebar.classList.remove("translate-x-full");
    renderCart();
  } else {
    overlay.classList.add("hidden");
    sidebar.classList.add("translate-x-full");
  }
}

export function addToCart(product) {
  const existing = cart.find(item => item.product_id === product.product_id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.product_id,
      name: product.name,
      unit_price: product.price,
      quantity: 1
    });
  }
  renderCart();
  saveCart();
  
  // Pulse animation on the cart count
  const countBadge = document.getElementById("cart-count");
  countBadge.classList.add("animate-ping");
  setTimeout(() => countBadge.classList.remove("animate-ping"), 300);
}

export function updateQuantity(pid, delta) {
  const index = cart.findIndex(item => item.product_id === pid);
  if (index !== -1) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
  }
  renderCart();
  saveCart();
}

export function renderCart() {
  const itemsContainer = document.getElementById("cart-items");
  const subtotalBox    = document.getElementById("cart-subtotal");
  const countBadge     = document.getElementById("cart-count");
  const checkoutBtn    = document.getElementById("checkout-btn");

  let totalCount = 0;
  let subtotal   = 0;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `<div class="text-center text-gray-500 mt-10">Your cart is empty.</div>`;
    checkoutBtn.classList.add("opacity-50", "cursor-not-allowed");
    checkoutBtn.disabled = true;
  } else {
    checkoutBtn.classList.remove("opacity-50", "cursor-not-allowed");
    checkoutBtn.disabled = false;

    itemsContainer.innerHTML = cart.map(item => {
      totalCount += item.quantity;
      subtotal += item.quantity * item.unit_price;

      return `
        <div class="flex justify-between items-center bg-white p-3 border rounded shadow-sm">
          <div class="flex-1 min-w-0 pr-4">
            <h4 class="font-bold text-sm text-gray-800 truncate" title="${item.name}">${fmt(item.name)}</h4>
            <p class="text-xs text-gray-500">${fmtMoney(item.unit_price)} each</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center border rounded">
              <button onclick="updateQuantity(${item.product_id}, -1)" class="px-2 py-1 text-gray-600 hover:bg-gray-100">-</button>
              <span class="px-2 text-sm font-bold w-6 text-center">${item.quantity}</span>
              <button onclick="updateQuantity(${item.product_id}, 1)" class="px-2 py-1 text-gray-600 hover:bg-gray-100">+</button>
            </div>
            <div class="font-bold text-indigo-600 text-sm w-16 text-right">
              ${fmtMoney(item.quantity * item.unit_price)}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  countBadge.textContent = totalCount;
  subtotalBox.textContent = fmtMoney(subtotal);
}

export async function checkout() {
  console.log("Starting checkout...", cart);
  if (cart.length === 0) return;
  
  const errBox = document.getElementById("checkout-error");
  const btn    = document.getElementById("checkout-btn");
  errBox.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    const res = await apiFetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart })
    });
    const data = await res.json();
    console.log("Checkout Response:", data);
    if (!res.ok) throw new Error(data.error || "Checkout failed");

    // Clear cart and reset UI on success
    cart = [];
    saveCart();
    renderCart();
    toggleCart();
    
    // Auto-navigate to My Orders where the newly inserted order will be fetched
    if (window.showSection) window.showSection("my-orders");
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
}

window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.checkout = checkout;
