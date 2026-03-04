const LS = {
  user: "cookai.user",
  rememberLogin: "cookai.rememberLogin",
  apiBase: "smartcook_api_base",
};

const $ = (id) => document.getElementById(id);

function setStatus(el, text, type) {
  if (!el) return;
  el.classList.remove("good", "bad", "warn");
  if (type) el.classList.add(type);
  el.textContent = text || "";
}

function saveUser(user) {
  localStorage.setItem(LS.user, JSON.stringify(user));
}

function getApiBase() {
  const saved = (localStorage.getItem(LS.apiBase) || "").trim();
  return (saved || "http://127.0.0.1:9000").replace(/\/+$/, "");
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginId = $("loginId")?.value?.trim() || "";
    const pass = $("loginPassword")?.value || "";
    const remember = $("rememberLogin")?.checked;

    if (!loginId || !pass) {
      setStatus(status, "Vui lòng nhập đầy đủ thông tin.", "warn");
      return;
    }

    try {
      const resp = await fetch(`${getApiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, password: pass }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(status, String(data?.detail || "Sai tên đăng nhập/email hoặc mật khẩu."), "bad");
        return;
      }

      const user = data?.user || {};
      saveUser({
        id: user.id || null,
        name: user.name || "",
        email: user.email || "",
        username: user.username || "",
        phone: user.phone || "",
      });
      if (remember) localStorage.setItem(LS.rememberLogin, JSON.stringify({ loginId }));
      else localStorage.removeItem(LS.rememberLogin);

      setStatus(status, "Đăng nhập thành công. Đang chuyển hướng...", "good");
      setTimeout(() => (window.location.href = "index.html"), 500);
    } catch {
      setStatus(status, "Không kết nối được server. Kiểm tra backend đang chạy.", "bad");
    }
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
