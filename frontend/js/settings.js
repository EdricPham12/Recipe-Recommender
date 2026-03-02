(function () {
  "use strict";

  const LS = {
    recipeCount: "cookai.recipeCount",
    user: "cookai.user",
    reviewNote: "cookai.reviewNote",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function loadRecipeCount() {
    const raw = localStorage.getItem(LS.recipeCount);
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) return 3;
    return Math.max(1, val);
  }

  function saveRecipeCount(value) {
    const val = Number(value);
    if (!Number.isFinite(val)) return;
    localStorage.setItem(LS.recipeCount, String(Math.max(1, val)));
  }

  function getSetting(key, fallback = "") {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  }

  function setSetting(key, value) {
    localStorage.setItem(key, String(value ?? ""));
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

    const profileName = $("profileName");
    if (profileName) profileName.value = user?.name || "";
    const profileEmail = $("profileEmail");
    if (profileEmail) profileEmail.value = user?.email || "";

    const btnLogout = $("btnFakeLogout");
    if (btnLogout) btnLogout.textContent = user ? "Đăng xuất" : "Đăng nhập";
  }

  function performLogout() {
    clearUser();
    updateUserUI();
    window.location.href = "login.html";
  }

  function setupSettingsPage() {
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

    const recipeCount = $("recipeCount");
    if (recipeCount) {
      recipeCount.value = String(loadRecipeCount());
      recipeCount.addEventListener("change", () => saveRecipeCount(recipeCount.value));
    }

    const reviewNote = $("reviewNote");
    if (reviewNote) {
      reviewNote.value = getSetting(LS.reviewNote, "");
      reviewNote.addEventListener("input", () => setSetting(LS.reviewNote, reviewNote.value));
    }
  }

  document.addEventListener("DOMContentLoaded", setupSettingsPage);
})();
