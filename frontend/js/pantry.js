(function () {
  "use strict";

  const LS = {
    pantry: "cookai.pantry",
    user: "cookai.user",
    apiBase: "smartcook_api_base",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeIngredients(text) {
    const raw = (text || "")
      .replace(/\r/g, "")
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const item of raw) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function getApiBase() {
    const saved = (localStorage.getItem(LS.apiBase) || "").trim();
    return (saved || "http://127.0.0.1:9000").replace(/\/+$/, "");
  }

  function loadPantryText() {
    return localStorage.getItem(LS.pantry) || "";
  }

  function savePantryText(text) {
    localStorage.setItem(LS.pantry, text || "");
  }

  function loadUser() {
    try {
      return JSON.parse(localStorage.getItem(LS.user) || "null");
    } catch {
      return null;
    }
  }

  function clearUser() {
    localStorage.removeItem(LS.user);
  }

  function updateUserUI() {
    const user = loadUser();
    const navName = document.querySelector(".sidebar-user-name");
    if (navName) navName.textContent = user?.name || "Đăng nhập";
  }

  function renderPantrySavedList() {
    const host = $("pantrySavedList");
    if (!host) return;
    const items = normalizeIngredients(loadPantryText());
    host.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "Chưa có dữ liệu tủ lạnh.";
      host.appendChild(li);
      return;
    }
    items.forEach((name) => {
      const li = document.createElement("li");
      li.className = "pantry-list-item";
      li.innerHTML = `<label class="pantry-item"><input type="checkbox" data-name="${name}" /> ${name}</label>`;
      host.appendChild(li);
    });
  }

  async function pullPantryFromServer() {
    const user = loadUser();
    const userId = Number(user?.id || 0);
    if (!Number.isFinite(userId) || userId <= 0) return false;

    try {
      const resp = await fetch(`${getApiBase()}/pantry/${userId}`);
      if (!resp.ok) return false;
      const data = await resp.json();
      const text = String(data?.text || "");
      savePantryText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function pushPantryToServer(text) {
    const user = loadUser();
    const userId = Number(user?.id || 0);
    if (!Number.isFinite(userId) || userId <= 0) return false;

    try {
      const resp = await fetch(`${getApiBase()}/pantry/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text || "" }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  function performLogout() {
    clearUser();
    updateUserUI();
  }

  async function setupPantryPage() {
    updateUserUI();
    let editMode = false;

    await pullPantryFromServer();

    const navSettings = $("btnSettingsNav");
    if (navSettings) navSettings.addEventListener("click", () => (window.location.href = "settings.html"));
    const navProfile = $("btnProfileNav");
    if (navProfile)
      navProfile.addEventListener("click", () => {
        const user = loadUser();
        window.location.href = user ? "settings.html" : "login.html";
      });

    const btnLogout = $("btnFakeLogout");
    if (btnLogout)
      btnLogout.addEventListener("click", () => {
        const user = loadUser();
        if (!user) window.location.href = "login.html";
        else performLogout();
      });

    $("btnSavePantry")?.addEventListener("click", async () => {
      const ingEl = $("ingredientsText");
      const pantryEl = $("pantryText");
      const ingredients = normalizeIngredients(ingEl?.value || "");
      const pantryInput = normalizeIngredients(pantryEl?.value || "");
      const stored = normalizeIngredients(loadPantryText());
      const merged = normalizeIngredients([...stored, ...ingredients, ...pantryInput].join(", "));
      const mergedText = merged.join(", ");

      savePantryText(mergedText);
      const synced = await pushPantryToServer(mergedText);

      if (pantryEl) pantryEl.value = "";
      if (ingEl) ingEl.value = "";
      renderPantrySavedList();

      if (synced) alert("Đã lưu tủ lạnh (SQL).");
      else alert("Đã lưu cục bộ, chưa đồng bộ SQL. Kiểm tra đăng nhập/backend.");
    });

    const btnToggleEdit = $("btnToggleEdit");
    const btnRemoveSelected = $("btnRemoveSelected");
    const listEl = $("pantrySavedList");
    if (btnToggleEdit && btnRemoveSelected && listEl) {
      btnToggleEdit.addEventListener("click", () => {
        editMode = !editMode;
        listEl.classList.toggle("is-editing", editMode);
        btnRemoveSelected.classList.toggle("hidden", !editMode);
        btnToggleEdit.innerHTML = editMode
          ? '<span class="icon">✅</span>Xong'
          : '<span class="icon">✏️</span>Chỉnh sửa';
      });
    }

    $("btnRemoveSelected")?.addEventListener("click", async () => {
      const host = $("pantrySavedList");
      if (!host) return;
      const checks = Array.from(host.querySelectorAll("input[type='checkbox'][data-name]"));
      const selected = checks.filter((c) => c.checked).map((c) => c.getAttribute("data-name") || "");
      if (!selected.length) {
        alert("Bạn chưa chọn nguyên liệu để xóa.");
        return;
      }
      const stored = normalizeIngredients(loadPantryText());
      const removeKeys = selected.map((x) => x.toLowerCase());
      const next = stored.filter((x) => !removeKeys.includes(x.toLowerCase()));
      const nextText = next.join(", ");
      savePantryText(nextText);
      const synced = await pushPantryToServer(nextText);
      renderPantrySavedList();
      if (!synced) alert("Đã cập nhật cục bộ, chưa đồng bộ SQL.");
    });

    const pantryEl = $("pantryText");
    if (pantryEl) pantryEl.value = "";

    renderPantrySavedList();
  }

  document.addEventListener("DOMContentLoaded", setupPantryPage);
})();
