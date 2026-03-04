const LS = {
  user: "cookai.user",
  apiBase: "smartcook_api_base",
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

function normalizePhone(raw) {
  return String(raw || "")
    .replace(/\s+/g, "")
    .replace(/[-.]/g, "");
}

function isValidPhone(phone) {
  if (!phone) return true;
  const compact = normalizePhone(phone);
  return /^(\+84|0)\d{8,10}$/.test(compact);
}

function passwordIssues(pass) {
  const issues = [];
  if (pass.length < 8) issues.push("ít nhất 8 ký tự");
  if (!/[A-Z]/.test(pass)) issues.push("chữ hoa");
  if (!/[a-z]/.test(pass)) issues.push("chữ thường");
  if (!/\d/.test(pass)) issues.push("số");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) issues.push("ký tự đặc biệt");
  return issues;
}

function saveUser(user) {
  localStorage.setItem(LS.user, JSON.stringify(user));
}

function getApiBase() {
  const saved = (localStorage.getItem(LS.apiBase) || "").trim();
  return (saved || "http://127.0.0.1:9000").replace(/\/+$/, "");
}

function bindRegisterForm() {
  const form = $("registerForm");
  if (!form) return;
  const status = $("authMessage");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("registerName")?.value?.trim() || "";
    const username = $("registerUsername")?.value?.trim() || "";
    const phoneRaw = $("registerPhone")?.value?.trim() || "";
    const email = $("registerEmail")?.value?.trim() || "";
    const pass = $("registerPassword")?.value || "";
    const confirm = $("registerConfirm")?.value || "";
    const agree = $("acceptTerms")?.checked;

    if (!name || !username || !email || !pass || !confirm) {
      setStatus(status, "Vui lòng nhập đầy đủ thông tin bắt buộc.", "warn");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) {
      setStatus(status, "Tên đăng nhập chỉ gồm chữ/số và 3-20 ký tự.", "bad");
      return;
    }
    if (!isValidEmail(email)) {
      setStatus(status, "Email không đúng định dạng.", "bad");
      return;
    }
    if (!isValidPhone(phoneRaw)) {
      setStatus(status, "Số điện thoại chưa đúng định dạng (VD: 09xx... hoặc +84...).", "bad");
      return;
    }
    const issues = passwordIssues(pass);
    if (issues.length) {
      setStatus(status, `Mật khẩu cần có ${issues.join(", ")}.`, "bad");
      return;
    }
    if (pass !== confirm) {
      setStatus(status, "Mật khẩu xác nhận không khớp.", "bad");
      return;
    }
    if (!agree) {
      setStatus(status, "Bạn cần đồng ý điều khoản để đăng ký.", "warn");
      return;
    }

    try {
      const resp = await fetch(`${getApiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          email,
          phone: normalizePhone(phoneRaw),
          password: pass,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(status, String(data?.detail || "Đăng ký thất bại."), "bad");
        return;
      }

      const user = data?.user || {};
      saveUser({
        id: user.id || null,
        name: user.name || name,
        username: user.username || username,
        email: user.email || email,
        phone: user.phone || normalizePhone(phoneRaw),
      });

      setStatus(status, "Đăng ký thành công. Đang chuyển hướng...", "good");
      setTimeout(() => (window.location.href = "index.html"), 600);
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
  bindRegisterForm();
  bindHoldToShowPassword();
});
