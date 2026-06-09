/*  ╔══════════════════════════════════════════════╗
    ║       TASK MANAGER PRO V2 - ULTIMATE         ║
    ╚══════════════════════════════════════════════╝ */

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
const S = {
  tasks: [],
  categories: [],
  stats: {},
  settings: {},
  view: localStorage.getItem("view") || "board", // board | grid | list | analytics
  filter: "all",
  catFilter: "all",
  sort: "createdAt",
  search: "",
  theme: localStorage.getItem("theme") || "light",
  editId: null,
  subtasks: [],
  pomo: {
    running: false,
    paused: false,
    seconds: 25 * 60,
    total: 25 * 60,
    taskId: null,
    interval: null,
    mode: "work",
    sessions: 0,
  },
};

// ══════════════════════════════════════
// SELECTORS
// ══════════════════════════════════════
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ══════════════════════════════════════
// API
// ══════════════════════════════════════
async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ══════════════════════════════════════
// THEME
// ══════════════════════════════════════
function setTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════
function toast(msg, type = "info") {
  const icons = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4m0 4h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>',
  };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-ic">${icons[type]}</div><span class="toast-msg">${msg}</span><button class="toast-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
  $("#toastStack").appendChild(el);
  const close = () => {
    el.classList.add("removing");
    setTimeout(() => el.remove(), 350);
  };
  el.querySelector(".toast-x").onclick = close;
  setTimeout(close, 3200);
}

