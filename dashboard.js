/* ============================================================
   DASHBOARD.JS – Real-time analytics dashboard
   Pure Canvas charts (no external dependencies)
   ============================================================ */

// ============================================================
// DATA GENERATORS
// ============================================================
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Seed data for 24-hour volume chart
function generateHourlyData() {
  const hours = [];
  const aiVol = [];
  const humanVol = [];
  for (let h = 0; h < 24; h++) {
    hours.push(h.toString().padStart(2,'0') + 'h');
    const base = h >= 8 && h <= 18 ? rand(60, 130) : rand(5, 35);
    aiVol.push(Math.round(base * 0.72));
    humanVol.push(Math.round(base * 0.28));
  }
  return { hours, aiVol, humanVol };
}

const AGENT_NAMES = ['Fatima B.','Youssef K.','Aicha M.','Omar H.','Khadija R.'];
const INTENT_LABELS = ['Solde','Blocage Carte','Transactions','Réclamation','Agences','Crédit','Autre'];
const INTENT_COLORS = ['#F7941D','#FF6B6B','#4ECDC4','#45B7D1','#A855F7','#22C55E','#64748B'];
const SENTIMENT_LABELS = ['Positif','Neutre','Négatif'];

const LIVE_EVENTS = [
  (n) => `<strong>Client ATJ-${n}</strong> – Solde consulté via chatbot`,
  (n) => `<strong>Client ATJ-${n}</strong> – Carte bloquée automatiquement`,
  (n) => `<strong>Client ATJ-${n}</strong> – Réclamation transférée à agent`,
  (n) => `<strong>Client ATJ-${n}</strong> – Virement initié avec succès`,
  (n) => `<strong>Client ATJ-${n}</strong> – Informations agence fournies`,
  (n) => `<strong>Agent Fatima B.</strong> – Dossier crédit traité`,
  (n) => `<strong>ALERTE</strong> – Tentative blocage carte suspecte`,
];

const LIVE_TYPES = ['ai','ai','human','ai','ai','human','alert'];

// ============================================================
// KPI ANIMATION
// ============================================================
function animateCount(el, target, suffix = '', duration = 1200) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = Math.floor(start).toLocaleString('fr-FR') + suffix;
  }, 16);
}

function initKPIs() {
  const kpis = [
    { id: 'kpi-total-val', val: rand(820, 980), suffix: '' },
    { id: 'kpi-auto-val',  val: rand(560, 700), suffix: '' },
    { id: 'kpi-human-val', val: rand(120, 200), suffix: '' },
    { id: 'kpi-sat-val',   val: rand(87, 95),   suffix: '%' },
    { id: 'kpi-time-val',  val: rand(6, 12),    suffix: 's' },
    { id: 'kpi-rate-val',  val: rand(68, 74),   suffix: '%' },
  ];

  kpis.forEach(k => {
    const el = document.getElementById(k.id);
    if (el) animateCount(el, k.val, k.suffix);
  });
}

// ============================================================
// CANVAS CHART UTILITIES
// ============================================================
const CHART_DEFAULTS = {
  bg:     '#F5F6F8',
  border: '#E8E9EC',
  text:   '#9899A6',
  orange: '#F7941D',
  blue:   '#2563EB',
  green:  '#16A34A',
};

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

