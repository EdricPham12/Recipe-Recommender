// History utilities for SmartCook frontend
// containing logic for saving, loading and rendering suggestion history.
// Requires `LS`, `escapeHtml`, and `$` helpers to be defined elsewhere
// (login.js + app.js respectively). Script should be included before code
// that calls `renderHistory()` (index.js, app.js). 

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS.history) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 20)));
}

function renderHistory() {
  const host = $("history");
  if (!host) return;
  const items = loadHistory();
  if (!items.length) {
    host.innerHTML = `<div class="empty">Chua co lich su.</div>`;
    return;
  }
  host.innerHTML = items
    .map((it, idx) => {
      const when = new Date(it.createdAt).toLocaleString();
      const ing = (it.ingredients || []).slice(0, 6).join(", ");
      return `
        <div class="history-item">
          <div class="title">${escapeHtml(it.title || "Mon goi y")}</div>
          <div class="sub">${escapeHtml(when)} · ${escapeHtml(ing)}${(it.ingredients || []).length > 6 ? "…" : ""}</div>
          <div class="row">
            <button class="btn btn-ghost" data-action="restore" data-idx="${idx}">Mo lai</button>
            <button class="btn btn-ghost" data-action="delete" data-idx="${idx}">Xoa</button>
          </div>
        </div>
      `;
    })
    .join("");

  host.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const action = btn.getAttribute("data-action");
      const items2 = loadHistory();
      const it = items2[idx];
      if (!it) return;
      if (action === "delete") {
        items2.splice(idx, 1);
        saveHistory(items2);
        renderHistory();
        renderReviewSelect();
        return;
      }
      if (action === "restore") {
        localStorage.setItem(LS.restore, JSON.stringify(it));
        window.location.href = "index.html";
      }
    });
  });
}