// ══════════════════════════════════════
// CONFIRM DIALOG
// ══════════════════════════════════════
function confirm(msg, title = "حذف تسک") {
  return new Promise((resolve) => {
    $("#confirmTitle").textContent = title;
    $("#confirmMsg").textContent = msg;
    $("#confirmOverlay").classList.add("show");
    const yes = () => {
      cleanup();
      resolve(true);
    };
    const no = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      $("#confirmOverlay").classList.remove("show");
      $("#confirmYes").removeEventListener("click", yes);
      $("#confirmNo").removeEventListener("click", no);
    };
    $("#confirmYes").addEventListener("click", yes);
    $("#confirmNo").addEventListener("click", no);
  });
}

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
const esc = (t) => {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
};
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
const fmtTime = (s) => {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const prioLabel = { high: "🔴 زیاد", medium: "🟡 متوسط", low: "🟢 کم" };
const statusLabel = {
  todo: "در انتظار",
  "in-progress": "در حال انجام",
  done: "انجام شده",
};
const isOverdue = (t) =>
  t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date();

// ══════════════════════════════════════
// DATA FETCH
// ══════════════════════════════════════
async function load() {
  $("#loader").style.display = "flex";
  hideAllViews();

  const p = new URLSearchParams();
  if (S.filter !== "all" && S.filter !== "overdue") p.set("status", S.filter);
  if (S.catFilter !== "all") p.set("category", S.catFilter);
  if (S.search) p.set("search", S.search);
  p.set("sort", S.sort);

  try {
    const data = await api(`/api/tasks?${p}`);
    S.tasks = data.tasks;
    S.stats = data.stats;
    S.categories = data.categories;
    S.settings = data.settings || {};

    // Handle overdue filter client-side
    if (S.filter === "overdue") {
      S.tasks = S.tasks.filter(isOverdue);
    }

    $("#loader").style.display = "none";
    renderSidebar();
    renderDashboard();
    renderView();
    updatePomoSelect();
  } catch (e) {
    console.error(e);
    $("#loader").style.display = "none";
    toast("خطا در بارگذاری", "error");
  }
}

function hideAllViews() {
  $("#kanbanBoard").style.display = "none";
  $("#gridView").style.display = "none";
  $("#listView").style.display = "none";
  $("#analyticsView").style.display = "none";
  $("#emptyState").style.display = "none";
}

function renderView() {
  hideAllViews();
  if (S.tasks.length === 0 && S.view !== "analytics") {
    $("#emptyState").style.display = "flex";
    return;
  }
  if (S.view === "board") renderKanban();
  else if (S.view === "grid") renderGrid();
  else if (S.view === "list") renderList();
  else if (S.view === "analytics") renderAnalytics();
}

// ══════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════
function renderSidebar() {
  const s = S.stats;
  $("#qsStreak").textContent = s.streak || 0;
  $("#qsRate").textContent = `${s.completionRate || 0}%`;
  $("#qsTime").textContent = fmtTime(s.totalTimeSpent || 0);

  $("#cntAll").textContent = s.total;
  $("#cntTodo").textContent = s.todo;
  $("#cntProgress").textContent = s.inProgress;
  $("#cntDone").textContent = s.done;
  $("#cntOverdue").textContent = s.overdue;

  // Categories
  const catList = $("#catNavList");
  catList.innerHTML = S.categories
    .map(
      (c) => `
    <button class="cat-nav-btn ${S.catFilter === c.id ? "active" : ""}" data-cat="${c.id}">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span>${c.icon} ${c.name}</span>
    </button>
  `,
    )
    .join("");

  catList.querySelectorAll(".cat-nav-btn").forEach((b) => {
    b.onclick = () => {
      S.catFilter = S.catFilter === b.dataset.cat ? "all" : b.dataset.cat;
      S.filter = "all";
      updateFilterActive();
      load();
      closeSidebar();
    };
  });
}

function updateFilterActive() {
  $$(".filter-btn").forEach((b) =>
    b.classList.toggle("active-filter", b.dataset.filter === S.filter),
  );
  $$(".cat-nav-btn").forEach((b) =>
    b.classList.toggle("active", S.catFilter === b.dataset.cat),
  );
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
function renderDashboard() {
  const s = S.stats;
  $("#mainPercent").textContent = `${s.completionRate}%`;
  $("#dsTodo").textContent = s.todo;
  $("#dsProgress").textContent = s.inProgress;
  $("#dsDone").textContent = s.done;
  $("#dsOverdue").textContent = s.overdue;
  $("#mpbDone").textContent = s.done;
  $("#mpbTotal").textContent = s.total;
  $("#mainProgressFill").style.width = `${s.completionRate}%`;

  // Circular progress
  const circ = 2 * Math.PI * 42;
  const fill = (s.completionRate / 100) * circ;
  const cpFill = $("#circularProgress .cp-fill");
  cpFill.setAttribute("stroke-dasharray", `${fill} ${circ}`);
}

// ══════════════════════════════════════
// KANBAN BOARD
// ══════════════════════════════════════
function renderKanban() {
  const board = $("#kanbanBoard");
  board.style.display = "grid";

  const todos = S.tasks.filter((t) => t.status === "todo");
  const progress = S.tasks.filter((t) => t.status === "in-progress");
  const dones = S.tasks.filter((t) => t.status === "done");

  $("#kCntTodo").textContent = todos.length;
  $("#kCntProgress").textContent = progress.length;
  $("#kCntDone").textContent = dones.length;

  $("#kColTodo").innerHTML = todos.map(kCard).join("") || emptyCol();
  $("#kColProgress").innerHTML = progress.map(kCard).join("") || emptyCol();
  $("#kColDone").innerHTML = dones.map(kCard).join("") || emptyCol();

  // Attach events
  board.querySelectorAll(".k-card").forEach(attachKCardEvents);
  initDragDrop();
}

function emptyCol() {
  return '<div style="padding:20px;text-align:center;color:var(--tx-4);font-size:.8rem">خالی</div>';
}

function kCard(t) {
  const cat = S.categories.find((c) => c.id === t.category);
  const od = isOverdue(t);
  let prog = "";
  if (t.subtasks?.length) {
    const d = t.subtasks.filter((s) => s.done).length;
    const pct = Math.round((d / t.subtasks.length) * 100);
    prog = `<div class="k-card-progress"><div class="k-prog-bar"><div class="k-prog-fill" style="width:${pct}%"></div></div><span class="k-prog-text">${d}/${t.subtasks.length}</span></div>`;
  }
  const tags = t.tags?.length
    ? `<div class="k-card-tags">${t.tags.map((g) => `<span class="k-tag">${g}</span>`).join("")}</div>`
    : "";

  return `
  <div class="k-card" data-id="${t.id}" draggable="true">
    <div class="k-card-actions">
      <button class="k-act edit" title="ویرایش"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button class="k-act del" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button>
    </div>
    <div class="k-card-top">
      <div class="k-card-title">${esc(t.title)}</div>
      ${t.pinned ? '<span class="k-card-pin">📌</span>' : ""}
    </div>
    ${t.description ? `<div class="k-card-desc">${esc(t.description)}</div>` : ""}
    ${tags}
    <div class="k-card-meta">
      <span class="k-badge p-${t.priority}">${prioLabel[t.priority]}</span>
      ${cat ? `<span class="k-badge cat">${cat.icon} ${cat.name}</span>` : ""}
      ${od ? '<span class="k-badge overdue">⚠️ عقب‌مانده</span>' : ""}
      ${t.dueDate ? `<span class="k-card-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${fmtDate(t.dueDate)}</span>` : ""}
    </div>
    ${prog}
  </div>`;
}

function attachKCardEvents(card) {
  const id = card.dataset.id;
  card.addEventListener("click", (e) => {
    if (e.target.closest(".k-act")) return;
    openDetail(id);
  });
  card.querySelector(".k-act.edit")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openEdit(id);
  });
  card.querySelector(".k-act.del")?.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTask(id);
  });
}

// ══════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════
function initDragDrop() {
  const cards = $$(".k-card");
  const cols = $$(".kanban-col-body");

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });

  cols.forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const dragging = $(".k-card.dragging");
      if (dragging && !col.contains(dragging)) {
        col
          .querySelectorAll(".k-card:not(.dragging)")
          .forEach((c) => c.classList.remove("drag-over"));
      }
    });

    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const newStatus = col.closest(".kanban-col").dataset.status;
      try {
        await api(`/api/tasks/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        toast(`وضعیت تغییر کرد: ${statusLabel[newStatus]}`, "success");
        load();
      } catch {
        toast("خطا!", "error");
      }
    });

    col.addEventListener("dragleave", () => {
      col
        .querySelectorAll(".k-card")
        .forEach((c) => c.classList.remove("drag-over"));
    });
  });
}

