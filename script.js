/**
 * WorkTrack — script.js
 * Work-hours & salary tracker PWA
 * ─────────────────────────────────────────────
 * Architecture:
 *   State  → single source of truth in `state` object
 *   Store  → localStorage helpers (namespace: "wt_")
 *   UI     → pure DOM mutation functions
 *   Events → wired at the bottom
 * ─────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const HOURLY_RATE = 11;           // BGN per hour
const LS_PREFIX   = 'wt_';       // localStorage namespace
const MONTHS_BG   = [
  'Януари','Февруари','Март','Април','Май','Юни',
  'Юли','Август','Септември','Октомври','Ноември','Декември'
];
const DAYS_BG = ['Пон','Вт','Ср','Чет','Пет','Съб','Нед'];

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
const state = {
  viewYear:  new Date().getFullYear(),
  viewMonth: new Date().getMonth(),  // 0-based
  darkMode:  true,
  activeTab: 'dashboard',
  modalDay:  null,   // currently open day key "YYYY-MM-DD"
  charts:    { bar: null, line: null },
};

/* ══════════════════════════════════════════════
   STORE — localStorage helpers
══════════════════════════════════════════════ */
const Store = {
  /** Key for a month object: "wt_month_YYYY-MM" */
  monthKey(year, month) {
    return `${LS_PREFIX}month_${year}-${String(month + 1).padStart(2, '0')}`;
  },

  /** Load month data. Returns { days: { "YYYY-MM-DD": hours } } */
  loadMonth(year, month) {
    try {
      const raw = localStorage.getItem(this.monthKey(year, month));
      if (!raw) return { days: {} };
      const parsed = JSON.parse(raw);
      // Defensive: ensure shape is correct
      if (!parsed || typeof parsed.days !== 'object') return { days: {} };
      return parsed;
    } catch (e) {
      console.error('Store.loadMonth error:', e);
      return { days: {} };
    }
  },

  /** Persist month data */
  saveMonth(year, month, data) {
    try {
      localStorage.setItem(this.monthKey(year, month), JSON.stringify(data));
    } catch (e) {
      console.error('Store.saveMonth error:', e);
      alert('Грешка при записа на данните. Проверете свободното място в браузъра.');
    }
  },

  /** Set hours for a specific day */
  setDayHours(year, month, dayKey, hours) {
    const data = this.loadMonth(year, month);
    if (hours === 0) {
      delete data.days[dayKey];
    } else {
      data.days[dayKey] = hours;
    }
    this.saveMonth(year, month, data);
  },

  /** Remove all entries for a month */
  clearMonth(year, month) {
    localStorage.removeItem(this.monthKey(year, month));
  },

  /** Return list of all stored month keys (sorted ascending) */
  allMonthKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${LS_PREFIX}month_`)) keys.push(k);
    }
    return keys.sort();
  },

  /** Load settings (theme) */
  loadSettings() {
    try {
      const raw = localStorage.getItem(`${LS_PREFIX}settings`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },

  saveSettings(obj) {
    try {
      localStorage.setItem(`${LS_PREFIX}settings`, JSON.stringify(obj));
    } catch (e) { console.error(e); }
  },
};

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
/** Format "YYYY-MM-DD" from year/month(0-based)/day */
function dayKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** "YYYY-MM" label from a localStorage key like "wt_month_YYYY-MM" */
function labelFromKey(lsKey) {
  return lsKey.replace(`${LS_PREFIX}month_`, '');
}

/** Human-readable "Месец YYYY" from "YYYY-MM" string */
function monthLabelFromYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_BG[m - 1]} ${y}`;
}

/** Sum all hours in a month data object */
function sumHours(monthData) {
  return Object.values(monthData.days).reduce((a, b) => a + b, 0);
}

/** Number of distinct days with hours > 0 */
function countDays(monthData) {
  return Object.values(monthData.days).filter(h => h > 0).length;
}

