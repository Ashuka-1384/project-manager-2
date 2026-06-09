const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "tasks.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Helpers ────────────────────────────────────
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    const defaults = {
      tasks: [],
      categories: [],
      settings: { pomodoroWork: 25, pomodoroBreak: 5, pomodoroLongBreak: 15 },
    };
    writeData(defaults);
    return defaults;
  }
}

function writeData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function buildStats(tasks) {
  const now = new Date();
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now,
  ).length;
  const highPriority = tasks.filter(
    (t) => t.priority === "high" && t.status !== "done",
  ).length;

  const totalTimeSpent = tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);

  // Category stats
  const categoryStats = {};
  tasks.forEach((t) => {
    if (!categoryStats[t.category])
      categoryStats[t.category] = { total: 0, done: 0 };
    categoryStats[t.category].total++;
    if (t.status === "done") categoryStats[t.category].done++;
  });

  // Priority stats
  const priorityStats = {
    high: tasks.filter((t) => t.priority === "high").length,
    medium: tasks.filter((t) => t.priority === "medium").length,
    low: tasks.filter((t) => t.priority === "low").length,
  };

  // Weekly done count (last 7 days)
  const weeklyDone = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const count = tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        t.completedAt.startsWith(dayStr),
    ).length;
    weeklyDone.push({
      date: dayStr,
      day: d.toLocaleDateString("fa-IR", { weekday: "short" }),
      count,
    });
  }

  // Streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const hasDone = tasks.some(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        t.completedAt.startsWith(dayStr),
    );
    if (hasDone) streak++;
    else if (i > 0) break;
  }

  return {
    total,
    todo,
    inProgress,
    done,
    overdue,
    highPriority,
    totalTimeSpent,
    categoryStats,
    priorityStats,
    weeklyDone,
    streak,
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

// ─── TASKS ──────────────────────────────────────
app.get("/api/tasks", (req, res) => {
  try {
    const data = readData();
    let tasks = [...data.tasks];
    const { status, priority, category, search, sort, order, pinned } =
      req.query;

    if (status && status !== "all")
      tasks = tasks.filter((t) => t.status === status);
    if (priority && priority !== "all")
      tasks = tasks.filter((t) => t.priority === priority);
    if (category && category !== "all")
      tasks = tasks.filter((t) => t.category === category);
    if (pinned === "true") tasks = tasks.filter((t) => t.pinned);
    if (search) {
      const s = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description || "").toLowerCase().includes(s) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(s)) ||
          (t.notes || "").toLowerCase().includes(s),
      );
    }

    const sortField = sort || "createdAt";
    const sortDir = order === "asc" ? 1 : -1;
    const pw = { high: 3, medium: 2, low: 1 };

    tasks.sort((a, b) => {
      // Pinned first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (sortField === "priority")
        return (pw[b.priority] - pw[a.priority]) * sortDir;
      if (sortField === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return (new Date(a.dueDate) - new Date(b.dueDate)) * sortDir;
      }
      if (sortField === "title")
        return a.title.localeCompare(b.title, "fa") * sortDir;
      return (new Date(b.createdAt) - new Date(a.createdAt)) * sortDir;
    });

    const stats = buildStats(data.tasks);
    res.json({
      tasks,
      stats,
      categories: data.categories,
      settings: data.settings || {},
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/tasks/:id", (req, res) => {
  const data = readData();
  const task = data.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

app.post("/api/tasks", (req, res) => {
  try {
    const data = readData();
    const {
      title,
      description,
      priority,
      category,
      dueDate,
      tags,
      subtasks,
      notes,
    } = req.body;
    if (!title?.trim())
      return res.status(400).json({ error: "Title required" });

    const newTask = {
      id: uuidv4(),
      title: title.trim(),
      description: (description || "").trim(),
      priority: priority || "medium",
      status: "todo",
      category: category || "personal",
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      subtasks: (subtasks || []).map((st) => ({
        id: uuidv4(),
        text: st.text,
        done: false,
      })),
      tags: tags || [],
      timeSpent: 0,
      notes: (notes || "").trim(),
      pinned: false,
    };

    data.tasks.unshift(newTask);
    writeData(data);
    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/tasks/:id", (req, res) => {
  try {
    const data = readData();
    const idx = data.tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const prev = data.tasks[idx];
    const updated = { ...prev, ...req.body, id: req.params.id };

    // Track completion
    if (req.body.status === "done" && prev.status !== "done") {
      updated.completedAt = new Date().toISOString();
    } else if (req.body.status && req.body.status !== "done") {
      updated.completedAt = null;
    }

    data.tasks[idx] = updated;
    writeData(data);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id/status", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });

    const prevStatus = task.status;
    task.status = req.body.status;

    if (task.status === "done" && prevStatus !== "done") {
      task.completedAt = new Date().toISOString();
    } else if (task.status !== "done") {
      task.completedAt = null;
    }

    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id/pin", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });
    task.pinned = !task.pinned;
    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id/time", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });
    task.timeSpent = (task.timeSpent || 0) + (req.body.seconds || 0);
    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id/subtasks/:subtaskId", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });

    const sub = task.subtasks.find((s) => s.id === req.params.subtaskId);
    if (!sub) return res.status(404).json({ error: "Subtask not found" });

    sub.done = !sub.done;

    const allDone =
      task.subtasks.length > 0 && task.subtasks.every((s) => s.done);
    const someDone = task.subtasks.some((s) => s.done);

    if (allDone) {
      if (task.status !== "done") task.completedAt = new Date().toISOString();
      task.status = "done";
    } else if (someDone) {
      task.status = "in-progress";
      task.completedAt = null;
    } else {
      task.status = "todo";
      task.completedAt = null;
    }

    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/tasks/:id/subtasks", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });

    const newSub = { id: uuidv4(), text: req.body.text, done: false };
    task.subtasks.push(newSub);
    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/tasks/:id/subtasks/:subtaskId", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });
    task.subtasks = task.subtasks.filter((s) => s.id !== req.params.subtaskId);
    writeData(data);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  try {
    const data = readData();
    const idx = data.tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    data.tasks.splice(idx, 1);
    writeData(data);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/tasks-batch/done", (req, res) => {
  try {
    const data = readData();
    data.tasks = data.tasks.filter((t) => t.status !== "done");
    writeData(data);
    res.json({ message: "Cleared" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/tasks/:id/duplicate", (req, res) => {
  try {
    const data = readData();
    const task = data.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Not found" });

    const dup = {
      ...JSON.parse(JSON.stringify(task)),
      id: uuidv4(),
      title: task.title + " (کپی)",
      status: "todo",
      completedAt: null,
      createdAt: new Date().toISOString(),
      timeSpent: 0,
      pinned: false,
      subtasks: task.subtasks.map((s) => ({ ...s, id: uuidv4(), done: false })),
    };

    data.tasks.unshift(dup);
    writeData(data);
    res.status(201).json(dup);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── CATEGORIES ─────────────────────────────────
app.get("/api/categories", (req, res) => {
  res.json(readData().categories);
});

app.post("/api/categories", (req, res) => {
  try {
    const data = readData();
    const cat = {
      id: req.body.id || uuidv4(),
      name: req.body.name,
      color: req.body.color || "#6366f1",
      icon: req.body.icon || "📁",
    };
    data.categories.push(cat);
    writeData(data);
    res.status(201).json(cat);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/categories/:id", (req, res) => {
  try {
    const data = readData();
    data.categories = data.categories.filter((c) => c.id !== req.params.id);
    data.tasks.forEach((t) => {
      if (t.category === req.params.id) t.category = "personal";
    });
    writeData(data);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SETTINGS ───────────────────────────────────
app.get("/api/settings", (req, res) => {
  const data = readData();
  res.json(data.settings || {});
});

app.put("/api/settings", (req, res) => {
  try {
    const data = readData();
    data.settings = { ...data.settings, ...req.body };
    writeData(data);
    res.json(data.settings);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── EXPORT ─────────────────────────────────────
app.get("/api/export", (req, res) => {
  const data = readData();
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=tasks-export.json",
  );
  res.json(data);
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Task Manager Pro V2 running at http://localhost:${PORT}\n`);
});
