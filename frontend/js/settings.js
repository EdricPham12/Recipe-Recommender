(function () {
  "use strict";

  const LS = {
    recipeCount: "cookai.recipeCount",
    user: "cookai.user",
    reviewNote: "cookai.reviewNote",
    avatar: "cookai.avatar",
    theme: "cookai.themeColor",
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

  function saveUser(user) {
    localStorage.setItem(LS.user, JSON.stringify(user));
  }

  function clearUser() {
    localStorage.removeItem(LS.user);
  }

  function loadAvatar() {
    return localStorage.getItem(LS.avatar) || "";
  }

  function saveAvatar(url) {
    localStorage.setItem(LS.avatar, url || "");
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/g)
      .filter(Boolean);
    if (!parts.length) return "SC";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
    return (first + last).toUpperCase();
  }

  function applyAvatar(url, name) {
    const avatar = $("profileAvatar");
    const navAvatar = document.querySelector(".sidebar-user-avatar");
    const initials = getInitials(name);
    if (avatar) {
      if (url) {
        avatar.style.backgroundImage = `url(\"${url}\")`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.textContent = "";
      } else {
        avatar.style.backgroundImage = "";
        avatar.textContent = initials;
      }
    }
    if (navAvatar) {
      if (url) {
        navAvatar.style.backgroundImage = `url(\"${url}\")`;
        navAvatar.style.backgroundSize = "cover";
        navAvatar.style.backgroundPosition = "center";
      } else {
        navAvatar.style.backgroundImage = "";
      }
    }
  }

  function updateUserUI() {
    const user = loadUser();
    const navName = document.querySelector(".sidebar-user-name");
    if (navName) navName.textContent = user?.name || "Đăng nhập";

    const profileName = $("profileName");
    if (profileName) profileName.value = user?.name || "";
    const profileEmail = $("profileEmail");
    if (profileEmail) profileEmail.value = user?.email || "";

    const avatarUrl = $("avatarUrl");
    if (avatarUrl) avatarUrl.value = loadAvatar();
    applyAvatar(loadAvatar(), user?.name || "");

    const btnLogout = $("btnFakeLogout");
    if (btnLogout) btnLogout.textContent = user ? "Đăng xuất" : "Đăng nhập";
  }

  function performLogout() {
    clearUser();
    updateUserUI();
    window.location.href = "login.html";
  }

  function applyTheme(themeId) {
    const themes = {
      sunset: { primary: "#e4572e", accent: "#2a9d8f" },
      mint: { primary: "#2a9d8f", accent: "#76c7b7" },
      ocean: { primary: "#2b59c3", accent: "#00a896" },
      berry: { primary: "#b8336a", accent: "#6a4c93" },
    };
    const theme = themes[themeId] || themes.sunset;
    document.documentElement.style.setProperty("--primary", theme.primary);
    document.documentElement.style.setProperty("--accent", theme.accent);
    setSetting(LS.theme, themeId || "sunset");
    document.querySelectorAll(".theme-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-theme") === themeId);
    });
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

    const btnSaveProfile = $("btnSaveProfile");
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener("click", () => {
        const user = loadUser();
        if (!user) {
          alert("Bạn cần đăng nhập để lưu.");
          return;
        }
        const name = $("profileName")?.value?.trim() || user.name || "";
        const avatarUrl = $("avatarUrl")?.value?.trim() || "";
        saveUser({ ...user, name });
        saveAvatar(avatarUrl);
        updateUserUI();
        alert("Đã lưu thông tin.");
      });
    }

    const recipeCount = $("recipeCount");
    if (recipeCount) {
      recipeCount.value = String(loadRecipeCount());
      recipeCount.addEventListener("change", () => saveRecipeCount(recipeCount.value));
    }

    const savedTheme = getSetting(LS.theme, "sunset");
    applyTheme(savedTheme);
    document.querySelectorAll(".theme-pill").forEach((btn) => {
      btn.addEventListener("click", () => applyTheme(btn.getAttribute("data-theme")));
    });

    const reviewNote = $("reviewNote");
    if (reviewNote) {
      reviewNote.value = getSetting(LS.reviewNote, "");
      reviewNote.addEventListener("input", () => setSetting(LS.reviewNote, reviewNote.value));
    }
  }

  document.addEventListener("DOMContentLoaded", setupSettingsPage);
})();
