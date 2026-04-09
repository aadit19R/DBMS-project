const API = "http://localhost:5001";

// -------------------------------------------------------------------
// REST API Wrapper
// -------------------------------------------------------------------
function getAuthHeaders() {
  const token = localStorage.getItem("jwt_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

async function apiFetch(endpoint, options = {}) {
  const headers = { ...options.headers, ...getAuthHeaders() };
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401) logout();
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  return res;
}

// -------------------------------------------------------------------
// Authentication
// -------------------------------------------------------------------
function showAuthForm(id) {
  ["login-form", "register-form", "forgot-password-form", "reset-password-form"].forEach(formId => {
    document.getElementById(formId).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

async function login() {
  const userInput = document.getElementById("login-username").value.trim();
  const passInput = document.getElementById("login-password").value.trim();
  const errorBox  = document.getElementById("login-error");

  errorBox.classList.add("hidden");
  if (!userInput || !passInput) {
    errorBox.textContent = "Please enter both username and password.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: userInput, password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("jwt_token", data.access_token);
    localStorage.setItem("user_role", data.role);
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    initAuth();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

function logout() {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("user_role");
  initAuth();
}

async function register() {
  const nameInput     = document.getElementById("reg-name").value.trim();
  const emailInput    = document.getElementById("reg-email").value.trim();
  const usernameInput = document.getElementById("reg-username").value.trim();
  const passInput     = document.getElementById("reg-password").value.trim();
  const errorBox      = document.getElementById("register-error");

  errorBox.classList.add("hidden");
  if (!nameInput || !emailInput || !usernameInput || !passInput) {
    errorBox.textContent = "Please fill in all fields.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput, email: emailInput, username: usernameInput, password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    // Auto-login after successful registration
    document.getElementById("login-username").value = usernameInput;
    document.getElementById("login-password").value = passInput;
    login();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

async function forgotPassword() {
  const emailInput = document.getElementById("forgot-email").value.trim();
  const msgBox     = document.getElementById("forgot-message");

  msgBox.classList.add("hidden");
  msgBox.className = "hidden mb-4 text-sm px-3 py-2 rounded";
  if (!emailInput) {
    msgBox.textContent = "Please enter your email.";
    msgBox.classList.add("bg-red-50", "text-red-600", "border-red-200", "border");
    msgBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    msgBox.textContent = data.message;
    msgBox.classList.add("bg-green-50", "text-green-600", "border-green-200", "border");
    msgBox.classList.remove("hidden");
  } catch (err) {
    msgBox.textContent = err.message;
    msgBox.classList.add("bg-red-50", "text-red-600", "border-red-200", "border");
    msgBox.classList.remove("hidden");
  }
}

async function resetPassword() {
  const passInput  = document.getElementById("reset-password").value.trim();
  const errorBox   = document.getElementById("reset-error");
  const successBox = document.getElementById("reset-success");

  errorBox.classList.add("hidden");
  successBox.classList.add("hidden");

  if (!passInput) {
    errorBox.textContent = "Please enter a new password.";
    errorBox.classList.remove("hidden");
    return;
  }

  const token = new URLSearchParams(window.location.search).get('reset_token');

  try {
    const res = await fetch(`${API}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    successBox.textContent = data.message;
    successBox.classList.remove("hidden");
    document.getElementById("reset-password").value = "";
    window.history.replaceState({}, document.title, "/");
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

function initAuth() {
  const token = localStorage.getItem("jwt_token");
  const role  = localStorage.getItem("user_role");
  const loginSection = document.getElementById("login-section");
  const appContainer = document.getElementById("app-container");

  if (!token) {
    loginSection.classList.remove("hidden");
    appContainer.classList.add("hidden");
    const resetToken = new URLSearchParams(window.location.search).get('reset_token');
    showAuthForm(resetToken ? 'reset-password-form' : 'login-form');
  } else {
    loginSection.classList.add("hidden");
    appContainer.classList.remove("hidden");

    if (role === "admin") {
      document.getElementById("nav-admin").classList.remove("hidden");
      document.getElementById("nav-user").classList.add("hidden");
      showSection("dashboard");
      loadDashboard();
    } else {
      document.getElementById("nav-admin").classList.add("hidden");
      document.getElementById("nav-user").classList.remove("hidden");
      showSection("storefront");
    }
  }
}

// -------------------------------------------------------------------
// Section Navigation
// -------------------------------------------------------------------
const SECTIONS = ["dashboard", "products", "orders", "query", "schema-map", "storefront", "my-orders"];

function showSection(id) {
  SECTIONS.forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
  if (id === "products")    loadProducts();
  if (id === "orders")      loadOrders();
  if (id === "schema-map")  refreshSchemaMap();
  if (id === "storefront")  loadStorefront();
  if (id === "my-orders")   loadMyOrders();
}

// -------------------------------------------------------------------
// Utility
// -------------------------------------------------------------------
function fmt(val) {
  return val !== null && val !== undefined ? val : "—";
}

function fmtMoney(val) {
  return val != null ? "$" + parseFloat(val).toFixed(2) : "—";
}

function statusBadge(status) {
  const colors = {
    pending:   "bg-yellow-100 text-yellow-800",
    shipped:   "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800"
  };
  const cls = colors[status] || "bg-gray-100 text-gray-700";
  return `<span class="px-2 py-0.5 rounded text-xs font-medium ${cls}">${status}</span>`;
}

function buildTable(tbodyId, rows, buildRow) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = rows.length
    ? rows.map(buildRow).join("")
    : `<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400">No data</td></tr>`;
}

// -------------------------------------------------------------------
// Storefront & Cart (User)
// -------------------------------------------------------------------
let storefrontProducts = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

async function loadStorefront() {
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

function filterStorefront() {
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

function toggleCart() {
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

function addToCart(product) {
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

function updateQuantity(pid, delta) {
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

function renderCart() {
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

async function checkout() {
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
    showSection("my-orders");
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
}

async function loadMyOrders() {
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

// -------------------------------------------------------------------
// Dashboard Admin Views
// -------------------------------------------------------------------
let chartMonth    = null;
let chartCategory = null;

async function loadDashboard() {
  try {
    const data = await apiFetch("/analytics").then(r => r.json());
    const s = data.summary;

    document.getElementById("card-sales").textContent     = fmtMoney(s.total_sales);
    document.getElementById("card-orders").textContent    = fmt(s.total_orders);
    document.getElementById("card-customers").textContent = fmt(s.active_customers);
    document.getElementById("card-products").textContent  = fmt(s.total_products);

    buildTable("top-products-body", data.top_products, r => `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2">${fmt(r.name)}</td>
        <td class="px-3 py-2">${fmt(r.total_qty)}</td>
        <td class="px-3 py-2">${fmtMoney(r.revenue)}</td>
      </tr>`
    );

    buildTable("customer-history-body", data.customer_history, r => `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2">${fmt(r.name)}</td>
        <td class="px-3 py-2">${fmt(r.total_orders)}</td>
        <td class="px-3 py-2">${fmtMoney(r.total_spent)}</td>
      </tr>`
    );

    if (chartMonth) chartMonth.destroy();
    chartMonth = new Chart(document.getElementById("chartMonth"), {
      type: "bar",
      data: {
        labels:   data.by_month.map(r => r.month),
        datasets: [{
          label:           "Revenue ($)",
          data:            data.by_month.map(r => parseFloat(r.revenue)),
          backgroundColor: "#6366f1"
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales:  { y: { beginAtZero: true } }
      }
    });

    if (chartCategory) chartCategory.destroy();
    const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6"];
    chartCategory = new Chart(document.getElementById("chartCategory"), {
      type: "doughnut",
      data: {
        labels:   data.by_category.map(r => r.category),
        datasets: [{
          data:            data.by_category.map(r => parseFloat(r.revenue)),
          backgroundColor: colors
        }]
      },
      options: {
        plugins: { legend: { position: "bottom" } }
      }
    });
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

async function loadProducts() {
  try {
    const rows = await apiFetch("/products").then(r => r.json());
    buildTable("products-body", rows, r => `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2">${fmt(r.product_id)}</td>
        <td class="px-3 py-2">${fmt(r.name)}</td>
        <td class="px-3 py-2">${fmt(r.category)}</td>
        <td class="px-3 py-2">${fmtMoney(r.price)}</td>
        <td class="px-3 py-2">${fmt(r.supplier)}</td>
      </tr>`
    );
  } catch (err) {
    console.error("Products error:", err);
  }
}

async function loadOrders() {
  try {
    const rows = await apiFetch("/orders").then(r => r.json());
    buildTable("orders-body", rows, r => `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2">${fmt(r.order_id)}</td>
        <td class="px-3 py-2">${fmt(r.customer)}</td>
        <td class="px-3 py-2">${fmt(r.order_date)}</td>
        <td class="px-3 py-2">
            <select onchange="updateOrderStatus(${r.order_id}, this.value)" class="bg-gray-700 text-white rounded px-2 py-1 text-sm border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="shipped" ${r.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                <option value="delivered" ${r.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
        </td>
        <td class="px-3 py-2">${fmt(r.item_count)}</td>
        <td class="px-3 py-2">${fmtMoney(r.total_amount)}</td>
      </tr>`
    );
  } catch (err) {
    console.error("Orders error:", err);
  }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await apiFetch(`/admin/orders/${orderId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || "Failed to update status");
        }
        
        // Show success alert
        alert(`Success: Order #${orderId} updated to ${newStatus}`);
    } catch (err) {
        alert("Error updating order status: " + err.message);
        // Revert UI automatically by reloading orders
        loadOrders();
    }
}

async function runQuery() {
  const sql     = document.getElementById("query-input").value.trim();
  const errBox  = document.getElementById("query-error");
  const results = document.getElementById("query-results");
  const thead   = document.getElementById("query-thead");
  const tbody   = document.getElementById("query-tbody");

  errBox.classList.add("hidden");
  results.classList.add("hidden");

  if (!sql) {
    errBox.textContent = "Please enter a query.";
    errBox.classList.remove("hidden");
    return;
  }

  try {
    const res  = await apiFetch("/run-query", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query: sql })
    });
    const data = await res.json();

    if (data.error) {
      errBox.textContent = data.error;
      errBox.classList.remove("hidden");
      return;
    }

    if (!data.rows.length) {
      errBox.textContent = "Query returned no results.";
      errBox.classList.remove("hidden");
      return;
    }

    thead.innerHTML = `<tr>${data.columns.map(c =>
      `<th class="px-3 py-2">${c}</th>`
    ).join("")}</tr>`;

    tbody.innerHTML = data.rows.map(row =>
      `<tr class="hover:bg-gray-50">${data.columns.map(c =>
        `<td class="px-3 py-2">${row[c] != null ? row[c] : "NULL"}</td>`
      ).join("")}</tr>`
    ).join("");

    results.classList.remove("hidden");
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove("hidden");
  }
}

// -------------------------------------------------------------------
// Schema Map Visualizer
// -------------------------------------------------------------------
let panZoomInstance = null;

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor:       '#52f9aeff',
    primaryTextColor:   '#000000ff',
    primaryBorderColor: '#334155',
    lineColor:          '#38bdf8',
    secondaryColor:     '#0f172a',
    tertiaryColor:      '#1e293b'
  },
  er: { layoutDirection: 'TB' }
});

async function refreshSchemaMap() {
  try {
    const data = await apiFetch("/schema-metadata").then(r => r.json());

    // Build Mermaid ER diagram string
    let diagram = "erDiagram\n";

    for (const [tableName, tableData] of Object.entries(data.tables)) {
      diagram += `    ${tableName} {\n`;
      tableData.columns.forEach(col => {
        const keyStr = col.key === 'PRI' ? "PK" : (col.key === 'MUL' ? "FK" : "");
        const safeType = (col.type || "string").replace(/[^a-zA-Z0-9_]/g, '');
        diagram += `        ${safeType} ${col.name} ${keyStr}\n`;
      });
      diagram += `    }\n`;
    }

    data.relationships.forEach(fk => {
      diagram += `    ${fk.TABLE_NAME} }o--|| ${fk.REFERENCED_TABLE_NAME} : ""\n`;
    });

    // Render into container
    const container = document.getElementById("mynetwork");
    const { svg } = await mermaid.render('mermaid-graph-svg', diagram);
    container.innerHTML = svg;

    // Apply pan-zoom to the rendered SVG
    const rawSvg = container.querySelector('svg');
    if (rawSvg) {
      rawSvg.style.width    = "100%";
      rawSvg.style.height   = "100%";
      rawSvg.style.maxWidth = "none";

      if (panZoomInstance) panZoomInstance.destroy();

      panZoomInstance = svgPanZoom(rawSvg, {
        zoomEnabled:        true,
        controlIconsEnabled: false,
        fit:    true,
        center: true,
        minZoom: 0.5,
        maxZoom: 5
      });
    }

    // Wire zoom buttons
    document.getElementById("zoom-in").onclick     = () => { if (panZoomInstance) panZoomInstance.zoomIn(); };
    document.getElementById("zoom-out").onclick    = () => { if (panZoomInstance) panZoomInstance.zoomOut(); };
    document.getElementById("fit-canvas").onclick  = () => { if (panZoomInstance) { panZoomInstance.fit(); panZoomInstance.center(); } };

  } catch (err) {
    console.error("Schema fetch error:", err);
  }
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------
initAuth();
renderCart();
