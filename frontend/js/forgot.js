const LS = {
  users: "cookai.users",
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

function saveUsers(items) {
  localStorage.setItem(LS.users, JSON.stringify(items));
}

function bindForgotForm() {
  const form = $("forgotForm");
  if (!form) return;
  const status = $("forgotStatus");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("forgotEmail")?.value?.trim() || "";
    const pass = $("forgotPassword")?.value || "";
    const confirm = $("forgotConfirm")?.value || "";

    if (!email || !pass || !confirm) {
      setStatus(status, "Vui lòng nhập đầy đủ thông tin.", "warn");
      return;
    }
    if (!isValidEmail(email)) {
      setStatus(status, "Email không đúng định dạng.", "bad");
      return;
    }
    if (pass.length < 6) {
      setStatus(status, "Mật khẩu tối thiểu 6 ký tự.", "bad");
      return;
    }
    if (pass !== confirm) {
      setStatus(status, "Mật khẩu xác nhận không khớp.", "bad");
      return;
    }

    const users = loadUsers();
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) {
      setStatus(status, "Email chưa đăng ký.", "bad");
      return;
    }

    users[idx].password = pass;
    saveUsers(users);
    setStatus(status, "Đã cập nhật mật khẩu. Bạn có thể đăng nhập lại.", "good");
  });
}

document.addEventListener("DOMContentLoaded", bindForgotForm);