/** Format number to 2 decimal places only when needed */
function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
function renderDashboard() {
  const data  = Store.loadMonth(state.viewYear, state.viewMonth);
  const total = sumHours(data);
  const days  = countDays(data);
  const avg   = days > 0 ? total / days : 0;

  document.getElementById('statHours').textContent  = fmt(total);
  document.getElementById('statSalary').textContent = `${fmt(total * HOURLY_RATE)} лв.`;
  document.getElementById('statDays').textContent   = days;
  document.getElementById('statAvg').textContent    = fmt(avg);

  const label = `${MONTHS_BG[state.viewMonth]} ${state.viewYear}`;
  document.getElementById('dashMonthLabel').textContent = label;
}

/* ══════════════════════════════════════════════
   CALENDAR
══════════════════════════════════════════════ */
function renderCalendar() {
  const year  = state.viewYear;
  const month = state.viewMonth;
  const data  = Store.loadMonth(year, month);
  const today = new Date();

  document.getElementById('calMonthLabel').textContent =
    `${MONTHS_BG[month]} ${year}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // First day of month (convert Sunday=0 → Mon-based 0-6)
  const firstDate = new Date(year, month, 1);
  let startDow = firstDate.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // make Mon=0

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dk   = dayKey(year, month, d);
    const hrs  = data.days[dk] || 0;
    const isToday = (
      today.getFullYear() === year &&
      today.getMonth()    === month &&
      today.getDate()     === d
    );

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (hrs > 0   ? ' worked' : '') +
      (isToday   ? ' today'  : '');
    cell.dataset.key = dk;
    cell.dataset.day = d;

    const numEl = document.createElement('div');
    numEl.className = 'day-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (hrs > 0) {
      const hEl = document.createElement('div');
      hEl.className = 'day-hours';
      hEl.textContent = fmt(hrs) + 'ч';
      cell.appendChild(hEl);
    }

    cell.addEventListener('click', () => openHourModal(dk, d));
    grid.appendChild(cell);
  }
}

/* ══════════════════════════════════════════════
   HOUR MODAL
══════════════════════════════════════════════ */
function openHourModal(dk, dayNum) {
  state.modalDay = dk;
  const [y, m] = dk.split('-').map(Number);
  const data = Store.loadMonth(y, m - 1);
  const existing = data.days[dk] || 0;

  document.getElementById('modalTitle').textContent =
    existing > 0 ? `Редактирай — ${fmt(existing)}ч` : 'Добави часове';
  document.getElementById('modalDate').textContent =
    `${dayNum} ${MONTHS_BG[m - 1]} ${y}`;

  const customInput = document.getElementById('customHours');
  customInput.value = existing > 0 ? existing : '';

  document.getElementById('hourModal').removeAttribute('hidden');
  customInput.focus();
}

function closeHourModal() {
  document.getElementById('hourModal').setAttribute('hidden', '');
  state.modalDay = null;
  document.getElementById('customHours').value = '';
}

function saveHours(hours) {
  if (!state.modalDay) return;
  const dk = state.modalDay;
  const [y, m] = dk.split('-').map(Number);
  const parsedH = parseFloat(hours);
  if (isNaN(parsedH) || parsedH < 0 || parsedH > 24) {
    alert('Моля, въведете валидна стойност между 0 и 24.');
    return;
  }
  Store.setDayHours(y, m - 1, dk, parsedH);
  closeHourModal();
  refreshAll();
}

/* ══════════════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════════════ */
function populateHistorySelect() {
  const sel  = document.getElementById('historySelect');
  const keys = Store.allMonthKeys();

  // Always include current month even if no data
  const curKey = Store.monthKey(state.viewYear, state.viewMonth)
    .replace(LS_PREFIX, ''); // just the "month_YYYY-MM" part — actually let's use labelFromKey logic

  sel.innerHTML = '';

  let monthsSet = new Set();
  keys.forEach(k => monthsSet.add(labelFromKey(k)));

  // Add current month if not there
  const curYM = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2,'0')}`;
  monthsSet.add(curYM);

  // Sort descending
  const sorted = [...monthsSet].sort().reverse();

  sorted.forEach(ym => {
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = monthLabelFromYM(ym);
    sel.appendChild(opt);
  });

  renderHistoryDetail(sorted[0] || curYM);
}

