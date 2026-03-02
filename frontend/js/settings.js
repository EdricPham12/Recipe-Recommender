(function () {
  "use strict";

  const LS = {
    user: "cookai.user",
    users: "cookai.users",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.classList.remove("good", "bad", "warn");
    if (type) el.classList.add(type);
    el.textContent = text || "";
  }

  function isValidEmail(email) {
    return /.+@.+\..+/.test(email);
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

  function applyAvatar(user) {
    const avatar = $("profileAvatar");
    const navAvatar = document.querySelector(".sidebar-user-avatar");
    const initials = getInitials(user?.name || "");

    if (avatar) {
      if (user?.avatar) {
        avatar.style.backgroundImage = `url('${user.avatar}')`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.textContent = "";
      } else {
        avatar.style.backgroundImage = "";
        avatar.textContent = initials;
      }
    }

    if (navAvatar) {
      if (user?.avatar) {
        navAvatar.style.backgroundImage = `url('${user.avatar}')`;
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
    const profileUsername = $("profileUsername");
    if (profileUsername) profileUsername.value = user?.username || "";
    const profileEmail = $("profileEmail");
    if (profileEmail) profileEmail.value = user?.email || "";
    const profilePhone = $("profilePhone");
    if (profilePhone) profilePhone.value = user?.phone || "";

    applyAvatar(user);

    const btnLogout = $("btnFakeLogout");
    if (btnLogout) btnLogout.textContent = user ? "Đăng xuất" : "Đăng nhập";
  }

  function performLogout() {
    clearUser();
    updateUserUI();
    window.location.href = "login.html";
  }

  function updateUserInList(updated) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.email === updated.email || u.username === updated.username);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updated };
      saveUsers(users);
    }
  }

  function bindAvatarUpload() {
    const input = $("avatarFile");
    const removeBtn = $("btnRemoveAvatar");
    if (input) {
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const user = loadUser();
          if (!user) return;
          const avatar = String(reader.result || "");
          const updated = { ...user, avatar };
          saveUser(updated);
          updateUserInList(updated);
          updateUserUI();
        };
        reader.readAsDataURL(file);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const user = loadUser();
        if (!user) return;
        const updated = { ...user, avatar: "" };
        saveUser(updated);
        updateUserInList(updated);
        updateUserUI();
      });
    }
  }

  function bindProfileSave() {
    const btnSave = $("btnSaveProfile");
    const status = $("profileStatus");
    if (!btnSave) return;

    btnSave.addEventListener("click", () => {
      const user = loadUser();
      if (!user) {
        setStatus(status, "Bạn cần đăng nhập để lưu.", "warn");
        return;
      }

      const name = $("profileName")?.value?.trim() || "";
      const username = $("profileUsername")?.value?.trim() || "";
      const email = $("profileEmail")?.value?.trim() || "";
      const phone = $("profilePhone")?.value?.trim() || "";

      if (!name || !username || !email) {
        setStatus(status, "Vui lòng nhập đủ tên, username và email.", "warn");
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

      const users = loadUsers();
      const conflict = users.some((u) =>
        (u.email === email || u.username === username) && u.email !== user.email
      );
      if (conflict) {
        setStatus(status, "Email hoặc username đã tồn tại.", "bad");
        return;
      }

      const updated = { ...user, name, username, email, phone };
      saveUser(updated);
      updateUserInList(updated);
      updateUserUI();
      setStatus(status, "Đã lưu thông tin.", "good");
    });
  }

  function bindPasswordChange() {
    const btn = $("btnChangePassword");
    const status = $("passwordStatus");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const user = loadUser();
      if (!user) {
        setStatus(status, "Bạn cần đăng nhập để đổi mật khẩu.", "warn");
        return;
      }

      const current = $("currentPassword")?.value || "";
      const next = $("newPassword")?.value || "";
      const confirm = $("confirmPassword")?.value || "";

      if (!current || !next || !confirm) {
        setStatus(status, "Vui lòng nhập đầy đủ mật khẩu.", "warn");
        return;
      }
      if (next.length < 6) {
        setStatus(status, "Mật khẩu mới tối thiểu 6 ký tự.", "bad");
        return;
      }
      if (next !== confirm) {
        setStatus(status, "Mật khẩu xác nhận không khớp.", "bad");
        return;
      }

      const users = loadUsers();
      const idx = users.findIndex((u) => u.email === user.email || u.username === user.username);
      if (idx === -1) {
        setStatus(status, "Không tìm thấy tài khoản.", "bad");
        return;
      }
      if (users[idx].password !== current) {
        setStatus(status, "Mật khẩu hiện tại không đúng.", "bad");
        return;
      }

      users[idx].password = next;
      saveUsers(users);
      setStatus(status, "Đã đổi mật khẩu.", "good");
      $("currentPassword").value = "";
      $("newPassword").value = "";
      $("confirmPassword").value = "";
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

    bindAvatarUpload();
    bindProfileSave();
    bindPasswordChange();
  }

  document.addEventListener("DOMContentLoaded", setupSettingsPage);
})();
