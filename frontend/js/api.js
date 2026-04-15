export const API = "http://localhost:5001";

export function getAuthHeaders() {
  const token = localStorage.getItem("jwt_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

export async function apiFetch(endpoint, options = {}) {
  const headers = { ...options.headers, ...getAuthHeaders() };
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401 && window.logout) {
        window.logout();
    }
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  return res;
}

export function fmt(val) {
  return val !== null && val !== undefined ? val : "—";
}

export function fmtMoney(val) {
  return val != null ? "$" + parseFloat(val).toFixed(2) : "—";
}

export function statusBadge(status) {
  const colors = {
    pending:   "bg-yellow-100 text-yellow-800",
    shipped:   "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800"
  };
  const cls = colors[status] || "bg-gray-100 text-gray-700";
  return `<span class="px-2 py-0.5 rounded text-xs font-medium ${cls}">${status}</span>`;
}

export function buildTable(tbodyId, rows, buildRow) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = rows.length
    ? rows.map(buildRow).join("")
    : `<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400">No data</td></tr>`;
}
