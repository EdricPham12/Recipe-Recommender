(function () {
  "use strict";

  const LS = {
    pantry: "cookai.pantry",
    user: "cookai.user",
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

  function performLogout() {
    clearUser();
    updateUserUI();
  }

  function setupPantryPage() {
    updateUserUI();
    let editMode = false;

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

    $("btnSavePantry")?.addEventListener("click", () => {
      const ingEl = $("ingredientsText");
      const pantryEl = $("pantryText");
      const ingredients = normalizeIngredients(ingEl?.value || "");
      const pantryInput = normalizeIngredients(pantryEl?.value || "");
      const stored = normalizeIngredients(loadPantryText());
      const merged = normalizeIngredients([...stored, ...ingredients, ...pantryInput].join(", "));
      savePantryText(merged.join(", "));
      if (pantryEl) pantryEl.value = "";
      if (ingEl) ingEl.value = "";
      renderPantrySavedList();
      alert("Đã lưu tủ lạnh.");
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

    $("btnRemoveSelected")?.addEventListener("click", () => {
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
      savePantryText(next.join(", "));
      renderPantrySavedList();
    });

    const pantryEl = $("pantryText");
    if (pantryEl) pantryEl.value = "";

    renderPantrySavedList();
  }

  document.addEventListener("DOMContentLoaded", setupPantryPage);
})();