// ============================================================
// LINE / BAR CHART – Volume 24h
// ============================================================
function drawVolumeChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { hours, aiVol, humanVol } = generateHourlyData();

  // Make responsive
  const W = canvas.parentElement.clientWidth || 700;
  const H = 220;
  canvas.width = W;
  canvas.height = H;

  const PAD = { top: 20, right: 20, bottom: 40, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...aiVol, ...humanVol) * 1.15;

  function xPos(i) { return PAD.left + (i / (hours.length - 1)) * chartW; }
  function yPos(v) { return PAD.top + chartH - (v / maxVal) * chartH; }

  clearCanvas(ctx, W, H);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.strokeStyle = CHART_DEFAULTS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Y labels
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, PAD.left - 6, y + 4);
  }

  // X labels (every 3 hours)
  hours.forEach((h, i) => {
    if (i % 3 !== 0) return;
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(h, xPos(i), H - 8);
  });

  // Helper: draw filled line
  function drawFilledLine(data, color, alpha = 0.15) {
    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
    grad.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(245,246,248,0)');

    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xPos(i), yPos(v)); });
    ctx.lineTo(xPos(data.length - 1), H - PAD.bottom);
    ctx.lineTo(xPos(0), H - PAD.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(xPos(i), yPos(v)); });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  drawFilledLine(humanVol, '#3B82F6');
  drawFilledLine(aiVol, '#F7941D');

  // Dots on last data point
  [[aiVol, '#F7941D'], [humanVol, '#3B82F6']].forEach(([data, color]) => {
    const last = data.length - 1;
    ctx.beginPath();
    ctx.arc(xPos(last), yPos(data[last]), 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#141416';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ============================================================
// HORIZONTAL BAR CHART – Top Intents
// ============================================================
function drawIntentsChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.clientWidth || 280;
  const H = 220;
  canvas.width = W;
  canvas.height = H;

  const data = INTENT_LABELS.map((l, i) => ({
    label: l,
    value: rand(30, 200),
    color: INTENT_COLORS[i],
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const max = data[0].value;
  const barH = 22;
  const gap = (H - 20) / data.length - barH;
  const PAD_LEFT = 90;
  const PAD_RIGHT = 40;
  const chartW = W - PAD_LEFT - PAD_RIGHT;

  clearCanvas(ctx, W, H);

  data.forEach((item, i) => {
    const y = 10 + i * (barH + gap + 6);
    const barW = (item.value / max) * chartW;

    // Label
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(item.label, PAD_LEFT - 8, y + barH / 2 + 4);

    // Bar background
    ctx.beginPath();
    ctx.roundRect(PAD_LEFT, y, chartW, barH, 4);
    ctx.fillStyle = '#EEF0F4';
    ctx.fill();

    // Bar fill
    ctx.beginPath();
    ctx.roundRect(PAD_LEFT, y, barW, barH, 4);
    ctx.fillStyle = item.color;
    ctx.fill();

    // Value
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.value, PAD_LEFT + barW + 6, y + barH / 2 + 4);
  });
}

// ============================================================
// DONUT CHART – Resolution Rate
// ============================================================
function drawDonutChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const SIZE = 200;
  canvas.width = SIZE;
  canvas.height = SIZE;

  clearCanvas(ctx, SIZE, SIZE);

  const cx = SIZE / 2, cy = SIZE / 2, r = 80, inner = 55;
  const aiPct = rand(65, 74) / 100;
  const humanPct = 1 - aiPct;

  function drawArc(start, end, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    // Cut inner circle
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Shadow
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(247,148,29,0.2)';
  drawArc(-Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aiPct, CHART_DEFAULTS.orange);
  ctx.shadowBlur = 0;
  drawArc(-Math.PI / 2 + Math.PI * 2 * aiPct, -Math.PI / 2 + Math.PI * 2, '#E8E9EC');

  // Update center text
  const donutVal = document.getElementById('donutValue');
  if (donutVal) donutVal.textContent = Math.round(aiPct * 100) + '%';
}

// ============================================================
// STACKED BAR CHART – Sentiment
// ============================================================
function drawSentimentChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.clientWidth || 500;
  const H = 220;
  canvas.width = W;
  canvas.height = H;

  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const colors = { pos: '#22C55E', neu: '#F7941D', neg: '#EF4444' };
  const PAD = { top: 16, right: 20, bottom: 36, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const data = days.map(() => {
    const pos = rand(50, 75);
    const neg = rand(5, 15);
    return { pos, neg, neu: 100 - pos - neg };
  });

  const barW = (chartW / days.length) * 0.55;
  const barGap = chartW / days.length;

  clearCanvas(ctx, W, H);

  // Y axis lines
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.strokeStyle = CHART_DEFAULTS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((100 - i * 25) + '%', PAD.left - 4, y + 4);
  }

  data.forEach((d, i) => {
    const x = PAD.left + i * barGap + (barGap - barW) / 2;
    let yOff = PAD.top + chartH;

    const segments = [
      { val: d.neg, color: colors.neg },
      { val: d.neu, color: colors.neu },
      { val: d.pos, color: colors.pos },
    ];

    segments.forEach(seg => {
      const h = (seg.val / 100) * chartH;
      yOff -= h;
      ctx.beginPath();
      ctx.roundRect(x, yOff, barW, h, [3, 3, 0, 0]);
      ctx.fillStyle = seg.color;
      ctx.fill();
    });

    // X label
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(days[i], x + barW / 2, H - 8);
  });

  // Legend
  const legItems = [
    { label: 'Positif', color: colors.pos },
    { label: 'Neutre',  color: colors.neu },
    { label: 'Négatif', color: colors.neg },
  ];
  legItems.forEach((item, i) => {
    const lx = W - 180 + i * 58;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(lx, 2, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = CHART_DEFAULTS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, lx + 14, 12);
  });
}

// ============================================================
// LIVE FEED
// ============================================================
class LiveFeed {
  constructor() {
    this.feedList = document.getElementById('feedList');
    this.counter  = rand(8200, 8400);
  }

  start() {
    this.tick();
    setInterval(() => this.tick(), rand(2500, 4500));
  }

  tick() {
    if (!this.feedList) return;
    const idx = rand(0, LIVE_EVENTS.length - 1);
    const n   = ++this.counter;
    const type = LIVE_TYPES[idx];
    const now  = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `
      <span class="feed-dot ${type}"></span>
      <span class="feed-text">${LIVE_EVENTS[idx](n)}</span>
      <span class="feed-time">${now}</span>
    `;

    this.feedList.prepend(el);

    // Keep max 12 items
    while (this.feedList.children.length > 12) {
      this.feedList.removeChild(this.feedList.lastChild);
    }
  }
}

// ============================================================
// AGENTS TABLE
// ============================================================
function renderAgentsTable() {
  const tbody = document.getElementById('agentsBody');
  if (!tbody) return;

  const statuses = [
    ['available','Disponible'], ['busy','En Appel'], ['busy','En Appel'],
    ['available','Disponible'], ['break','Pause'],
  ];

  tbody.innerHTML = AGENT_NAMES.map((name, i) => {
    const [cls, label] = statuses[i];
    const queue    = cls === 'busy' ? rand(1, 3) : 0;
    const resolved = rand(12, 40);
    return `
      <tr>
        <td style="font-weight:600;color:var(--text-primary)">${name}</td>
        <td>
          <span class="agent-status-badge ${cls}">
            <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
            ${label}
          </span>
        </td>
        <td style="text-align:center">${queue}</td>
        <td style="color:var(--green);font-weight:600">${resolved}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// DATE FILTER
// ============================================================
function initDateFilter() {
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initKPIs();
      drawVolumeChart('volumeChart');
      drawIntentsChart('intentsChart');
      drawDonutChart('resolutionChart');
      drawSentimentChart('sentimentChart');
    });
  });
}

// ============================================================
// DASHBOARD NAV
// ============================================================
function initDashNav() {
  document.querySelectorAll('.dash-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ============================================================
// LIVE CLOCK
// ============================================================
function startClock() {
  const el = document.getElementById('lastUpdate');
  if (!el) return;
  setInterval(() => {
    el.textContent = 'Mis à jour: ' + new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }, 1000);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initKPIs();
  drawVolumeChart('volumeChart');
  drawIntentsChart('intentsChart');
  drawDonutChart('resolutionChart');
  drawSentimentChart('sentimentChart');
  renderAgentsTable();
  initDateFilter();
  initDashNav();
  startClock();

  const feed = new LiveFeed();
  feed.start();

  // Redraw charts on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawVolumeChart('volumeChart');
      drawIntentsChart('intentsChart');
      drawSentimentChart('sentimentChart');
    }, 200);
  });
});
