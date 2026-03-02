const LS = {
  history: "cookai.history",
  feedback: "cookai.feedback",
  user: "cookai.user",
};

const $ = (id) => document.getElementById(id);

const state = {
  filterStar: "all",
  search: "",
  sort: "new",
  selectedTags: new Set(),
};

let currentRating = 0;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(LS.user) || "null");
  } catch {
    return null;
  }
}

function updateUserUI() {
  const user = loadUser();
  const navName = document.querySelector(".sidebar-user-name");
  if (navName) navName.textContent = user?.name || "Tài khoản";
  const navAvatar = document.querySelector(".sidebar-user-avatar");
  if (navAvatar && user?.avatar) {
    navAvatar.style.backgroundImage = `url('${user.avatar}')`;
  }
}

function bindNav() {
  const navSettings = $("btnSettingsNav");
  if (navSettings) navSettings.addEventListener("click", () => (window.location.href = "settings.html"));
  const navProfile = $("btnProfileNav");
  if (navProfile)
    navProfile.addEventListener("click", () => {
      const user = loadUser();
      window.location.href = user ? "settings.html" : "login.html";
    });
}

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(LS.feedback) || "[]");
  } catch {
    return [];
  }
}

function saveFeedback(entry) {
  const items = loadFeedback();
  items.unshift(entry);
  localStorage.setItem(LS.feedback, JSON.stringify(items.slice(0, 50)));
}

function loadHistoryItems() {
  try {
    return JSON.parse(localStorage.getItem(LS.history) || "[]");
  } catch {
    return [];
  }
}

function renderReviewSelect() {
  const select = $("reviewDishSelect");
  if (!select) return;
  const items = loadHistoryItems();
  const ratingDish = $("ratingDish");
  const customWrap = $("customDishWrap");

  if (!items.length) {
    select.innerHTML = `<option value="__custom__">Nhập tên món</option>`;
    select.value = "__custom__";
    select.disabled = true;
    if (ratingDish) ratingDish.value = "";
    if (customWrap) customWrap.classList.remove("hidden");
    return;
  }

  select.disabled = false;
  select.innerHTML =
    items
      .map((it) => {
        const title = it.title || "Món gợi ý";
        return `<option value="${escapeHtml(title)}">${escapeHtml(title)}</option>`;
      })
      .join("") + `<option value="__custom__">Khác (tự nhập)</option>`;

  if (ratingDish) ratingDish.value = "";
  if (customWrap) customWrap.classList.add("hidden");
  select.onchange = () => {
    const isCustom = select.value === "__custom__";
    if (customWrap) customWrap.classList.toggle("hidden", !isCustom);
    if (ratingDish && !isCustom) ratingDish.value = "";
  };
}

function setRating(value) {
  currentRating = value;
  const starWrap = $("ratingStars");
  if (!starWrap) return;
  starWrap.querySelectorAll("button").forEach((btn) => {
    const v = Number(btn.getAttribute("data-rate"));
    btn.classList.toggle("active", v <= value);
  });
  const status = $("ratingStatus");
  if (status) status.textContent = `Bạn đã chọn ${value} sao.`;
}

function resetRatingUI() {
  currentRating = 0;
  const starWrap = $("ratingStars");
  if (starWrap) starWrap.querySelectorAll("button").forEach((btn) => btn.classList.remove("active"));
  const ratingText = $("ratingText");
  if (ratingText) ratingText.value = "";
  const ratingDish = $("ratingDish");
  if (ratingDish) ratingDish.value = "";
  const status = $("ratingStatus");
  if (status) status.textContent = "";
  const tags = document.querySelectorAll(".tag-pill");
  tags.forEach((tag) => tag.classList.remove("active"));
  state.selectedTags.clear();
}

function bindTagPills() {
  const wrap = $("reviewTags");
  if (!wrap) return;
  wrap.querySelectorAll(".tag-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag");
      if (!tag) return;
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
      else state.selectedTags.add(tag);
      btn.classList.toggle("active");
    });
  });
}

function sendFeedback() {
  const ratingText = $("ratingText")?.value || "";
  const selectVal = $("reviewDishSelect")?.value?.trim();
  const customDish = $("ratingDish")?.value?.trim();
  const budget = $("reviewBudget")?.value || "";
  const difficulty = $("reviewDifficulty")?.value || "";
  const cookAgain = $("cookAgain")?.checked;

  if (!currentRating) {
    alert("Bạn hãy chọn số sao trước khi gửi.");
    return;
  }
  const title = selectVal && selectVal !== "__custom__" ? selectVal : customDish;
  if (!title) {
    alert("Bạn hãy nhập tên món hoặc chọn món đã gợi ý.");
    return;
  }

  const user = loadUser();
  const payload = {
    rating: currentRating,
    comment: ratingText,
    recipe_title: title,
    user_name: user?.name || "Khách",
    createdAt: Date.now(),
    tags: Array.from(state.selectedTags),
    budget,
    difficulty,
    cookAgain: Boolean(cookAgain),
  };

  saveFeedback(payload);
  renderFeedbackList();
  renderSummary();
  resetRatingUI();
  const status = $("ratingStatus");
  if (status) status.textContent = "Đã lưu đánh giá. Cảm ơn bạn!";
}