// ══════════════════════════════════════
// GRID VIEW
// ══════════════════════════════════════
function renderGrid() {
  const v = $("#gridView");
  v.style.display = "block";
  $("#clearDoneGrid").style.display = S.stats.done > 0 ? "flex" : "none";

  const titles = {
    all: "همه تسک‌ها",
    todo: "در انتظار",
    "in-progress": "در حال انجام",
    done: "انجام شده",
    overdue: "عقب‌مانده",
  };
  if (S.catFilter !== "all") {
    const cat = S.categories.find((c) => c.id === S.catFilter);
    $("#gridTitle").textContent = cat ? `${cat.icon} ${cat.name}` : "تسک‌ها";
  } else {
    $("#gridTitle").textContent = titles[S.filter] || "همه تسک‌ها";
  }

  const grid = $("#cardsGrid");
  grid.innerHTML = S.tasks
    .map((t) => {
      const cat = S.categories.find((c) => c.id === t.category);
      const od = isOverdue(t);
      const isDone = t.status === "done";
      let prog = "";
      if (t.subtasks?.length) {
        const d = t.subtasks.filter((s) => s.done).length;
        const pct = Math.round((d / t.subtasks.length) * 100);
        prog = `<div class="g-progress"><div class="k-prog-bar"><div class="k-prog-fill" style="width:${pct}%"></div></div><span class="k-prog-text">${d}/${t.subtasks.length}</span></div>`;
      }
      const tags = t.tags?.length
        ? `<div class="g-tags">${t.tags.map((g) => `<span class="k-tag">${g}</span>`).join("")}</div>`
        : "";

      return `
    <div class="g-card" data-id="${t.id}" data-p="${t.priority}" data-s="${t.status}">
      <div class="g-card-top">
        <button class="g-check ${isDone ? "done" : ""}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>
        </button>
        <div class="g-title-area">
          <div class="g-title">${t.pinned ? "📌 " : ""}${esc(t.title)}</div>
          ${t.description ? `<div class="g-desc">${esc(t.description)}</div>` : ""}
        </div>
        <div class="g-card-actions">
          <button class="k-act edit" title="ویرایش"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="k-act del" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button>
        </div>
      </div>
      <div class="g-meta">
        <span class="k-badge p-${t.priority}">${prioLabel[t.priority]}</span>
        <span class="k-badge status-${t.status}" style="background:var(--${t.status === "done" ? "green" : t.status === "in-progress" ? "primary" : "yellow"}-bg,var(--bg-3));color:var(--${t.status === "done" ? "green" : t.status === "in-progress" ? "primary" : "yellow"},var(--tx-2))">${statusLabel[t.status]}</span>
        ${cat ? `<span class="k-badge cat">${cat.icon}</span>` : ""}
        ${od ? '<span class="k-badge overdue">⚠️</span>' : ""}
        ${t.dueDate ? `<span class="k-card-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${fmtDate(t.dueDate)}</span>` : ""}
      </div>
      ${tags}
      ${prog}
    </div>`;
    })
    .join("");

  grid.querySelectorAll(".g-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector(".g-check").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStatus(id);
    });
    card.querySelector(".k-act.edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEdit(id);
    });
    card.querySelector(".k-act.del")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(id);
    });
    card.addEventListener("click", () => openDetail(id));
  });
}

// ══════════════════════════════════════
// LIST VIEW
// ══════════════════════════════════════
function renderList() {
  $("#listView").style.display = "block";
  const titles = {
    all: "همه تسک‌ها",
    todo: "در انتظار",
    "in-progress": "در حال انجام",
    done: "انجام شده",
    overdue: "عقب‌مانده",
  };
  $("#listTitle").textContent = titles[S.filter] || "همه تسک‌ها";

  const table = $("#listTable");
  table.innerHTML = S.tasks
    .map((t) => {
      const cat = S.categories.find((c) => c.id === t.category);
      const isDone = t.status === "done";
      return `
    <div class="l-row" data-id="${t.id}" data-s="${t.status}">
      <button class="g-check ${isDone ? "done" : ""}" style="width:22px;height:22px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>
      </button>
      <div class="l-title">${t.pinned ? "📌 " : ""}${esc(t.title)}</div>
      <span class="k-badge p-${t.priority}" style="justify-self:center">${prioLabel[t.priority]}</span>
      <span class="k-badge cat" style="justify-self:center">${cat ? cat.icon + " " + cat.name : ""}</span>
      <span style="font-size:.75rem;color:var(--tx-3);text-align:center">${fmtDate(t.dueDate)}</span>
      <div style="display:flex;gap:3px;justify-content:center">
        <button class="k-act edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="k-act del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button>
      </div>
    </div>`;
    })
    .join("");

  table.querySelectorAll(".l-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".g-check").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStatus(id);
    });
    row.querySelector(".k-act.edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openEdit(id);
    });
    row.querySelector(".k-act.del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(id);
    });
    row.addEventListener("click", () => openDetail(id));
  });
}

// ══════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════
function renderAnalytics() {
  $("#analyticsView").style.display = "block";
  const s = S.stats;

  // Weekly Bar Chart
  const maxVal = Math.max(1, ...s.weeklyDone.map((d) => d.count));
  $("#weeklyChart").innerHTML = s.weeklyDone
    .map((d) => {
      const h = (d.count / maxVal) * 130;
      return `<div class="bar-col"><div class="bar-fill" style="height:${h}px"><span class="bar-val">${d.count}</span></div><span class="bar-label">${d.day}</span></div>`;
    })
    .join("");

  // Priority Donut
  const ps = s.priorityStats;
  const total = (ps.high || 0) + (ps.medium || 0) + (ps.low || 0);
  const segs = [
    { label: "زیاد", val: ps.high || 0, color: "var(--red)" },
    { label: "متوسط", val: ps.medium || 0, color: "var(--yellow)" },
    { label: "کم", val: ps.low || 0, color: "var(--green)" },
  ];
  let offset = 0;
  const circ = 2 * Math.PI * 50;
  const paths = segs
    .map((seg) => {
      const pct = total > 0 ? seg.val / total : 0;
      const len = pct * circ;
      const path = `<circle cx="60" cy="60" r="50" fill="none" stroke="${seg.color}" stroke-width="18" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="-${offset}" style="transition:all .8s var(--ease)"/>`;
      offset += len;
      return path;
    })
    .join("");

  $("#priorityChart").innerHTML = `
    <svg viewBox="0 0 120 120" style="width:140px;height:140px;transform:rotate(-90deg)">${paths}</svg>
    <div class="donut-center"><div class="donut-center-val">${total}</div><div class="donut-center-lbl">تسک</div></div>`;

  $("#priorityLegend").innerHTML = segs
    .map(
      (seg) =>
        `<div class="legend-item"><span class="legend-dot" style="background:${seg.color}"></span>${seg.label}: ${seg.val}</div>`,
    )
    .join("");

  // Category Bars
  const cs = s.categoryStats || {};
  $("#categoryChart").innerHTML = S.categories
    .map((cat) => {
      const data = cs[cat.id] || { total: 0, done: 0 };
      const pct =
        data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
      return `
    <div class="cat-bar-item">
      <span class="cat-bar-label">${cat.icon} ${cat.name}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div></div>
      <span class="cat-bar-val">${pct}%</span>
    </div>`;
    })
    .join("");

  // Summary
  $("#summaryStats").innerHTML = `
    <div class="sum-item"><span class="sum-val">${s.total}</span><span class="sum-lbl">کل تسک‌ها</span></div>
    <div class="sum-item"><span class="sum-val" style="color:var(--green)">${s.completionRate}%</span><span class="sum-lbl">نرخ تکمیل</span></div>
    <div class="sum-item"><span class="sum-val" style="color:var(--yellow)">${s.streak}</span><span class="sum-lbl">🔥 استریک روزانه</span></div>
    <div class="sum-item"><span class="sum-val" style="color:var(--cyan)">${fmtTime(s.totalTimeSpent || 0)}</span><span class="sum-lbl">⏱ زمان کل</span></div>
  `;
}

// ══════════════════════════════════════
// TASK ACTIONS
// ══════════════════════════════════════
async function toggleStatus(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const cycle = { todo: "in-progress", "in-progress": "done", done: "todo" };
  const ns = cycle[t.status];
  try {
    await api(`/api/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: ns }),
    });
    toast(`${statusLabel[ns]} ✓`, "success");
    load();
  } catch {
    toast("خطا!", "error");
  }
}