function renderHistoryDetail(ym) {
  if (!ym) return;
  const [y, m] = ym.split('-').map(Number);
  const data    = Store.loadMonth(y, m - 1);
  const total   = sumHours(data);
  const days    = countDays(data);
  const salary  = total * HOURLY_RATE;
  const detail  = document.getElementById('historyDetail');

  if (days === 0) {
    detail.innerHTML = '<p class="empty-state">Няма данни за избрания месец.</p>';
    return;
  }

  // Sort day keys
  const sortedDays = Object.keys(data.days).sort();

  let rows = sortedDays.map(dk => {
    const d = parseInt(dk.split('-')[2], 10);
    const h = data.days[dk];
    return `<tr>
      <td>${d} ${MONTHS_BG[m - 1]} ${y}</td>
      <td>${fmt(h)} ч</td>
      <td>${fmt(h * HOURLY_RATE)} лв.</td>
    </tr>`;
  }).join('');

  detail.innerHTML = `
    <div class="history-stats">
      <div class="history-stat">
        <div class="hs-label">Общо часове</div>
        <div class="hs-value">${fmt(total)}</div>
      </div>
      <div class="history-stat">
        <div class="hs-label">Заплата</div>
        <div class="hs-value">${fmt(salary)} лв.</div>
      </div>
      <div class="history-stat">
        <div class="hs-label">Работни дни</div>
        <div class="hs-value">${days}</div>
      </div>
    </div>
    <table class="history-table">
      <thead>
        <tr><th>Дата</th><th>Часове</th><th>Заплата</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ══════════════════════════════════════════════
   CHARTS
══════════════════════════════════════════════ */
function renderCharts() {
  renderBarChart();
  renderLineChart();
}

function renderBarChart() {
  const data  = Store.loadMonth(state.viewYear, state.viewMonth);
  const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();

  const labels = [];
  const values = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = dayKey(state.viewYear, state.viewMonth, d);
    const h  = data.days[dk] || 0;
    if (h > 0) {
      labels.push(String(d));
      values.push(h);
    }
  }

  const ctx = document.getElementById('barChart');
  if (state.charts.bar) state.charts.bar.destroy();

  state.charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Часове',
        data: values,
        backgroundColor: 'rgba(79,141,255,0.7)',
        borderColor: '#4f8dff',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: chartOptions('Ден', 'Часове'),
  });
}

function renderLineChart() {
  const keys = Store.allMonthKeys();
  const labels = [];
  const values = [];

  keys.sort().forEach(k => {
    const ym = labelFromKey(k);
    const [y, m] = ym.split('-').map(Number);
    const data = Store.loadMonth(y, m - 1);
    labels.push(monthLabelFromYM(ym).split(' ')[0]); // short month name
    values.push(sumHours(data));
  });

  const ctx = document.getElementById('lineChart');
  if (state.charts.line) state.charts.line.destroy();

  state.charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Часове',
        data: values,
        borderColor: '#3ecf8e',
        backgroundColor: 'rgba(62,207,142,0.12)',
        borderWidth: 2.5,
        pointBackgroundColor: '#3ecf8e',
        pointRadius: 5,
        tension: 0.4,
        fill: true,
      }]
    },
    options: chartOptions('Месец', 'Часове'),
  });
}

function chartOptions(xLabel, yLabel) {
  const isDark = document.body.classList.contains('dark-mode');
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const tickColor  = isDark ? '#8888aa' : '#666688';
  const legendColor = isDark ? '#e8e8f0' : '#12121e';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1e1e30' : '#fff',
        titleColor: legendColor,
        bodyColor: tickColor,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid:  { color: gridColor },
        ticks: { color: tickColor, font: { family: "'DM Mono', monospace", size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid:  { color: gridColor },
        ticks: { color: tickColor, font: { family: "'DM Mono', monospace", size: 11 } },
      }
    }
  };
}

/* ══════════════════════════════════════════════
   EXPORT — CSV
══════════════════════════════════════════════ */
function exportCSV() {
  const year  = state.viewYear;
  const month = state.viewMonth;
  const data  = Store.loadMonth(year, month);
  const m     = month + 1;
  const ym    = `${year}-${String(m).padStart(2,'0')}`;

  const total  = sumHours(data);
  const salary = total * HOURLY_RATE;
  const sorted = Object.keys(data.days).sort();

  let csv = 'Дата,Часове,Заплата (лв.)\n';
  sorted.forEach(dk => {
    const h = data.days[dk];
    csv += `${dk},${fmt(h)},${fmt(h * HOURLY_RATE)}\n`;
  });
  csv += `\nОбщо,${fmt(total)},${fmt(salary)}\n`;

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `work-hours-${ym}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════
   EXPORT — PDF
══════════════════════════════════════════════ */
function exportPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const year  = state.viewYear;
    const month = state.viewMonth;
    const data  = Store.loadMonth(year, month);
    const ym    = `${year}-${String(month + 1).padStart(2,'0')}`;
    const total  = sumHours(data);
    const salary = total * HOURLY_RATE;
    const sorted = Object.keys(data.days).sort();
    const monthName = `${MONTHS_BG[month]} ${year}`;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Header
    doc.setFillColor(15, 15, 26);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(232, 232, 240);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('WorkTrack', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(136, 136, 170);
    doc.text(`Отчет за работни часове — ${monthName}`, 14, 28);
    doc.text(`Генериран: ${new Date().toLocaleDateString('bg-BG')}`, 14, 35);

    // Summary boxes
    doc.setTextColor(18, 18, 30);
    let bx = 14;
    const boxes = [
      { label: 'Общо часове', value: `${fmt(total)} ч` },
      { label: 'Заплата',     value: `${fmt(salary)} лв.` },
      { label: 'Работни дни', value: countDays(data) },
    ];
    boxes.forEach(b => {
      doc.setFillColor(240, 240, 248);
      doc.roundedRect(bx, 46, 56, 20, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 130);
      doc.text(b.label, bx + 4, 52);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(18, 18, 30);
      doc.text(String(b.value), bx + 4, 62);
      bx += 60;
    });

    // Table header
    const tableTop = 74;
    doc.setFillColor(22, 22, 37);
    doc.rect(14, tableTop, 182, 8, 'F');
    doc.setTextColor(232, 232, 240);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Дата', 18, tableTop + 5.5);
    doc.text('Часове', 100, tableTop + 5.5);
    doc.text('Заплата (лв.)', 148, tableTop + 5.5);

    // Table rows
    let y = tableTop + 8;
    sorted.forEach((dk, i) => {
      const h = data.days[dk];
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 252);
        doc.rect(14, y, 182, 7, 'F');
      }
      doc.setTextColor(18, 18, 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(dk, 18, y + 5);
      doc.text(`${fmt(h)} ч`, 100, y + 5);
      doc.text(`${fmt(h * HOURLY_RATE)} лв.`, 148, y + 5);
      y += 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    // Footer line
    y += 4;
    doc.setDrawColor(200, 200, 220);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(18, 18, 30);
    doc.text(`ОБЩО: ${fmt(total)} ч = ${fmt(salary)} лв.`, 18, y);

    doc.save(`work-hours-${ym}.pdf`);
  } catch (e) {
    console.error('PDF export error:', e);
    alert('Грешка при генерирането на PDF. Проверете дали библиотеката е заредена.');
  }
}

/* ══════════════════════════════════════════════
   RESET MONTH
══════════════════════════════════════════════ */
function confirmReset() {
  const label = `${MONTHS_BG[state.viewMonth]} ${state.viewYear}`;
  document.getElementById('confirmMsg').textContent =
    `Сигурни ли сте, че искате да изтриете всички данни за ${label}? Тази операция е необратима.`;
  document.getElementById('confirmModal').removeAttribute('hidden');
}

function doReset() {
  Store.clearMonth(state.viewYear, state.viewMonth);
  document.getElementById('confirmModal').setAttribute('hidden', '');
  refreshAll();
}

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');

  // Lazy-render expensive tabs
  if (tabId === 'charts')  renderCharts();
  if (tabId === 'history') populateHistorySelect();
  if (tabId === 'calendar') renderCalendar();
  if (tabId === 'dashboard') renderDashboard();
}

