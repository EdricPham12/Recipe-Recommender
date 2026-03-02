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

  function toKey(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
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

  function getAvailableItems() {
    const pantryText = $("pantryText")?.value || "";
    return normalizeIngredients(pantryText).map((x) => toKey(x));
  }

  function isAvailableIngredient(name, available) {
    const key = toKey(name);
    return available.some((item) => item === key || key.includes(item) || item.includes(key));
  }

  function updateShoppingList() {
    const missingHost = $("missingList");
    const haveHost = $("haveList");
    if (!missingHost || !haveHost) return;
    missingHost.innerHTML = "";
    haveHost.innerHTML = "";

    const ingredientsText = $("ingredientsText")?.value || "";
    const ingredients = normalizeIngredients(ingredientsText);

    if (!ingredients.length) {
      missingHost.innerHTML = `<li>Chưa có dữ liệu.</li>`;
      haveHost.innerHTML = `<li>Chưa có dữ liệu.</li>`;
      return;
    }

    const available = getAvailableItems();
    const missing = [];
    const have = [];

    ingredients.forEach((name) => {
      if (isAvailableIngredient(name, available)) have.push(name);
      else missing.push(name);
    });

    if (!missing.length) {
      const li = document.createElement("li");
      li.textContent = "Bạn đã có đủ nguyên liệu!";
      missingHost.appendChild(li);
    } else {
      missing.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        missingHost.appendChild(li);
      });
    }

    if (!have.length) {
      const li = document.createElement("li");
      li.textContent = "Chưa xác định.";
      haveHost.appendChild(li);
    } else {
      have.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        haveHost.appendChild(li);
      });
    }
  }

  function performLogout() {
    clearUser();
    updateUserUI();
  }

  function setupPantryPage() {
    updateUserUI();

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
      savePantryText($("pantryText")?.value || "");
      updateShoppingList();
      alert("Đã lưu tủ lạnh.");
    });

    $("btnUsePantry")?.addEventListener("click", () => {
      const ingEl = $("ingredientsText");
      const pantryEl = $("pantryText");
      if (!ingEl || !pantryEl) return;
      const combined = normalizeIngredients([ingEl.value, pantryEl.value].join(", "));
      ingEl.value = combined.join(", ");
      updateShoppingList();
    });

    const pantryEl = $("pantryText");
    if (pantryEl) pantryEl.value = loadPantryText();

    $("ingredientsText")?.addEventListener("input", updateShoppingList);
    $("pantryText")?.addEventListener("input", updateShoppingList);

    updateShoppingList();
  }

  document.addEventListener("DOMContentLoaded", setupPantryPage);
})();