async function deleteTask(id) {
  const ok = await confirm("آیا از حذف این تسک مطمئن هستید؟");
  if (!ok) return;
  try {
    const card = $(`[data-id="${id}"]`);
    if (card) {
      card.classList.add("removing");
      await new Promise((r) => setTimeout(r, 350));
    }
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    toast("تسک حذف شد", "success");
    load();
  } catch {
    toast("خطا!", "error");
  }
}

async function duplicateTask(id) {
  try {
    await api(`/api/tasks/${id}/duplicate`, { method: "POST" });
    toast("تسک کپی شد 📋", "success");
    closeDetail();
    load();
  } catch {
    toast("خطا!", "error");
  }
}

async function pinTask(id) {
  try {
    await api(`/api/tasks/${id}/pin`, { method: "PATCH" });
    toast("📌 تغییر پین", "info");
    closeDetail();
    load();
  } catch {
    toast("خطا!", "error");
  }
}

async function clearDone() {
  const ok = await confirm("همه تسک‌های انجام‌شده حذف خواهند شد.", "پاک‌سازی");
  if (!ok) return;
  try {
    await api("/api/tasks-batch/done", { method: "DELETE" });
    toast("تسک‌های انجام‌شده پاک شدند", "success");
    load();
  } catch {
    toast("خطا!", "error");
  }
}

