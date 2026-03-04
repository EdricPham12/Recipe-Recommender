const LS = {
  user: "cookai.user",
  users: "cookai.users",
  rememberLogin: "cookai.rememberLogin",
};

const $ = (id) => document.getElementById(id);

function setStatus(el, text, type) {
  if (!el) return;
  el.classList.remove("good", "bad", "warn");
  if (type) el.classList.add(type);
  el.textContent = text || "";
}

function isValidEmail(email) {
  return /.+@.+\..+/.test(email);
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS.users) || "[]");
  } catch {
    return [];
  }
}

function saveUser(user) {
  localStorage.setItem(LS.user, JSON.stringify(user));
}

function prefillRememberedLogin() {
  const raw = localStorage.getItem(LS.rememberLogin);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    const loginId = $("loginId");
    if (loginId && data?.loginId) loginId.value = data.loginId;
    const remember = $("rememberLogin");
    if (remember) remember.checked = true;
  } catch {
    // ignore
  }
}

function bindLoginForm() {
  const form = $("loginForm");
  if (!form) return;
  const status = $("authMessage");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const loginId = $("loginId")?.value?.trim() || "";
    const pass = $("loginPassword")?.value || "";
    const remember = $("rememberLogin")?.checked;

    if (!loginId || !pass) {
      setStatus(status, "Vui lòng nhập đầy đủ thông tin.", "warn");
      return;
    }
    const users = loadUsers();
    const match = users.find(
      (u) => (u.email === loginId || u.username === loginId) && u.password === pass,
    );
    if (!match) {
      setStatus(status, "Sai tên đăng nhập/email hoặc mật khẩu.", "bad");
      return;
    }

    saveUser({ name: match.name, email: match.email, username: match.username || "", avatar: match.avatar || "" });
    if (remember) localStorage.setItem(LS.rememberLogin, JSON.stringify({ loginId }));
    else localStorage.removeItem(LS.rememberLogin);

    setStatus(status, "Đăng nhập thành công. Đang chuyển hướng...", "good");
    setTimeout(() => (window.location.href = "home.html"), 500);
  });
}

function bindHoldToShowPassword() {
  document.querySelectorAll("[data-eye]").forEach((btn) => {
    const inputId = btn.getAttribute("data-eye");
    const input = inputId ? $(inputId) : null;
    if (!input) return;

    const show = () => (input.type = "text");
    const hide = () => (input.type = "password");

    btn.addEventListener("mousedown", show);
    btn.addEventListener("mouseup", hide);
    btn.addEventListener("mouseleave", hide);
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      show();
    });
    btn.addEventListener("touchend", hide);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  prefillRememberedLogin();
  bindLoginForm();
  bindHoldToShowPassword();
});
