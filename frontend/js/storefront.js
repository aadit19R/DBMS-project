import { apiFetch, fmt, fmtMoney, statusBadge } from './api.js';

export let storefrontProducts = [];

export async function loadStorefront() {
  try {
    storefrontProducts = await apiFetch("/products").then(r => r.json());
    
    // Populate categories
    const categories = [...new Set(storefrontProducts.map(p => p.category))];
    const select = document.getElementById("store-category");
    select.innerHTML = `<option value="">All Categories</option>` + 
                       categories.map(c => `<option value="${c}">${c}</option>`).join("");
    
    filterStorefront();
  } catch (err) {
    console.error("Storefront error:", err);
  }
}

export function filterStorefront() {
  const query = document.getElementById("store-search").value.toLowerCase();
  const cat   = document.getElementById("store-category").value;
  const grid  = document.getElementById("store-grid");

  const filtered = storefrontProducts.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(query);
    const matchesCat   = !cat || p.category === cat;
    return matchesQuery && matchesCat;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">No products found.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="bg-white rounded-lg shadow-md overflow-hidden border flex flex-col hover:shadow-lg transition">
      <div class="p-4 flex-1">
        <div class="text-xs text-indigo-500 uppercase font-bold tracking-wide mb-1">${fmt(p.category)}</div>
        <h3 class="text-lg font-bold text-gray-800 mb-2 truncate" title="${p.name}">${fmt(p.name)}</h3>
        <p class="text-xl text-gray-900 font-extrabold mb-4">${fmtMoney(p.price)}</p>
      </div>
      <div class="p-4 bg-gray-50 border-t">
        <button onclick='addToCart(${JSON.stringify(p).replace(/'/g, "&apos;")})' class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400">
            Add to Cart
        </button>
      </div>
    </div>
  `).join("");
}

export async function loadMyOrders() {
  console.log("Loading orders...");
  try {
    const orders = await apiFetch("/my-orders").then(r => r.json());
    const tbody = document.getElementById("my-orders-body");
    
    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No orders found.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = orders.map(o => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${o.order_id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fmt(o.order_date)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${statusBadge(o.status)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">${fmtMoney(o.total_amount)}</td>
        <td class="px-6 py-4 text-sm text-gray-500">
            <ul class="list-disc pl-4">
                ${(o.items || []).map(item => `<li>${item.quantity}x ${fmt(item.product_name)}</li>`).join("")}
            </ul>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("My orders error:", err);
  }
}

window.filterStorefront = filterStorefront;