// ══════════════════════════════════════
// TASK FORM MODAL
// ══════════════════════════════════════
function openCreate() {
  S.editId = null;
  S.subtasks = [];
  $("#tmTitle").textContent = "تسک جدید";
  $("#tmSubmit").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> ساخت تسک';
  resetForm();
  fillCategories();
  $("#taskModalOverlay").classList.add("show");
  setTimeout(() => $("#fTitle").focus(), 300);
}

function openEdit(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  S.editId = id;
  S.subtasks = [...(t.subtasks || [])];
  $("#tmTitle").textContent = "ویرایش تسک";
  $("#tmSubmit").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg> بروزرسانی';
  fillCategories();
  $("#fId").value = t.id;
  $("#fTitle").value = t.title;
  $("#fDesc").value = t.description || "";
  $("#fCategory").value = t.category || "personal";
  $("#fDueDate").value = t.dueDate || "";
  $("#fTags").value = (t.tags || []).join(", ");
  $("#fNotes").value = t.notes || "";
  $$(".prio").forEach((b) =>
    b.classList.toggle("active", b.dataset.p === t.priority),
  );
  renderSubtaskList();
  closeDetail();
  $("#taskModalOverlay").classList.add("show");
  setTimeout(() => $("#fTitle").focus(), 300);
}

