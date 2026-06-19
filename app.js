const STORAGE_KEY = "daily-spend-data-v1";
const SETTINGS_KEY = "daily-spend-settings-v1";

const categories = {
  Food: "#27c48c",
  Transport: "#4aa8ff",
  Groceries: "#f5b84b",
  Bills: "#c084fc",
  Shopping: "#ff7a90",
  Health: "#62d0ff",
  Entertainment: "#ff9f43",
  Other: "#9aa7b8"
};

const state = {
  expenses: [],
  settings: {
    currency: "₹",
    budget: "",
    theme: "dark"
  },
  filters: {
    search: "",
    category: "all",
    chartMode: "daily"
  }
};

const el = {
  todayLabel: document.querySelector("#todayLabel"),
  todayTotal: document.querySelector("#todayTotal"),
  monthTotal: document.querySelector("#monthTotal"),
  budgetLeft: document.querySelector("#budgetLeft"),
  form: document.querySelector("#expenseForm"),
  editingId: document.querySelector("#editingId"),
  amount: document.querySelector("#amount"),
  category: document.querySelector("#category"),
  date: document.querySelector("#date"),
  note: document.querySelector("#note"),
  saveButton: document.querySelector("#saveButton"),
  cancelEdit: document.querySelector("#cancelEdit"),
  chart: document.querySelector("#spendChart"),
  chartMode: document.querySelector("#chartMode"),
  chartLegend: document.querySelector("#chartLegend"),
  list: document.querySelector("#transactionList"),
  empty: document.querySelector("#emptyState"),
  template: document.querySelector("#transactionTemplate"),
  search: document.querySelector("#search"),
  filterCategory: document.querySelector("#filterCategory"),
  currency: document.querySelector("#currency"),
  budget: document.querySelector("#budget"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  clearData: document.querySelector("#clearData"),
  themeToggle: document.querySelector("#themeToggle")
};

function load() {
  state.expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  if (typeof date === "string") return date.slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function money(value) {
  const number = Number(value) || 0;
  return `${state.settings.currency}${number.toLocaleString(undefined, {
    minimumFractionDigits: number % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function render() {
  document.documentElement.classList.toggle("light", state.settings.theme === "light");
  el.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  el.currency.value = state.settings.currency;
  el.budget.value = state.settings.budget;

  const today = todayISO();
  const thisMonth = monthKey();
  const todayTotal = sum(state.expenses.filter(item => item.date === today));
  const monthItems = state.expenses.filter(item => monthKey(item.date) === thisMonth);
  const monthTotal = sum(monthItems);
  const budget = Number(state.settings.budget) || 0;

  el.todayTotal.textContent = money(todayTotal);
  el.monthTotal.textContent = money(monthTotal);
  el.budgetLeft.textContent = budget ? money(Math.max(budget - monthTotal, 0)) : "Set";

  renderList();
  drawChart();
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount), 0);
}

function renderList() {
  const filtered = state.expenses
    .filter(item => state.filters.category === "all" || item.category === state.filters.category)
    .filter(item => item.note.toLowerCase().includes(state.filters.search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  el.list.replaceChildren();
  el.empty.style.display = filtered.length ? "none" : "block";

  for (const item of filtered) {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".category-dot").style.background = categories[item.category] || categories.Other;
    node.querySelector(".transaction-title").textContent = item.note || item.category;
    node.querySelector(".transaction-meta").textContent = `${item.category} · ${formatDate(item.date)}`;
    node.querySelector(".transaction-amount").textContent = money(item.amount);
    node.querySelector(".edit").addEventListener("click", () => startEdit(item.id));
    node.querySelector(".delete").addEventListener("click", () => deleteExpense(item.id));
    el.list.append(node);
  }
}

function drawChart() {
  const ctx = el.chart.getContext("2d");
  const width = el.chart.width;
  const height = el.chart.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getCss("--surface-2");
  roundRect(ctx, 0, 0, width, height, 22);
  ctx.fill();

  const monthItems = state.expenses.filter(item => monthKey(item.date) === monthKey());
  if (!monthItems.length) {
    ctx.fillStyle = getCss("--muted");
    ctx.font = "28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No monthly data yet", width / 2, height / 2);
    el.chartLegend.replaceChildren();
    return;
  }

  if (state.filters.chartMode === "category") drawCategoryChart(ctx, width, height, monthItems);
  else drawDailyChart(ctx, width, height, monthItems);
}

function drawDailyChart(ctx, width, height, items) {
  const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const totals = Array.from({ length: days }, (_, index) => ({
    label: String(index + 1),
    value: sum(items.filter(item => Number(item.date.slice(8, 10)) === index + 1))
  }));
  const max = Math.max(...totals.map(item => item.value), 1);
  const gap = 6;
  const pad = 28;
  const barWidth = Math.max(3, (width - pad * 2 - gap * (days - 1)) / days);

  totals.forEach((item, index) => {
    const barHeight = (height - 72) * (item.value / max);
    const x = pad + index * (barWidth + gap);
    const y = height - 38 - barHeight;
    ctx.fillStyle = item.value ? getCss("--accent") : colorMix(getCss("--line"), 0.6);
    roundRect(ctx, x, y, barWidth, Math.max(barHeight, 2), 5);
    ctx.fill();
  });

  legend([{ name: "Daily spend", color: getCss("--accent") }]);
}

function drawCategoryChart(ctx, width, height, items) {
  const totals = Object.keys(categories)
    .map(name => ({ name, color: categories[name], value: sum(items.filter(item => item.category === name)) }))
    .filter(item => item.value > 0);
  const total = sum(totals);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  let start = -Math.PI / 2;

  totals.forEach(item => {
    const slice = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    start += slice;
  });

  ctx.fillStyle = getCss("--surface-2");
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = getCss("--text");
  ctx.font = "bold 30px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(money(total), cx, cy + 10);
  legend(totals);
}

function legend(items) {
  el.chartLegend.replaceChildren(...items.map(item => {
    const entry = document.createElement("span");
    const dot = document.createElement("i");
    dot.style.background = item.color;
    entry.append(dot, document.createTextNode(item.name));
    return entry;
  }));
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function colorMix(hex, alpha) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function startEdit(id) {
  const item = state.expenses.find(expense => expense.id === id);
  if (!item) return;
  el.editingId.value = item.id;
  el.amount.value = item.amount;
  el.category.value = item.category;
  el.date.value = item.date;
  el.note.value = item.note;
  el.saveButton.lastChild.textContent = " Update";
  el.cancelEdit.classList.remove("hidden");
  el.amount.focus();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(item => item.id !== id);
  persist();
  render();
}

function resetForm() {
  el.form.reset();
  el.date.value = todayISO();
  el.editingId.value = "";
  el.saveButton.lastChild.textContent = " Save";
  el.cancelEdit.classList.add("hidden");
}

function exportData() {
  const payload = JSON.stringify({ expenses: state.expenses, settings: state.settings }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-spend-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  el.form.addEventListener("submit", event => {
    event.preventDefault();
    const id = el.editingId.value || crypto.randomUUID();
    const existing = state.expenses.findIndex(item => item.id === id);
    const item = {
      id,
      amount: Number(el.amount.value),
      category: el.category.value,
      date: el.date.value,
      note: el.note.value.trim(),
      createdAt: existing >= 0 ? state.expenses[existing].createdAt : Date.now()
    };

    if (existing >= 0) state.expenses[existing] = item;
    else state.expenses.push(item);
    persist();
    resetForm();
    render();
  });

  el.cancelEdit.addEventListener("click", resetForm);
  el.search.addEventListener("input", () => {
    state.filters.search = el.search.value;
    renderList();
  });
  el.filterCategory.addEventListener("change", () => {
    state.filters.category = el.filterCategory.value;
    renderList();
  });
  el.chartMode.addEventListener("change", () => {
    state.filters.chartMode = el.chartMode.value;
    drawChart();
  });
  el.currency.addEventListener("change", () => {
    state.settings.currency = el.currency.value;
    persist();
    render();
  });
  el.budget.addEventListener("input", () => {
    state.settings.budget = el.budget.value;
    persist();
    render();
  });
  el.themeToggle.addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    persist();
    render();
  });
  el.exportButton.addEventListener("click", exportData);
  el.importFile.addEventListener("change", async () => {
    const file = el.importFile.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    state.settings = { ...state.settings, ...(data.settings || {}) };
    persist();
    render();
    el.importFile.value = "";
  });
  el.clearData.addEventListener("click", () => {
    if (!confirm("Clear all saved spending?")) return;
    state.expenses = [];
    persist();
    render();
  });
}

function initFilters() {
  Object.keys(categories).forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    el.filterCategory.append(option);
  });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch {
      // The app still works without offline cache when opened from a local file.
    }
  }
}

load();
initFilters();
wireEvents();
resetForm();
render();
registerServiceWorker();
