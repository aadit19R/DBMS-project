import { apiFetch, fmt, fmtMoney, buildTable } from './api.js';

export async function loadDashboard() {
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

    buildTable("low-stock-body", data.low_stock, r => `
      <tr class="hover:bg-red-50">
        <td class="px-2 py-1 font-medium">${fmt(r.name)}</td>
        <td class="px-2 py-1 text-right font-bold text-red-700">${fmt(r.quantity_stored)}</td>
      </tr>`
    );

    buildTable("pending-orders-body", data.pending_orders, r => `
      <tr class="hover:bg-yellow-50">
        <td class="px-2 py-1">${fmt(r.order_id)}</td>
        <td class="px-2 py-1">${fmt(r.order_date)}</td>
        <td class="px-2 py-1 text-right font-medium">${fmtMoney(r.total_amount)}</td>
      </tr>`
    );
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

let allAdminProducts = [];

export async function loadProducts() {
  try {
    allAdminProducts = await apiFetch("/products").then(r => r.json());

    // Populate category dropdown
    const catSelect = document.getElementById("admin-product-category");
    const categories = [...new Set(allAdminProducts.map(r => r.category))].sort();
    catSelect.innerHTML = `<option value="">All Categories</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join("");

    renderAdminProducts(allAdminProducts);
  } catch (err) {
    console.error("Products error:", err);
  }
}

function renderAdminProducts(rows) {
  buildTable("products-body", rows, r => {
    const stockClass = r.total_stock < 10 ? "font-bold text-red-600" : "text-gray-700";
    return `
      <tr class="hover:bg-gray-50" id="product-row-${r.product_id}">
        <td class="px-3 py-2">${fmt(r.product_id)}</td>
        <td class="px-3 py-2">${fmt(r.name)}</td>
        <td class="px-3 py-2">${fmt(r.category)}</td>
        <td class="px-3 py-2">${fmtMoney(r.price)}</td>
        <td class="px-3 py-2 ${stockClass}" id="stock-cell-${r.product_id}">${fmt(r.total_stock)}</td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-1">
            <button onclick="updateStock(${r.product_id}, -1)" class="w-7 h-7 flex items-center justify-center bg-red-100 text-red-700 font-bold rounded hover:bg-red-200 transition text-base">−</button>
            <input type="number" id="stock-input-${r.product_id}" value="1" min="1" class="w-14 border border-gray-300 rounded text-center text-sm py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400">
            <button onclick="updateStock(${r.product_id}, 1)" class="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 font-bold rounded hover:bg-green-200 transition text-base">+</button>
          </div>
        </td>
        <td class="px-3 py-2">${fmt(r.supplier)}</td>
      </tr>`;
  });
}

window.filterAdminProducts = function() {
  const query  = document.getElementById("admin-product-search").value.toLowerCase();
  const cat    = document.getElementById("admin-product-category").value;
  const filtered = allAdminProducts.filter(r =>
    (!query || r.name.toLowerCase().includes(query)) &&
    (!cat   || r.category === cat)
  );
  renderAdminProducts(filtered);
};

window.updateStock = async function(productId, direction) {
  const inputEl = document.getElementById(`stock-input-${productId}`);
  const amount  = Math.max(1, parseInt(inputEl.value) || 1);
  const delta   = direction * amount;

  try {
    const res  = await apiFetch(`/products/${productId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    // Update local cache
    const product = allAdminProducts.find(p => p.product_id === productId);
    if (product) product.total_stock = data.total_stock;

    // Update just the stock cell in-place (no full re-render flicker)
    const cell = document.getElementById(`stock-cell-${productId}`);
    if (cell) {
      cell.textContent = data.total_stock;
      cell.className = `px-3 py-2 ${ data.total_stock < 10 ? "font-bold text-red-600" : "text-gray-700" }`;
    }
  } catch (err) {
    console.error("Stock update error:", err);
    alert("Failed to update stock.");
  }
};

export async function loadOrders() {
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
        <td class="px-3 py-2">
            <button onclick="openAdminEditorModal(${r.order_id})" class="text-indigo-600 hover:text-indigo-900 font-medium text-xs border border-indigo-600 rounded px-2 py-1">Edit</button>
        </td>
      </tr>`
    );
  } catch (err) {
    console.error("Orders error:", err);
  }
}

export async function updateOrderStatus(orderId, newStatus) {
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

export async function openAdminEditorModal(orderId) {
    try {
        const items = await apiFetch(`/admin/orders/${orderId}/items`).then(r => r.json());
        if (items.error) throw new Error(items.error);

        document.getElementById("admin-editor-title").textContent = `Edit Order #${orderId}`;
        const tbody = document.getElementById("admin-editor-items");
        
        tbody.innerHTML = items.map(item => `
            <tr class="hover:bg-gray-50">
                <td class="px-3 py-2">${fmt(item.name)}</td>
                <td class="px-3 py-2">${fmt(item.quantity)}</td>
                <td class="px-3 py-2">${fmtMoney(item.unit_price)}</td>
                <td class="px-3 py-2 text-right">
                    <button onclick="removeOrderItem(${orderId}, ${item.product_id})" class="text-red-600 hover:text-red-900 border border-red-600 rounded px-2 py-1 text-xs">Remove</button>
                </td>
            </tr>
        `).join("");

        document.getElementById("admin-editor-overlay").classList.remove("hidden");
        document.getElementById("admin-editor-modal").classList.remove("hidden");
    } catch (err) {
        alert("Error fetching order items: " + err.message);
    }
}

export function closeAdminEditorModal() {
    document.getElementById("admin-editor-overlay").classList.add("hidden");
    document.getElementById("admin-editor-modal").classList.add("hidden");
}

export async function removeOrderItem(orderId, productId) {
    if (!confirm("Are you sure you want to remove this item?")) return;
    try {
        const res = await apiFetch(`/admin/orders/${orderId}/items/${productId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "remove" })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to remove item");

        alert("Success: " + data.message);
        
        // Refresh items or close modal
        openAdminEditorModal(orderId);
        
        // Refresh the underlying orders table
        loadOrders();
        loadDashboard(); // Refresh metrics since order total changed
    } catch (err) {
        alert("Error removing item: " + err.message);
    }
}

export async function runQuery() {
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

let panZoomInstance = null;

export async function refreshSchemaMap() {
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
    if (window.mermaid) {
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
    }

  } catch (err) {
    console.error("Schema fetch error:", err);
  }
}

// Ensure mermaid initialization still happens somewhere
if (window.mermaid) {
  window.mermaid.initialize({
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
}

window.updateOrderStatus = updateOrderStatus;
window.runQuery = runQuery;
window.loadDashboard = loadDashboard;
