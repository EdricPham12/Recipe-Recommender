// Review / feedback helpers for SmartCook frontend
// Requires global helpers: $, escapeHtml, getSessionId, getApiBase,
// loadUser, loadHistory, saveHistory, renderReviewSelect (history.js)
// Functions are invoked from app.js/index.js when the corresponding
// pages load. Ensure this script is included before app.js (and before
// history.js since history.js also calls renderReviewSelect). 

function saveFeedback(entry) {
  try {
    const items = JSON.parse(localStorage.getItem(LS.feedback) || "[]");
    items.unshift(entry);
    localStorage.setItem(LS.feedback, JSON.stringify(items.slice(0, 30)));
  } catch {
    localStorage.setItem(LS.feedback, JSON.stringify([entry]));
  }
}

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(LS.feedback) || "[]");
  } catch {
    return [];
  }
}

function renderFeedbackList() {
  const host = $("reviewsList");
  if (!host) return;
  const items = loadFeedback();
  if (!items.length) {
    host.innerHTML = `<div class="empty">Chua co danh gia nao.</div>`;
    return;
  }
  host.innerHTML = items
    .map((it) => {
      const stars = "*****".slice(0, Math.max(1, Number(it.rating || 0)));
      const when = it.createdAt ? new Date(it.createdAt).toLocaleString() : "";
      return `
        <div class="review-card">
          <div class="review-head">
            <div>
              <div class="review-title">${escapeHtml(it.recipe_title || "Mon an")}</div>
              <div class="review-meta">${escapeHtml(it.user_name || "Khach")} · ${escapeHtml(when)}</div>
            </div>
            <div class="review-stars">${stars}</div>
          </div>
          <div class="review-body">${escapeHtml(it.comment || "Khong co nhan xet.")}</div>
        </div>
      `;
    })
    .join("");
}

function renderReviewSelect() {
  const select = $("reviewDishSelect");
  if (!select) return;
  const items = loadHistory();
  const ratingDish = $("ratingDish");
  const customWrap = $("customDishWrap");

  if (!items.length) {
    select.innerHTML = `<option value="__custom__">Nhap ten mon</option>`;
    select.value = "__custom__";
    select.disabled = true;
    if (ratingDish) ratingDish.value = "";
    if (customWrap) customWrap.classList.remove("hidden");
    return;
  }

  select.disabled = false;
  select.innerHTML =
    items
      .map(
        (it) =>
          `<option value="${escapeHtml(it.title || "Mon goi y")}">${escapeHtml(it.title || "Mon goi y")}</option>`,
      )
      .join("") + `<option value="__custom__">Khac (tu nhap)</option>`;

  if (ratingDish) ratingDish.value = "";
  if (customWrap) customWrap.classList.add("hidden");
  select.onchange = () => {
    const isCustom = select.value === "__custom__";
    if (customWrap) customWrap.classList.toggle("hidden", !isCustom);
    if (ratingDish && !isCustom) ratingDish.value = "";
  };
}

function resetRatingUI() {
  currentRating = 0;
  const starWrap = $("ratingStars");
  if (starWrap) {
    starWrap.querySelectorAll("button").forEach((btn) => btn.classList.remove("active"));
  }
  const ratingText = $("ratingText");
  if (ratingText) ratingText.value = "";
  const status = $("ratingStatus");
  if (status) status.textContent = "";
}

function setRating(value) {
  currentRating = value;
  const starWrap = $("ratingStars");
  if (!starWrap) return;
  starWrap.querySelectorAll("button").forEach((btn) => {
    const v = Number(btn.getAttribute("data-rate"));
    if (v <= value) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

async function sendFeedback() {
  const ratingText = $("ratingText")?.value || "";
  const selectVal = $("reviewDishSelect")?.value?.trim();
  const customDish = $("ratingDish")?.value?.trim();
  if (!currentRating) {
    alert("Ban hay chon so sao truoc khi gui.");
    return;
  }
  const title = selectVal && selectVal !== "__custom__" ? selectVal : customDish || lastResult?.title;
  if (!title) {
    alert("Ban hay nhap ten mon hoac chon mon da goi y.");
    return;
  }
  const user = loadUser();
  const payload = {
    session_id: getSessionId(),
    generation_id: lastGenerationId || Date.now(),
    rating: currentRating,
    comment: ratingText,
    recipe_title: title,
    user_name: user?.name || "Khach",
  };

  const status = $("ratingStatus");
  if (status) status.textContent = "Dang gui...";

  try {
    const resp = await fetch(`${getApiBase()}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (status) status.textContent = "Da gui danh gia. Cam on ban!";
    saveFeedback({ ...payload, createdAt: Date.now() });
  } catch (e) {
    saveFeedback({ ...payload, createdAt: Date.now() });
    if (status) status.textContent = "Da luu danh gia.";
  }
  renderFeedbackList();
}
