import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Data Configuration
// =========================================================================
// 🔧 การตั้งค่าการเชื่อมต่อ (Connection Config)
// =========================================================================
// 1. ถ้ารันในเครื่องตัวเอง (Localhost) ให้ใช้: "" (เว้นว่าง) หรือ "http://localhost:5000"
// 2. ถ้าเอาเว็บขึ้น Netlify ต้องใส่ URL ของ ngrok ที่ได้มา เช่น "https://xxxx.ngrok-free.app"
const SERVER_URL = "https://crispy-meme-1.onrender.com";
// =========================================================================

const wasteClasses = [
    { id: 'plastic_bottle', name: 'ขวดพลาสติก', icon: 'fa-bottle-water', color: '#34d399' },
    { id: 'plastic_cap', name: 'ฝาขวด', icon: 'fa-circle-dot', color: '#94a3b8' },
    { id: 'plastic_cup', name: 'แก้วพลาสติก', icon: 'fa-glass-water', color: '#38bdf8' },
    { id: 'aluminum_can', name: 'กระป๋อง', icon: 'fa-whiskey-glass', color: '#60a5fa' },
    { id: 'plastic_bag', name: 'ถุงพลาสติก', icon: 'fa-bag-shopping', color: '#818cf8' },
    { id: 'plastic_film', name: 'ถุงขนม', icon: 'fa-cookie', color: '#a5b4fc' },
    { id: 'battery', name: 'ถ่าน', icon: 'fa-battery-full', color: '#ef4444' },
    { id: 'paper_box', name: 'กล่องกระดาษ', icon: 'fa-box-open', color: '#fbbf24' },
    { id: 'paper_carton', name: 'กล่องนม', icon: 'fa-cow', color: '#f472b6' },
    { id: 'glass_bottle', name: 'ขวดแก้ว', icon: 'fa-wine-bottle', color: '#a78bfa' }
];

