import { apiFetch } from './api.js';

let revChartInstance = null;
let catChartInstance = null;

export async function loadAnalytics(startDate, endDate) {
    try {
        let qs = "";
        if (startDate && endDate) {
            qs = `?start_date=${startDate}&end_date=${endDate}`;
        }

        const [revRes, catRes] = await Promise.all([
            apiFetch(`/admin/analytics/revenue${qs}`).then(r => r.json()),
            apiFetch(`/admin/analytics/categories${qs}`).then(r => r.json())
        ]);

        if (revRes.error) throw new Error(revRes.error);
        if (catRes.error) throw new Error(catRes.error);

        renderRevenueChart(revRes);
        renderCategoryChart(catRes);

    } catch (err) {
        console.error("Analytics fetch error:", err);
        alert("Failed to load analytics: " + err.message);
    }
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
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderCategoryChart(data) {
    if (catChartInstance) catChartInstance.destroy();

    const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6", "#ec4899", "#14b8a6"];
    
    catChartInstance = new Chart(document.getElementById("categoryChart"), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.category),
            datasets: [{
                data: data.map(d => parseFloat(d.revenue)),
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// Ensure the apply filters button works
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