function closeForm() {
  $("#taskModalOverlay").classList.remove("show");
  setTimeout(resetForm, 300);
}
function resetForm() {
  $("#taskForm").reset();
  $("#fId").value = "";
  S.subtasks = [];
  $("#stList").innerHTML = "";
  $$(".prio").forEach((b) =>
    b.classList.toggle("active", b.dataset.p === "medium"),
  );
}
function fillCategories() {
  $("#fCategory").innerHTML = S.categories
    .map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`)
    .join("");
}

function renderSubtaskList() {
  $("#stList").innerHTML = S.subtasks
    .map(
      (st, i) => `
    <li class="st-item"><span>${esc(st.text)}</span><button type="button" class="st-rm" data-i="${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></li>
  `,
    )
    .join("");
  $$(".st-rm").forEach((b) =>
    b.addEventListener("click", () => {
      S.subtasks.splice(+b.dataset.i, 1);
      renderSubtaskList();
    }),
  );
}

function addSubtask() {
  const inp = $("#stInput");
  const text = inp.value.trim();
  if (!text) return;
  S.subtasks.push({ id: "new-" + Date.now(), text, done: false });
  inp.value = "";
  renderSubtaskList();
  inp.focus();
}

async function submitForm(e) {
  e.preventDefault();
  const title = $("#fTitle").value.trim();
  if (!title) {
    toast("عنوان الزامی است", "warning");
    return;
  }

  const tagsRaw = $("#fTags").value.trim();
  const data = {
    title,
    description: $("#fDesc").value.trim(),
    priority: $$(".prio.active")[0]?.dataset.p || "medium",
    category: $("#fCategory").value,
    dueDate: $("#fDueDate").value || null,
    tags: tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    subtasks: S.subtasks,
    notes: $("#fNotes").value.trim(),
  };

  try {
    if (S.editId) {
      await api(`/api/tasks/${S.editId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      toast("تسک بروزرسانی شد ✏️", "success");
    } else {
      await api("/api/tasks", { method: "POST", body: JSON.stringify(data) });
      toast("تسک جدید ساخته شد 🎉", "success");
    }
    closeForm();
    load();
  } catch {
    toast("خطا!", "error");
  }
}

// ══════════════════════════════════════
// DETAIL MODAL
// ══════════════════════════════════════
function openDetail(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const cat = S.categories.find((c) => c.id === t.category);

  let stHTML = "";
  if (t.subtasks?.length) {
    stHTML = `<div class="dt-subtasks"><h4>زیرتسک‌ها</h4>${t.subtasks
      .map(
        (s) =>
          `<div class="dt-st-item ${s.done ? "done" : ""}" data-tid="${t.id}" data-sid="${s.id}"><div class="dt-st-check"></div><span>${esc(s.text)}</span></div>`,
      )
      .join("")}</div>`;
  }

  const body = $("#detailBody");
  body.innerHTML = `
    <div class="dt-title">${t.pinned ? "📌 " : ""}${esc(t.title)}</div>
    <div class="dt-desc">${t.description ? esc(t.description) : '<em style="color:var(--tx-4)">بدون توضیحات</em>'}</div>
    <div class="dt-meta">
      <span class="k-badge p-${t.priority}">${prioLabel[t.priority]}</span>
      <span class="k-badge" style="background:var(--${t.status === "done" ? "green" : t.status === "in-progress" ? "primary" : "yellow"}-bg);color:var(--${t.status === "done" ? "green" : t.status === "in-progress" ? "primary" : "yellow"})">${statusLabel[t.status]}</span>
      ${cat ? `<span class="k-badge cat">${cat.icon} ${cat.name}</span>` : ""}
      ${t.dueDate ? `<span class="k-card-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${fmtDate(t.dueDate)}</span>` : ""}
    </div>
    ${t.tags?.length ? `<div class="k-card-tags" style="margin-bottom:10px">${t.tags.map((g) => `<span class="k-tag">${g}</span>`).join("")}</div>` : ""}
    
    <div class="dt-status-btns">
      <button class="dt-st-btn ${t.status === "todo" ? "active" : ""}" data-s="todo">📋 در انتظار</button>
      <button class="dt-st-btn ${t.status === "in-progress" ? "active" : ""}" data-s="in-progress">⚡ در حال انجام</button>
      <button class="dt-st-btn ${t.status === "done" ? "active" : ""}" data-s="done">✅ انجام شده</button>
    </div>

    ${stHTML}

    ${t.notes ? `<div class="dt-notes"><div class="dt-notes-title">📝 یادداشت</div>${esc(t.notes)}</div>` : ""}

    ${t.timeSpent > 0 ? `<div class="dt-time">⏱ زمان صرف‌شده: <span class="dt-time-val">${fmtTime(t.timeSpent)}</span></div>` : ""}

    <div class="dt-actions">
      <button class="dt-act edit" data-id="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>ویرایش</button>
      <button class="dt-act dup" data-id="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>کپی</button>
      <button class="dt-act pin" data-id="${t.id}">📌 ${t.pinned ? "آنپین" : "پین"}</button>
      <button class="dt-act del" data-id="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>حذف</button>
    </div>`;

  // Events
  body.querySelectorAll(".dt-st-btn").forEach((b) => {
    b.addEventListener("click", async () => {
      await api(`/api/tasks/${t.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: b.dataset.s }),
      });
      toast(`${statusLabel[b.dataset.s]} ✓`, "success");
      closeDetail();
      load();
    });
  });

  body.querySelectorAll(".dt-st-item").forEach((item) => {
    item.addEventListener("click", async () => {
      await api(`/api/tasks/${item.dataset.tid}/subtasks/${item.dataset.sid}`, {
        method: "PATCH",
      });
      load();
      setTimeout(() => openDetail(t.id), 150);
    });
  });

  body
    .querySelector(".dt-act.edit")
    ?.addEventListener("click", () => openEdit(t.id));
  body
    .querySelector(".dt-act.dup")
    ?.addEventListener("click", () => duplicateTask(t.id));
  body
    .querySelector(".dt-act.pin")
    ?.addEventListener("click", () => pinTask(t.id));
  body.querySelector(".dt-act.del")?.addEventListener("click", () => {
    closeDetail();
    deleteTask(t.id);
  });

  $("#detailOverlay").classList.add("show");
}

