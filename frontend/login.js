// Authentication helpers for SmartCook frontend (formerly auth.js, now login.js)
// This module is intentionally lightweight and does not require any build tooling.

// shared localStorage keys (used across the app)
const LS = {
  sessionId: "cookai.sessionId",
  history: "cookai.history",
  favorites: "cookai.favorites",
  pantry: "cookai.pantry",
  recipeCount: "cookai.recipeCount",
  user: "cookai.user",
  users: "cookai.users",
  feedback: "cookai.feedback",
  restore: "cookai.restore",
};

/* user storage helpers */
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

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS.users) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(items) {
  localStorage.setItem(LS.users, JSON.stringify(items));
}

/* UI helpers */
function updateUserUI() {
  const user = loadUser();
  const navName = document.querySelector(".sidebar-user-name");
  if (navName) navName.textContent = user?.name || "Tài khoản"; // default label for guests

  const profileName = $("profileName");
  if (profileName) profileName.value = user?.name || "";
  const profileEmail = $("profileEmail");
  if (profileEmail) profileEmail.value = user?.email || "";

  const btnLogout = $("btnFakeLogout");
  if (btnLogout) btnLogout.textContent = user ? "Dang xuat" : "Dang nhap";
}

/* authentication logic */
function performLogout() {
  clearUser();
  updateUserUI();
  if (window.location.pathname.endsWith("settings.html")) {
    window.location.href = "login.html";
  }
}

function setupAuth() {
  // handle login / register form submissions if on those pages
  const page = document.body?.dataset?.page;
  if (page === "login") {
    const form = $("loginForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = $("loginEmail")?.value?.trim() || "";
        const pass = $("loginPassword")?.value || "";
        const users = loadUsers();
        const match = users.find((u) => u.email === email && u.password === pass);
        if (!match) {
          alert("Sai email hoac mat khau.");
          return;
        }
        saveUser({ name: match.name, email: match.email });
        window.location.href = "index.html";
      });
    }
  } else if (page === "register") {
    const form = $("registerForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("registerName")?.value?.trim() || "";
        const email = $("registerEmail")?.value?.trim() || "";
        const pass = $("registerPassword")?.value || "";
        const confirm = $("registerConfirm")?.value || "";
        if (!name || !email || !pass) {
          alert("Ban hay dien day du thong tin.");
          return;
        }
        if (pass !== confirm) {
          alert("Mat khau khong khop.");
          return;
        }
        const users = loadUsers();
        if (users.some((u) => u.email === email)) {
          alert("Email da ton tai.");
          return;
        }
        users.push({ name, email, password: pass });
        saveUsers(users);
        saveUser({ name, email });
        window.location.href = "index.html";
      });
    }
  }

  // attach navigation & logout handlers for all pages
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
}

// expose functions globally (they already naturally are since we don't use modules)
// but adding a comment to emphasize their availability.

