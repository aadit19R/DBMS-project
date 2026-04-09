const API = "http://localhost:5001";

// -------------------------------------------------------------------
// Section Navigation
// -------------------------------------------------------------------
const SECTIONS = ["dashboard", "products", "orders", "query"];

function showSection(id) {
  SECTIONS.forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
  if (id === "products")  loadProducts();
  if (id === "orders")    loadOrders();
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
// Dashboard
// -------------------------------------------------------------------
let chartMonth    = null;
let chartCategory = null;

async function loadDashboard() {
  const data = await fetch(`${API}/analytics`).then(r => r.json());

  // Cards
  const s = data.summary;
  document.getElementById("card-sales").textContent     = fmtMoney(s.total_sales);
  document.getElementById("card-orders").textContent    = fmt(s.total_orders);
  document.getElementById("card-customers").textContent = fmt(s.active_customers);
  document.getElementById("card-products").textContent  = fmt(s.total_products);

  // Top products table
  buildTable("top-products-body", data.top_products, r => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 py-2">${fmt(r.name)}</td>
      <td class="px-3 py-2">${fmt(r.total_qty)}</td>
      <td class="px-3 py-2">${fmtMoney(r.revenue)}</td>
    </tr>`
  );

  // Customer history table
  buildTable("customer-history-body", data.customer_history, r => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 py-2">${fmt(r.name)}</td>
      <td class="px-3 py-2">${fmt(r.total_orders)}</td>
      <td class="px-3 py-2">${fmtMoney(r.total_spent)}</td>
    </tr>`
  );

  // Chart: Revenue by Month
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

  // Chart: Revenue by Category
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
}

// -------------------------------------------------------------------
// Products
// -------------------------------------------------------------------
async function loadProducts() {
  const rows = await fetch(`${API}/products`).then(r => r.json());
  buildTable("products-body", rows, r => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 py-2">${fmt(r.product_id)}</td>
      <td class="px-3 py-2">${fmt(r.name)}</td>
      <td class="px-3 py-2">${fmt(r.category)}</td>
      <td class="px-3 py-2">${fmtMoney(r.price)}</td>
      <td class="px-3 py-2">${fmt(r.supplier)}</td>
    </tr>`
  );
}

// -------------------------------------------------------------------
// Orders
// -------------------------------------------------------------------
async function loadOrders() {
  const rows = await fetch(`${API}/orders`).then(r => r.json());
  buildTable("orders-body", rows, r => `
    <tr class="hover:bg-gray-50">
      <td class="px-3 py-2">${fmt(r.order_id)}</td>
      <td class="px-3 py-2">${fmt(r.customer)}</td>
      <td class="px-3 py-2">${fmt(r.order_date)}</td>
      <td class="px-3 py-2">${statusBadge(r.status)}</td>
      <td class="px-3 py-2">${fmt(r.item_count)}</td>
      <td class="px-3 py-2">${fmtMoney(r.total_amount)}</td>
    </tr>`
  );
}

// -------------------------------------------------------------------
// SQL Query Runner
// -------------------------------------------------------------------
async function runQuery() {
  const sql      = document.getElementById("query-input").value.trim();
  const errBox   = document.getElementById("query-error");
  const results  = document.getElementById("query-results");
  const thead    = document.getElementById("query-thead");
  const tbody    = document.getElementById("query-tbody");

  errBox.classList.add("hidden");
  results.classList.add("hidden");

  if (!sql) {
    errBox.textContent = "Please enter a query.";
    errBox.classList.remove("hidden");
    return;
  }

  const res  = await fetch(`${API}/run-query`, {
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
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------
loadDashboard();