function closeDetail() {
  $("#detailOverlay").classList.remove("show");
}

// ══════════════════════════════════════
// POMODORO TIMER
// ══════════════════════════════════════
function updatePomoSelect() {
  const sel = $("#pomoTask");
  const active = S.tasks.filter((t) => t.status !== "done");
  sel.innerHTML =
    '<option value="">بدون تسک</option>' +
    active
      .map(
        (t) =>
          `<option value="${t.id}" ${S.pomo.taskId === t.id ? "selected" : ""}>${esc(t.title)}</option>`,
      )
      .join("");
}

function updatePomoDisplay() {
  const m = Math.floor(S.pomo.seconds / 60);
  const s = S.pomo.seconds % 60;
  $("#pomoTime").textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const circ = 2 * Math.PI * 52;
  const pct = S.pomo.total > 0 ? S.pomo.seconds / S.pomo.total : 1;
  $("#pomoRingFill").setAttribute("stroke-dasharray", `${pct * circ} ${circ}`);
}

function startPomo() {
  if (S.pomo.running && !S.pomo.paused) return;
  S.pomo.taskId = $("#pomoTask").value || null;
  S.pomo.running = true;
  S.pomo.paused = false;
  $("#pomoStart").style.display = "none";
  $("#pomoPause").style.display = "block";
  $("#pomoLabel").textContent =
    S.pomo.mode === "work" ? "🔥 در حال کار" : "☕ استراحت";

  S.pomo.interval = setInterval(() => {
    S.pomo.seconds--;
    updatePomoDisplay();

    if (S.pomo.seconds <= 0) {
      clearInterval(S.pomo.interval);
      if (S.pomo.mode === "work") {
        S.pomo.sessions++;
        $("#pomoSessions").textContent = S.pomo.sessions;
        // Save time
        if (S.pomo.taskId) {
          api(`/api/tasks/${S.pomo.taskId}/time`, {
            method: "PATCH",
            body: JSON.stringify({ seconds: S.pomo.total }),
          });
        }
        toast("🍅 یک پومودورو تکمیل شد!", "success");
        // Start break
        S.pomo.mode = "break";
        const breakTime = (S.settings.pomodoroBreak || 5) * 60;
        S.pomo.seconds = breakTime;
        S.pomo.total = breakTime;
        S.pomo.running = false;
        S.pomo.paused = false;
        $("#pomoStart").style.display = "block";
        $("#pomoPause").style.display = "none";
        $("#pomoLabel").textContent = "☕ نوبت استراحت";
      } else {
        toast("☕ استراحت تمام شد!", "info");
        resetPomo();
      }
      updatePomoDisplay();
    }
  }, 1000);
}

function pausePomo() {
  if (!S.pomo.running) return;
  clearInterval(S.pomo.interval);
  S.pomo.paused = true;
  $("#pomoStart").style.display = "block";
  $("#pomoPause").style.display = "none";
  $("#pomoLabel").textContent = "⏸ متوقف";
}

