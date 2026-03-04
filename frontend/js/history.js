const LS = {
  history: "cookai.history",
  restore: "cookai.restore",
  user: "cookai.user",
};

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

const state = {
  search: "",
  filter: "all",
  sort: "new",
  selected: new Set(),
  editing: false,
};

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(LS.user) || "null");
  } catch {
    return null;
  }
}

function updateUserUI() {
  const user = loadUser();
  const navName = document.querySelector(".sidebar-user-name");
  if (navName) navName.textContent = user?.name || "Tài khoản";
  const navAvatar = document.querySelector(".sidebar-user-avatar");
  if (navAvatar && user?.avatar) {
    navAvatar.style.backgroundImage = `url('${user.avatar}')`;
  }
}

function bindNav() {
  const navSettings = $("btnSettingsNav");
  if (navSettings) navSettings.addEventListener("click", () => (window.location.href = "settings.html"));
  const navProfile = $("btnProfileNav");
  if (navProfile)
    navProfile.addEventListener("click", () => {
      const user = loadUser();
      window.location.href = user ? "settings.html" : "login.html";
    });
}

function getHistoryItems() {
  try {
    return JSON.parse(localStorage.getItem(LS.history) || "[]");
  } catch {
    return [];
  }
}

function saveHistoryItems(items) {
  localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 50)));
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("vi-VN");
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function getItemKey(it) {
  return it.id || `${it.createdAt || ""}-${it.title || ""}`;
}

function filterItems(items) {
  const keyword = state.search.trim().toLowerCase();
  const now = Date.now();
  const days = Number(state.filter);
  return items.filter((it) => {
    if (state.filter !== "all" && it.createdAt) {
      const diff = now - Number(it.createdAt);
      if (diff > days * 24 * 60 * 60 * 1000) return false;
    }
    if (!keyword) return true;
    const title = String(it.title || "").toLowerCase();
    const ing = (it.ingredients || []).join(",").toLowerCase();
    return title.includes(keyword) || ing.includes(keyword);
  });
}

function sortItems(items) {
  if (state.sort === "old") return items.slice().reverse();
  return items;
}

function renderStats(total, filtered) {
  const host = $("historyStats");
  if (!host) return;
  host.textContent = `Tổng ${total} món · Đang hiển thị ${filtered} món`;
}

function renderHistory() {
  const host = $("history");
  if (!host) return;
  const items = getHistoryItems();
  const filtered = sortItems(filterItems(items));
  renderStats(items.length, filtered.length);

  if (!filtered.length) {
    host.innerHTML = `<div class="empty">Chưa có lịch sử phù hợp.</div>`;
    return;
  }

  host.innerHTML = filtered
    .map((it, idx) => {
      const key = getItemKey(it);
      const when = formatTime(it.createdAt);
      const ing = inlineText((it.ingredients || []).slice(0, 6).join(", "));
      const suffix = (it.ingredients || []).length > 6 ? "…" : "";
      const title = inlineText(it.title || "Món gợi ý");
      const whenText = inlineText(when);
      const checked = state.selected.has(key) ? "checked" : "";
      return `
        <div class="history-item">
          <input class="history-check" type="checkbox" data-key="${key}" ${checked} />
          <div class="history-info">
            <div class="title">${escapeHtml(title || "Món gợi ý")}</div>
            <div class="sub">${escapeHtml(whenText)} · ${escapeHtml(ing)}${suffix}</div>
          </div>
          <div class="history-actions">
            <button class="btn btn-ghost" data-action="restore" data-key="${key}">↩ Mở lại</button>
          </div>
        </div>
      `;
    })
    .join("");

  host.querySelectorAll(".history-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.getAttribute("data-key");
      if (!key) return;
      if (checkbox.checked) state.selected.add(key);
      else state.selected.delete(key);
    });
  });

  host.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-key");
      const action = btn.getAttribute("data-action");
      const items2 = getHistoryItems();
      const idx = items2.findIndex((it) => getItemKey(it) === key);
      if (idx === -1) return;
      const it = items2[idx];

      if (action === "restore") {
        localStorage.setItem(LS.restore, JSON.stringify(it));
        window.location.href = "index.html";
      }
    });
  });
}

function bindToolbar() {
  const search = $("historySearch");
  const filter = $("historyFilter");
  const sort = $("historySort");
  const selectAll = $("historySelectAll");
  const btnDelete = $("btnDeleteSelected");
  const btnClear = $("btnClearHistory");
  const btnEdit = $("btnEditHistory");

  if (search) search.addEventListener("input", () => {
    state.search = search.value || "";
    renderHistory();
  });

  if (filter) filter.addEventListener("change", () => {
    state.filter = filter.value;
    renderHistory();
  });

  if (sort) sort.addEventListener("change", () => {
    state.sort = sort.value;
    renderHistory();
  });

  if (selectAll)
    selectAll.addEventListener("change", () => {
      const items = sortItems(filterItems(getHistoryItems()));
      if (selectAll.checked) {
        items.forEach((it) => state.selected.add(getItemKey(it)));
      } else {
        items.forEach((it) => state.selected.delete(getItemKey(it)));
      }
      renderHistory();
    });

  if (btnDelete)
    btnDelete.addEventListener("click", () => {
      if (!state.selected.size) return;
      const ok = confirm("Bạn muốn xóa các mục đã chọn?");
      if (!ok) return;
      const items = getHistoryItems().filter((it) => !state.selected.has(getItemKey(it)));
      state.selected.clear();
      saveHistoryItems(items);
      renderHistory();
    });

  if (btnClear)
    btnClear.addEventListener("click", () => {
      const ok = confirm("Bạn muốn xóa toàn bộ lịch sử?");
      if (!ok) return;
      saveHistoryItems([]);
      state.selected.clear();
      renderHistory();
    });

  if (btnEdit)
    btnEdit.addEventListener("click", () => {
      state.editing = !state.editing;
      document.body.classList.toggle("history-editing", state.editing);
      if (btnEdit) btnEdit.textContent = state.editing ? "✅ Xong" : "✏️ Chỉnh sửa";
      if (!state.editing) {
        state.selected.clear();
        const selectAllBox = $("historySelectAll");
        if (selectAllBox) selectAllBox.checked = false;
      }
      renderHistory();
    });
}

document.addEventListener("DOMContentLoaded", () => {
  updateUserUI();
  bindNav();
  bindToolbar();
  renderHistory();
});

