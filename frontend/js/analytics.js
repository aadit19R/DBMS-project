import { apiFetch, fmtMoney } from './api.js';

let revChartInstance = null;
let aovChartInstance = null;
let catChartInstance = null;
let daysChartInstance = null;

export async function loadAnalytics(startDate, endDate) {
    try {
        let qs = "";
        if (startDate && endDate) {
            qs = `?start_date=${startDate}&end_date=${endDate}`;
        }

        const [revRes, catRes, kpiRes, velRes, daysRes] = await Promise.all([
            apiFetch(`/admin/analytics/revenue${qs}`).then(r => r.json()),
            apiFetch(`/admin/analytics/categories${qs}`).then(r => r.json()),
            apiFetch(`/admin/analytics/kpis${qs}`).then(r => r.json()),
            apiFetch(`/admin/analytics/inventory-velocity${qs}`).then(r => r.json()),
            apiFetch(`/admin/analytics/sales-days${qs}`).then(r => r.json())
        ]);


        if (revRes.error) throw new Error(revRes.error);
        if (catRes.error) throw new Error(catRes.error);
        if (kpiRes.error) throw new Error(kpiRes.error);
        
        renderKPIs(kpiRes);
        renderRevenueChart(revRes);
        renderAOVChart(revRes);
        renderCategoryChart(catRes);
        renderDaysChart(daysRes);
        renderInventoryVelocity(velRes);

    } catch (err) {
        console.error("Analytics fetch error:", err);
        alert("Failed to load analytics: " + err.message);
    }
}

function renderKPIs(data) {
    document.getElementById("kpi-aov").textContent = fmtMoney(data.current_aov);
    document.getElementById("kpi-orders").textContent = data.current_orders;

    const renderTrend = (id, percent) => {
        const el = document.getElementById(id);
        if (!data.has_trend) {
            el.classList.add("hidden");
            return;
        }
        el.classList.remove("hidden", "bg-green-100", "text-green-700", "bg-red-100", "text-red-700", "bg-gray-100", "text-gray-700");
        
        if (percent > 0) {
            el.textContent = `▲ ${percent.toFixed(1)}%`;
            el.classList.add("bg-green-100", "text-green-700");
        } else if (percent < 0) {
            el.textContent = `▼ ${Math.abs(percent).toFixed(1)}%`;
            el.classList.add("bg-red-100", "text-red-700");
        } else {
            el.textContent = `— 0.0%`;
            el.classList.add("bg-gray-100", "text-gray-700");
        }
    };

    renderTrend("kpi-aov-trend", data.aov_trend_percent);
    renderTrend("kpi-orders-trend", data.orders_trend_percent);
}

function renderRevenueChart(data) {
    if (revChartInstance) revChartInstance.destroy();
    revChartInstance = new Chart(document.getElementById("revenueChart"), {
        type: 'bar',
        data: {
            labels: data.map(d => d.time_period),
            datasets: [{
                label: 'Revenue ($)',
                data: data.map(d => parseFloat(d.revenue)),
                backgroundColor: '#6366f1'
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderAOVChart(data) {
    if (aovChartInstance) aovChartInstance.destroy();
    
    // Safety check, in case dates dont have any aov
    const filtered_data = data.filter(d => d.aov !== null && d.aov !== undefined);
    
    aovChartInstance = new Chart(document.getElementById("aovChart"), {
        type: 'line',
        data: {
            labels: filtered_data.map(d => d.time_period),
            datasets: [{
                label: 'Average Order Value ($)',
                data: filtered_data.map(d => parseFloat(d.aov)),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderCategoryChart(data) {
    if (catChartInstance) catChartInstance.destroy();
    const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6", "#ec4899", "#14b8a6"];
    catChartInstance = new Chart(document.getElementById("categoryChart"), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.category),
            datasets: [{ data: data.map(d => parseFloat(d.revenue)), backgroundColor: colors }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
}

function renderDaysChart(data) {
    if (daysChartInstance) daysChartInstance.destroy();
    daysChartInstance = new Chart(document.getElementById("daysChart"), {
        type: 'bar',
        data: {
            labels: data.map(d => d.day_name),
            datasets: [{
                label: 'Orders',
                data: data.map(d => d.order_count),
                backgroundColor: '#f59e0b'
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            plugins: { legend: { display: false } }, 
            scales: { x: { beginAtZero: true } } 
        }
    });
}

function renderInventoryVelocity(data) {
    const tbody = document.getElementById("inventory-velocity-body");
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No data found in range</td></tr>`;
        return;
    }
    
    tbody.innerHTML = data.map(r => `
        <tr>
            <td class="px-4 py-3 whitespace-nowrap font-medium text-gray-900">${r.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-right text-gray-600">${r.sold}</td>
            <td class="px-4 py-3 whitespace-nowrap text-right text-gray-600">${r.stock}</td>
            <td class="px-4 py-3 whitespace-nowrap text-right font-bold text-indigo-600">${(r.velocity * 100).toFixed(1)}%</td>
        </tr>
    `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btn-apply-filters");
    if (btn) {
        btn.addEventListener("click", () => {
            const start = document.getElementById("filter-start").value;
            const end = document.getElementById("filter-end").value;
            loadAnalytics(start, end);
        });
    }
});