function resetPomo() {
  clearInterval(S.pomo.interval);
  S.pomo.mode = "work";
  const workTime = (S.settings.pomodoroWork || 25) * 60;
  S.pomo.seconds = workTime;
  S.pomo.total = workTime;
  S.pomo.running = false;
  S.pomo.paused = false;
  $("#pomoStart").style.display = "block";
  $("#pomoPause").style.display = "none";
  $("#pomoLabel").textContent = "آماده شروع";
  updatePomoDisplay();
}

// ══════════════════════════════════════
// SIDEBAR MOBILE
// ══════════════════════════════════════
function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#sidebarOverlay").classList.add("show");
}
function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("show");
}

// ══════════════════════════════════════
// EVENTS
// ══════════════════════════════════════
function initEvents() {
  // Theme
  $("#themeBtn").onclick = () =>
    setTheme(S.theme === "light" ? "dark" : "light");

  // Sidebar
  $("#hamburgerBtn").onclick = openSidebar;
  $("#sidebarCloseBtn").onclick = closeSidebar;
  $("#sidebarOverlay").onclick = closeSidebar;

  // View buttons
  $$("[data-view]").forEach((b) => {
    b.onclick = () => {
      $$("[data-view]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      S.view = b.dataset.view;
      localStorage.setItem("view", S.view);
      renderView();
      closeSidebar();
    };
  });

  // Filter buttons
  $$(".filter-btn").forEach((b) => {
    b.onclick = () => {
      S.filter = b.dataset.filter;
      S.catFilter = "all";
      updateFilterActive();
      load();
      closeSidebar();
    };
  });

  // Search
  let debounce;
  $("#searchInput").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      S.search = $("#searchInput").value.trim();
      load();
    }, 300);
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      $("#searchInput").focus();
    }
    if (e.key === "Escape") {
      closeForm();
      closeDetail();
      $("#confirmOverlay").classList.remove("show");
      closeSidebar();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      openCreate();
    }
  });

  // Sort
  $("#sortTrigger").onclick = (e) => {
    e.stopPropagation();
    $("#sortMenu").classList.toggle("show");
  };
  document.addEventListener("click", () =>
    $("#sortMenu").classList.remove("show"),
  );
  $$(".dropdown-item").forEach((b) => {
    b.onclick = () => {
      $$(".dropdown-item").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      S.sort = b.dataset.sort;
      $("#sortLabel").textContent = b.textContent.trim();
      load();
    };
  });

  // New task
  $("#newTaskBtn").onclick = openCreate;
  $("#emptyNewBtn").onclick = openCreate;

  // Task form
  $("#taskForm").addEventListener("submit", submitForm);
  $("#tmClose").onclick = closeForm;
  $("#tmCancel").onclick = closeForm;
  $("#taskModalOverlay").addEventListener("click", (e) => {
    if (e.target === $("#taskModalOverlay")) closeForm();
  });

  // Priority buttons
  $$(".prio").forEach((b) => {
    b.onclick = () => {
      $$(".prio").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
  });

  // Subtasks
  $("#stAddBtn").onclick = addSubtask;
  $("#stInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask();
    }
  });

  // Detail
  $("#dtClose").onclick = closeDetail;
  $("#detailOverlay").addEventListener("click", (e) => {
    if (e.target === $("#detailOverlay")) closeDetail();
  });

  // Confirm
  $("#confirmOverlay").addEventListener("click", (e) => {
    if (e.target === $("#confirmOverlay"))
      $("#confirmOverlay").classList.remove("show");
  });

  // Clear done
  $("#clearDoneKanban").onclick = clearDone;
  $("#clearDoneGrid").onclick = clearDone;

  // Export
  $("#exportBtn").onclick = () => {
    window.location.href = "/api/export";
    toast("فایل دانلود شد 📥", "info");
  };

  // Pomodoro
  $("#pomoToggle").onclick = () => $("#pomoPanel").classList.toggle("show");
  $("#pomoStart").onclick = startPomo;
  $("#pomoPause").onclick = pausePomo;
  $("#pomoReset").onclick = resetPomo;
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pomodoro-widget"))
      $("#pomoPanel").classList.remove("show");
  });

  // Settings (placeholder)
  $("#settingsBtn").onclick = () =>
    toast("تنظیمات به‌زودی اضافه می‌شود ⚙️", "info");

  // Set initial active view
  $$("[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === S.view),
  );
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
function init() {
  setTheme(S.theme);
  initEvents();
  resetPomo();
  load();
}

document.addEventListener("DOMContentLoaded", init);