// Firebase Configuration from User
const firebaseConfig = {
    apiKey: "AIzaSyCnKVorNI7C8-z_Ce1cVbXdIZnFGS_yARg",
    authDomain: "smartbin-tce.firebaseapp.com",
    databaseURL: "https://smartbin-tce-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smartbin-tce",
    storageBucket: "smartbin-tce.firebasestorage.app",
    messagingSenderId: "526794842119",
    appId: "1:526794842119:web:22f8788e53eda1831f0aa2",
    measurementId: "G-VXVR50JJ4Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
// State
// Try to load from LocalStorage first to prevent "reset" feeling
const savedWasteData = localStorage.getItem('smartbin_wasteData');
const savedBinLevels = localStorage.getItem('smartbin_binLevels');

let wasteData = savedWasteData ? JSON.parse(savedWasteData) : {};
let binLevels = savedBinLevels ? JSON.parse(savedBinLevels) : [0, 0, 0, 0];
let chartInstance = null;
let lastInteractionTime = 0;
let isOnline = false;

// Debug Logger
function logToScreen(msg) {
    console.log(msg);
    const debugEl = document.getElementById('debugConsole');
    if (debugEl) {
        const p = document.createElement('div');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        p.style.borderBottom = "1px solid #333";
        debugEl.prepend(p);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Create Debug Element
    const dbg = document.createElement('div');
    dbg.id = 'debugConsole';
    dbg.style.position = 'fixed';
    dbg.style.bottom = '0';
    dbg.style.left = '0';
    dbg.style.width = '100%';
    dbg.style.height = '150px';
    dbg.style.background = 'rgba(0,0,0,0.8)';
    dbg.style.color = '#0f0';
    dbg.style.fontSize = '12px';
    dbg.style.overflowY = 'scroll';
    dbg.style.zIndex = '9999';
    dbg.style.padding = '10px';
    dbg.style.fontFamily = 'monospace';
    document.body.appendChild(dbg);

    logToScreen("DOM Loaded. Script starting...");

    // Only initialize zeros if empty (and not loaded from storage)
    wasteClasses.forEach(c => {
        if (typeof wasteData[c.id] === 'undefined') {
            wasteData[c.id] = 0;
        }
    });

    renderDate();
    renderWasteGrid();
    initChart();
    initHistoryChart();
    updateUI();

    // Start Listening to Realtime Database
    listenToFirebase();

    // Event Listeners for 4 Sliders (Simulation)
    [0, 1, 2, 3].forEach(index => {
        const slider = document.getElementById(`sensorSlider${index}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                // Determine if we need to update whole array or just one
                // For simulation simplicity, we read all sliders and update array
                updateBinLevelsFromSliders();
            });
        }
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดใช่หรือไม่?')) {
            resetDataFirebase();
        }
    });
});

function listenToFirebase() {
    logToScreen("Connecting to Firebase...");
    try {
        const dbRef = ref(db, '/');
        logToScreen("Database Ref created. Waiting for data...");

        onValue(dbRef, (snapshot) => {
            logToScreen("Data received!");
            try {
                const data = snapshot.val() || {};
                logToScreen("Data keys: " + Object.keys(data).join(', '));

                wasteData = data.counts || {};

                // Save to LocalStorage
                localStorage.setItem('smartbin_wasteData', JSON.stringify(wasteData));
                // Ensure 0 for missing keys
                wasteClasses.forEach(c => {
                    if (wasteData[c.id] === undefined) wasteData[c.id] = 0;
                });

                binLevels = data.bin_levels || [0, 0, 0, 0];
                localStorage.setItem('smartbin_binLevels', JSON.stringify(binLevels));

                updateUI();

                if (data.history) {
                    updateHistoryChart(data.history);
                    updateHistorySidebar(data.history);
                    renderHistoryPageChart(data.history);
                    renderHistoryTable(data.history);
                } else {
                    updateHistoryChart({});
                    updateHistorySidebar({});
                    renderHistoryPageChart({});
                    renderHistoryTable({});
                }

                setOnlineStatus(true);
                logToScreen("UI Updated & Online.");
            } catch (err) {
                logToScreen("JS Error in onValue: " + err.message);
                console.error(err);
                setOnlineStatus(false, "JS Error: " + err.message);
            }
        }, (error) => {
            logToScreen("Firebase Auth/Network Error: " + error.code + " - " + error.message);
            console.error("Firebase Error:", error);
            setOnlineStatus(false, "DB Error: " + error.code);
        });
    } catch (e) {
        logToScreen("Sync Start Error: " + e.message);
    }
}

function updateBinLevelsFromSliders() {
    // Read all sliders
    const newLevels = [];
    for (let i = 0; i < 4; i++) {
        const slider = document.getElementById(`sensorSlider${i}`);
        newLevels.push(parseInt(slider.value) || 0);
    }

    // Update local immediately for smooth UI
    binLevels = newLevels;
    localStorage.setItem('smartbin_binLevels', JSON.stringify(binLevels));
    updateBinStatusVisuals();

    // Send to Firebase
    set(ref(db, 'bin_levels'), newLevels);
}

function updateCount(id, delta) {
    // Optimistic Update
    wasteData[id] += delta;
    localStorage.setItem('smartbin_wasteData', JSON.stringify(wasteData));
    updateUI();

    // Call Server API to ensure consistency with AI Camera logic and proper history tracking
    // Uses SERVER_URL defined at the top
    const apiUrl = SERVER_URL ? `${SERVER_URL}/api/detect` : '/api/detect';

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            class_id: id,
            count: delta
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Updated via API:", data);
            } else {
                console.error("API Error:", data);
            }
        })
        .catch(error => {
            console.error("API Network Error:", error);
        });
}

async function resetDataFirebase() {
    set(ref(db, 'counts'), {
        "plastic_bottle": 0, "plastic_cap": 0, "plastic_cup": 0, "aluminum_can": 0,
        "plastic_bag": 0, "plastic_film": 0, "battery": 0, "paper_box": 0,
        "paper_carton": 0, "glass_bottle": 0
    });
    // Don't reset history
}

/*
// Remove old polling functions
// pollData, updateCount (old), flushUpdates...
*/

// Re-expose simple updateCount for onclick
window.updateCount = updateCount;



function setOnlineStatus(online, msg) {
    isOnline = online;
    const el = document.getElementById('apiStatus');
    if (!el) return;
    const span = el.querySelector('span');

    if (online) {
        el.className = 'api-status online';
        span.textContent = 'Online';
    } else {
        el.className = 'api-status offline';
        span.textContent = msg || 'Offline';
    }
}

function renderDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const el = document.getElementById('dateDisplay');
    if (el) el.textContent = new Date().toLocaleDateString('th-TH', options);
}

function renderWasteGrid() {
    const grid = document.querySelector('.waste-grid');
    if (!grid) return;
    grid.innerHTML = '';

    wasteClasses.forEach(item => {
        const card = document.createElement('div');
        card.className = 'waste-card';
        card.innerHTML = `
            <div class="waste-icon">
                <i class="fa-solid ${item.icon}"></i>
            </div>
            <div class="waste-name">${item.name}</div>
            <div class="waste-count" id="count-${item.id}">0</div>
            <button class="control-btn" onclick="updateCount('${item.id}', 1)">
                <i class="fa-solid fa-plus"></i>
            </button>
        `;
        grid.appendChild(card);
    });
}

// Expose to global scope
window.updateCount = updateCount;

function updateUI() {
    // Update Counts
    wasteClasses.forEach(c => {
        const el = document.getElementById(`count-${c.id}`);
        if (el) el.textContent = wasteData[c.id];
    });

    // Update Grand Total
    const total = Object.values(wasteData).reduce((a, b) => a + b, 0);
    const grandTotalOp = document.getElementById('grandTotal');
    if (grandTotalOp) grandTotalOp.textContent = total;

    // Update Chart
    // Note: Manual updates now handled separately in updateCount
    if (chartInstance) {
        chartInstance.data.datasets[0].data = wasteClasses.map(c => wasteData[c.id]);
        chartInstance.update('none');
    }

    // Update Bin Status
    updateBinStatusVisuals();
}

function updateBinStatusVisuals() {
    // Loop through 4 compartments
    for (let i = 0; i < 4; i++) {
        const level = binLevels[i] || 0;
        const progress = document.getElementById(`binGauge${i}`);
        const valueContainer = progress ? progress.querySelector('.value-container') : null;
        const statusText = document.getElementById(`binStatusText${i}`);
        const slider = document.getElementById(`sensorSlider${i}`);
        const valLabel = document.getElementById(`val${i}`);

        if (progress && valueContainer && statusText) {
            valueContainer.textContent = `${level}%`;

            // Update slider if it exists
            if (slider) slider.value = level;
            if (valLabel) valLabel.textContent = level;

            let color = '#10b981'; // Green
            let text = 'ปกติ';

            if (level > 70) {
                color = '#f59e0b'; // Yellow
                text = 'เริ่มเต็ม';
            }
            if (level > 90) {
                color = '#ef4444'; // Red
                text = 'เต็ม!';
            }

            progress.style.background = `conic-gradient(${color} ${level * 3.6}deg, #e5e7eb ${level * 3.6}deg)`;
            statusText.textContent = text;
            statusText.style.color = color;
        }
    }
}

function initChart() {
    const ctxEl = document.getElementById('summaryChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: wasteClasses.map(c => c.name),
            datasets: [{
                label: 'จำนวน (ชิ้น)',
                data: wasteClasses.map(c => wasteData[c.id]),
                backgroundColor: wasteClasses.map(c => c.color),
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

// History Chart Logic
let historyChartInstance = null;


async function fetchHistory() {
    try {
        // We already have history from listenToFirebase potentially, 
        // but for safety let's fetch once if needed, or just rely on state.

        // If we want to fetch specific node:
        const snapshot = await get(ref(db, 'history'));
        if (snapshot.exists()) {
            const history = snapshot.val();
            updateHistoryChart(history);
            updateHistorySidebar(history);
        }
    } catch (e) {
        console.error("Failed to fetch history", e);
    }
}

function updateHistorySidebar(history) {
    const list = document.getElementById('dailyHistoryList');
    if (!list) return;
    list.innerHTML = '';

    // Sort by date descending
    const dates = Object.keys(history).sort().reverse();

    if (dates.length === 0) {
        list.innerHTML = '<div class="history-item empty"><p>ไม่มีข้อมูลประวัติ</p></div>';
        return;
    }

    dates.forEach(dateStr => {
        const dayData = history[dateStr];
        const total = Object.values(dayData).reduce((a, b) => a + b, 0);

        // Format Date
        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('th-TH', { weekday: 'long' });
        const dateFormatted = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-date">
                <span class="day">${dayName}</span>
                <span class="full-date">${dateFormatted}</span>
            </div>
            <div class="history-total">
                ${total} ชิ้น
            </div>
        `;
        list.appendChild(item);
    });
}

function initHistoryChart() {
    const ctxEl = document.getElementById('historyChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    historyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [] // Will be populated by updateHistoryChart
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true, // Show legend for stacked chart
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 10 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        footer: (tooltipItems) => {
                            let sum = 0;
                            tooltipItems.forEach(function (tooltipItem) {
                                sum += tooltipItem.parsed.y;
                            });
                            return 'รวมทั้งหมด: ' + sum + ' ชิ้น';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true, // Enable Stacking
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    stacked: true, // Enable Stacking
                    grid: { display: false }
                }
            }
        }
    });

    // Fetch immediately
    fetchHistory();
}

function updateHistoryChart(history) {
    if (!historyChartInstance) return;

    // Process Data: Get last 7 days
    const days = Object.keys(history).sort().slice(-7);

    // Format Dates (e.g. "2023-10-25" -> "25 Oct")
    const labels = days.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    });

    // Create Stacked Datasets (One for each waste class)
    const datasets = wasteClasses.map(type => ({
        label: type.name,
        data: days.map(day => (history[day] && history[day][type.id]) ? history[day][type.id] : 0),
        backgroundColor: type.color,
        borderRadius: 2,
        borderWidth: 0
    }));

    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets = datasets;
    historyChartInstance.update();
}

// History Page Logic
window.initHistoryPage = async function () {
    try {
        const snapshot = await get(ref(db, 'history'));
        if (snapshot.exists()) {
            const history = snapshot.val();
            renderHistoryPageChart(history);
            renderHistoryTable(history);
        } else {
            renderHistoryPageChart({});
            renderHistoryTable({});
        }
    } catch (e) {
        console.error("History Page Error", e);
    }
}

function renderHistoryPageChart(history) {
    const ctx = document.getElementById('fullHistoryChart');
    if (!ctx) return;

    // Get last 30 days
    const days = Object.keys(history).sort().slice(-30);

    // Total per day
    const totals = days.map(day => {
        return Object.values(history[day]).reduce((a, b) => a + b, 0);
    });

    // Simple Line/Bar Chart for Trend
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: days.map(d => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })),
            datasets: [{
                label: 'จำนวนขยะรวม (ชิ้น)',
                data: totals,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderHistoryTable(history) {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const dates = Object.keys(history).sort().reverse();

    if (dates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">ไม่มีข้อมูลประวัติ</td></tr>';
        return;
    }

    dates.forEach(date => {
        const dayData = history[date];
        const total = Object.values(dayData).reduce((a, b) => a + b, 0);

        // Detailed breakdown string
        let breakdownHtml = '';
        wasteClasses.forEach(c => {
            if (dayData[c.id] > 0) {
                breakdownHtml += `<span class="badge" style="background:${c.color}20; color:${c.color}">${c.name}: ${dayData[c.id]}</span>`;
            }
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
            <td><strong>${total}</strong></td>
            <td>${breakdownHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}