function renderSummary() {
  const items = loadFeedback();
  const avg = items.length ? items.reduce((s, it) => s + Number(it.rating || 0), 0) / items.length : 0;
  const avgEl = $("avgRating");
  const countEl = $("reviewCount");
  const hintEl = $("reviewHint");
  if (avgEl) avgEl.textContent = avg.toFixed(1);
  if (countEl) countEl.textContent = `${items.length} đánh giá`;
  if (hintEl) hintEl.textContent = items.length ? "Cảm ơn bạn đã phản hồi." : "Chưa có đánh giá nào.";

  const bars = $("ratingBars");
  if (!bars) return;
  const counts = [1, 2, 3, 4, 5].map((star) => items.filter((it) => Number(it.rating) === star).length);
  const max = Math.max(1, ...counts);
  bars.innerHTML = counts
    .map((count, idx) => {
      const star = idx + 1;
      const width = Math.round((count / max) * 100);
      return `
        <div class="rating-bar">
          <div>${star} sao</div>
          <div class="bar"><div class="bar-fill" style="width:${width}%"></div></div>
          <div>${count}</div>
        </div>
      `;
    })
    .reverse()
    .join("");
}

function applyFilters(items) {
  let filtered = items.slice();
  if (state.filterStar !== "all") {
    filtered = filtered.filter((it) => Number(it.rating) === Number(state.filterStar));
  }
  if (state.search) {
    const key = state.search.toLowerCase();
    filtered = filtered.filter((it) => String(it.recipe_title || "").toLowerCase().includes(key));
  }
  if (state.sort === "old") filtered = filtered.slice().reverse();
  if (state.sort === "high") filtered = filtered.slice().sort((a, b) => Number(b.rating) - Number(a.rating));
  if (state.sort === "low") filtered = filtered.slice().sort((a, b) => Number(a.rating) - Number(b.rating));
  return filtered;
}

function renderFeedbackList() {
  const host = $("reviewsList");
  if (!host) return;
  const items = applyFilters(loadFeedback());
  if (!items.length) {
    host.innerHTML = `<div class="empty">Chưa có đánh giá phù hợp.</div>`;
    return;
  }
  host.innerHTML = items
    .map((it) => {
      const stars = "★★★★★".slice(0, Math.max(1, Number(it.rating || 0)));
      const when = it.createdAt ? new Date(it.createdAt).toLocaleString("vi-VN") : "";
      const tags = (it.tags || []).map((tag) => `<span class="tag-pill active">${escapeHtml(tag)}</span>`).join("");
      return `
        <div class="review-card">
          <div class="review-head">
            <div>
              <div class="review-title">${escapeHtml(it.recipe_title || "Món ăn")}</div>
              <div class="review-meta">${escapeHtml(it.user_name || "Khách")} · ${escapeHtml(when)}</div>
            </div>
            <div class="review-stars">${stars}</div>
          </div>
          <div class="review-meta">${escapeHtml(it.budget || "")} ${it.difficulty ? "· " + escapeHtml(it.difficulty) : ""}</div>
          <div>${escapeHtml(it.comment || "Không có nhận xét.")}</div>
          <div class="review-tags">${tags}</div>
          <div class="review-meta">${it.cookAgain ? "Sẽ nấu lại" : "Chưa chắc"}</div>
        </div>
      `;
    })
    .join("");
}

function bindReviewForm() {
  const starWrap = $("ratingStars");
  if (starWrap) {
    starWrap.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => setRating(Number(btn.dataset.rate)));
    });
  }

  const sendBtn = $("btnSendFeedback");
  if (sendBtn) sendBtn.addEventListener("click", sendFeedback);

  const resetBtn = $("btnResetFeedback");
  if (resetBtn) resetBtn.addEventListener("click", resetRatingUI);
}

function bindFilters() {
  const search = $("reviewSearch");
  if (search) search.addEventListener("input", () => {
    state.search = search.value || "";
    renderFeedbackList();
  });
  const sort = $("reviewSort");
  if (sort) sort.addEventListener("change", () => {
    state.sort = sort.value;
    renderFeedbackList();
  });

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filterStar = btn.getAttribute("data-filter") || "all";
      renderFeedbackList();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateUserUI();
  bindNav();
  renderReviewSelect();
  renderSummary();
  renderFeedbackList();
  bindReviewForm();
  bindFilters();
  bindTagPills();
});