/* ══════════════════════════════════════════════
   THEME
══════════════════════════════════════════════ */
function applyTheme(dark) {
  state.darkMode = dark;
  document.body.classList.toggle('dark-mode',  dark);
  document.body.classList.toggle('light-mode', !dark);
  document.getElementById('darkToggle').textContent = dark ? '🌙' : '☀️';
  Store.saveSettings({ darkMode: dark });
}

/* ══════════════════════════════════════════════
   MONTH NAVIGATION
══════════════════════════════════════════════ */
function changeMonth(delta) {
  let m = state.viewMonth + delta;
  let y = state.viewYear;
  if (m > 11) { m = 0;  y++; }
  if (m < 0)  { m = 11; y--; }
  state.viewMonth = m;
  state.viewYear  = y;
  refreshAll();
}

/* ══════════════════════════════════════════════
   REFRESH ALL VISIBLE UI
══════════════════════════════════════════════ */
function refreshAll() {
  renderDashboard();
  renderCalendar();
  if (state.activeTab === 'charts')  renderCharts();
  if (state.activeTab === 'history') populateHistorySelect();
}

/* ══════════════════════════════════════════════
   EVENT WIRING
══════════════════════════════════════════════ */
function wireEvents() {
  // Nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Dark mode toggle
  document.getElementById('darkToggle').addEventListener('click', () => {
    applyTheme(!state.darkMode);
  });

  // Calendar month navigation
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(+1));

  // Hour preset buttons
  document.querySelectorAll('.hour-preset').forEach(btn => {
    btn.addEventListener('click', () => saveHours(Number(btn.dataset.hours)));
  });

  // Custom hour save
  document.getElementById('customSave').addEventListener('click', () => {
    saveHours(document.getElementById('customHours').value);
  });

  // Also save on Enter key in input
  document.getElementById('customHours').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveHours(e.target.value);
  });

  // Clear day
  document.getElementById('clearDay').addEventListener('click', () => {
    if (!state.modalDay) return;
    const dk = state.modalDay;
    const [y, m] = dk.split('-').map(Number);
    Store.setDayHours(y, m - 1, dk, 0);
    closeHourModal();
    refreshAll();
  });

  // Close modal
  document.getElementById('closeModal').addEventListener('click', closeHourModal);

  // Close modal on overlay click
  document.getElementById('hourModal').addEventListener('click', e => {
    if (e.target === document.getElementById('hourModal')) closeHourModal();
  });

  // Exports
  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('exportPDF').addEventListener('click', exportPDF);

  // Reset month
  document.getElementById('resetMonth').addEventListener('click', confirmReset);
  document.getElementById('confirmOK').addEventListener('click', doReset);
  document.getElementById('confirmCancel').addEventListener('click', () => {
    document.getElementById('confirmModal').setAttribute('hidden', '');
  });
  document.getElementById('confirmModal').addEventListener('click', e => {
    if (e.target === document.getElementById('confirmModal')) {
      document.getElementById('confirmModal').setAttribute('hidden', '');
    }
  });

  // History selector
  document.getElementById('historySelect').addEventListener('change', e => {
    renderHistoryDetail(e.target.value);
  });
}

/* ══════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
══════════════════════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.warn('SW registration failed:', err));
  }
}

/* ══════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════ */
function init() {
  // Load saved theme
  const settings = Store.loadSettings();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(typeof settings.darkMode === 'boolean' ? settings.darkMode : prefersDark);

  wireEvents();
  switchTab('dashboard');
  registerSW();
}

// Wait for DOM + scripts to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
