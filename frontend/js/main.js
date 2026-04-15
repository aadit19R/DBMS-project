import { initAuth } from './auth.js';
import { renderCart } from './cart.js';
import { loadStorefront, loadMyOrders } from './storefront.js';
import { loadDashboard, loadProducts, loadOrders, refreshSchemaMap, openAdminEditorModal, closeAdminEditorModal, removeOrderItem } from './admin.js';
import { loadAnalytics } from './analytics.js';

const SECTIONS = ["dashboard", "products", "orders", "query", "schema-map", "storefront", "my-orders", "analytics-dashboard"];

export function showSection(id) {
  SECTIONS.forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
  if (id === "products")    loadProducts();
  if (id === "orders")      loadOrders();
  if (id === "schema-map")  refreshSchemaMap();
  if (id === "storefront")  loadStorefront();
  if (id === "my-orders")   loadMyOrders();
  if (id === "analytics-dashboard") loadAnalytics();
}

window.showSection = showSection;
window.openAdminEditorModal = openAdminEditorModal;
window.closeAdminEditorModal = closeAdminEditorModal;
window.removeOrderItem = removeOrderItem;

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    renderCart();
});
