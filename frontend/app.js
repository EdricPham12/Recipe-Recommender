/* Cook-AI frontend (no build tools) */
console.log("APP JS LOADED OK");
const API_BASE_DEFAULT = "http://127.0.0.1:8000";
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

let lastResult = null;
let lastIngredientsInput = [];
let lastConstraints = null;
let activeResults = [];
let timerInterval = null;
let remainingSeconds = 0;
let currentRating = 0;
let lastGenerationId = null;
const PANTRY_KEYWORDS = [
  "muoi",
  "duong",
  "hat nem",
  "bot ngot",
  "bot canh",
  "tieu",
  "ot",
  "sa te",
  "dau",
  "nuoc mam",
  "nuoc tuong",
  "xi dau",
  "dau hao",
  "giam",
  "chanh",
  "mat ong",
  "bot mi",
  "bot bap",
  "ngu vi",
  "bo",
  "sot",
  "hanh",
  "toi",
  "gung",
  "sa",
];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeIngredients(text) {
  const raw = (text || "")
    .replace(/\r/g, "")
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toKey(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPantryItem(name) {
  const key = toKey(name);
  return PANTRY_KEYWORDS.some((kw) => key.includes(kw));
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionId() {
  let id = localStorage.getItem(LS.sessionId);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(LS.sessionId, id);
  }
  return id;
}

function getApiBase() {
  return API_BASE_DEFAULT;
}

function setStatus(text, kind) {
  const el = $("ocrStatus");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("good", "warn", "bad");
  if (kind) el.classList.add(kind);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS.history) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 20)));
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(LS.favorites) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(items) {
  localStorage.setItem(LS.favorites, JSON.stringify(items.slice(0, 50)));
}

function loadPantryText() {
  return localStorage.getItem(LS.pantry) || "";
}

function savePantryText(text) {
  localStorage.setItem(LS.pantry, text || "");
}

function loadRecipeCount() {
  const raw = localStorage.getItem(LS.recipeCount);
  const val = Number(raw);
  if (!Number.isFinite(val) || val <= 0) return 3;
  return Math.min(6, Math.max(1, val));
}

function saveRecipeCount(value) {
  const val = Number(value);
  if (!Number.isFinite(val)) return;
  localStorage.setItem(LS.recipeCount, String(Math.min(6, Math.max(1, val))));
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

function renderHistory() {
  const host = $("history");
  if (!host) return;
  const items = loadHistory();
  if (!items.length) {
    host.innerHTML = `<div class="empty">Chua co lich su.</div>`;
    return;
  }
  host.innerHTML = items
    .map((it, idx) => {
      const when = new Date(it.createdAt).toLocaleString();
      const ing = (it.ingredients || []).slice(0, 6).join(", ");
      return `
        <div class="history-item">
          <div class="title">${escapeHtml(it.title || "Mon goi y")}</div>
          <div class="sub">${escapeHtml(when)} · ${escapeHtml(ing)}${(it.ingredients || []).length > 6 ? "…" : ""}</div>
          <div class="row">
            <button class="btn btn-ghost" data-action="restore" data-idx="${idx}">Mo lai</button>
            <button class="btn btn-ghost" data-action="delete" data-idx="${idx}">Xoa</button>
          </div>
        </div>
      `;
    })
    .join("");

  host.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const action = btn.getAttribute("data-action");
      const items2 = loadHistory();
      const it = items2[idx];
      if (!it) return;
      if (action === "delete") {
        items2.splice(idx, 1);
        saveHistory(items2);
        renderHistory();
        renderReviewSelect();
        return;
      }
      if (action === "restore") {
        localStorage.setItem(LS.restore, JSON.stringify(it));
        window.location.href = "index.html";
      }
    });
  });
}

function renderFavorites() {
  const host = $("favorites");
  if (!host) return;
  const items = loadFavorites();
  if (!items.length) {
    host.innerHTML = `<div class="empty">Chua co mon yeu thich.</div>`;
    return;
  }
  host.innerHTML = items
    .map((it, idx) => {
      const when = new Date(it.createdAt).toLocaleString();
      const ingredients = Array.isArray(it.ingredients)
        ? it.ingredients
        : normalizeIngredients(String(it.ingredients || ""));
      return `
        <div class="history-item">
          <div class="title">${escapeHtml(it.title || "Mon goi y")}</div>
          <div class="sub">${escapeHtml(when)} · ${escapeHtml(ingredients.join(", "))}</div>
          <div class="row">
            <button class="btn btn-ghost" data-fav-action="load" data-idx="${idx}">Xem chi tiet</button>
            <button class="btn btn-ghost" data-fav-action="delete" data-idx="${idx}">Bo thich</button>
          </div>
        </div>
      `;
    })
    .join("");

  host.querySelectorAll("button[data-fav-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const action = btn.getAttribute("data-fav-action");
      const items2 = loadFavorites();
      const it = items2[idx];
      if (!it) return;
      if (action === "delete") {
        items2.splice(idx, 1);
        saveFavorites(items2);
        renderFavorites();
        return;
      }
      if (action === "load") {
        localStorage.setItem(LS.restore, JSON.stringify(it));
        window.location.href = "index.html";
      }
    });
  });
}

function getRecipeCount() {
  const main = $("recipeCountMain");
  const raw = main ? Number(main.value) : loadRecipeCount();
  if (!Number.isFinite(raw) || raw <= 0) return loadRecipeCount();
  return Math.min(6, Math.max(1, raw));
}

function getConstraints() {
  const equipments = Array.from(document.querySelectorAll(".equip"))
    .filter((x) => x.checked)
    .map((x) => x.value);

  const allergiesRaw = $("allergies")?.value || "";
  const allergies = allergiesRaw
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    cuisine: $("cuisine")?.value || null,
    diet: $("diet")?.value || null,
    allergies,
    servings: Number($("servings")?.value || 2),
    time_limit_min: Number($("timeLimit")?.value || 30),
    spicy_level: $("spicyLevel")?.value || null,
    difficulty: $("difficulty")?.value || null,
    budget_level: $("budget")?.value || null,
    calorie_limit: Number($("calorieLimit")?.value || 0) || null,
    recipe_count: getRecipeCount(),
    equipment: equipments,
    notes: $("notes")?.value || "",
  };
}

function formatMinutes(min) {
  if (!Number.isFinite(min)) return "";
  return `${min}p`;
}

function recipeMetaLine(result) {
  const parts = [];
  if (result?.time?.prep_min != null || result?.time?.cook_min != null) {
    const prep = result?.time?.prep_min != null ? `So che ${formatMinutes(result.time.prep_min)}` : null;
    const cook = result?.time?.cook_min != null ? `Nau ${formatMinutes(result.time.cook_min)}` : null;
    parts.push([prep, cook].filter(Boolean).join(" · "));
  }
  if (result?.servings) parts.push(`${result.servings} phan`);
  return parts.filter(Boolean).join(" · ");
}

function labelDifficulty(value) {
  const mapping = { easy: "De", medium: "Vua", hard: "Kho" };
  return mapping[value] || value;
}

function labelBudget(value) {
  const mapping = { low: "Tiet kiem", medium: "Vua", high: "Thoai mai" };
  return mapping[value] || value;
}

function buildTags(result) {
  const tags = [];
  if (result?.difficulty) tags.push(labelDifficulty(result.difficulty));
  if (result?.budget_level) tags.push(labelBudget(result.budget_level));
  if (result?.calories) tags.push(`${result.calories} kcal`);
  return tags;
}

function setActiveResults(results) {
  activeResults = Array.isArray(results) ? results : [];
  renderResultList(activeResults);
}

function renderResultList(results) {
  const host = $("resultList");
  if (!host) return;
  if (!results.length) {
    host.innerHTML = `<div class="empty">Chua co goi y nao.</div>`;
    return;
  }
  host.innerHTML = results
    .map((item, idx) => {
      const tags = buildTags(item)
        .map((t) => `<span class="tag">${escapeHtml(String(t))}</span>`)
        .join("");
      return `
        <div class="recipe-card ${idx === 0 ? "active" : ""}" data-recipe-idx="${idx}">
          <div class="title">${escapeHtml(item.title || "Mon goi y")}</div>
          <div class="meta">${escapeHtml(recipeMetaLine(item) || "Thoi gian linh hoat")}</div>
          <div class="recipe-tags">${tags}</div>
          <button class="btn btn-ghost" type="button" data-recipe-open="${idx}">Xem chi tiet</button>
        </div>
      `;
    })
    .join("");

  host.querySelectorAll("[data-recipe-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-recipe-open"));
      const recipe = results[idx];
      if (!recipe) return;
      showResult(recipe);
      host.querySelectorAll(".recipe-card").forEach((card) => card.classList.remove("active"));
      const card = host.querySelector(`[data-recipe-idx="${idx}"]`);
      if (card) card.classList.add("active");
    });
  });
}

function getAvailableItems() {
  const ingText = $("ingredientsText")?.value || "";
  const pantryText = $("pantryText")?.value || "";
  return normalizeIngredients([ingText, pantryText].join(", ")).map((x) => x.toLowerCase());
}

function isAvailableIngredient(name, available) {
  const key = name.toLowerCase();
  return available.some((item) => item === key || key.includes(item) || item.includes(key));
}

function updateShoppingList(result) {
  const missingHost = $("missingList");
  const haveHost = $("haveList");
  if (!missingHost || !haveHost) return;
  missingHost.innerHTML = "";
  haveHost.innerHTML = "";

  const available = getAvailableItems();
  const sourceList = result?.ingredients
    ? result.ingredients
    : normalizeIngredients($("ingredientsText")?.value || "");
  if (!sourceList.length) {
    missingHost.innerHTML = `<li>Chua co du lieu.</li>`;
    haveHost.innerHTML = `<li>Chua co du lieu.</li>`;
    return;
  }

  const missing = [];
  const have = [];
  sourceList.forEach((it) => {
    const name = typeof it === "string" ? it : it.name || "";
    if (!name) return;
    if (isAvailableIngredient(name, available)) {
      have.push(name);
    } else {
      missing.push(name);
    }
  });

  if (!missing.length) {
    const li = document.createElement("li");
    li.textContent = "Ban da co du nguyen lieu!";
    missingHost.appendChild(li);
  } else {
    missing.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      missingHost.appendChild(li);
    });
  }

  if (!have.length) {
    const li = document.createElement("li");
    li.textContent = "Chua xac dinh.";
    haveHost.appendChild(li);
  } else {
    have.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      haveHost.appendChild(li);
    });
  }
}

function extractOCRLines(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return lines
    .map((l) =>
      l
        .replace(/^\d+[\.\)]\s*/g, "")
        .replace(/\b(\d+([.,]\d+)?)\s*(g|kg|ml|l|muong|thia|tbsp|tsp|cup)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter((l) => l.length >= 2 && l.length <= 40);
}

function classifyOCR() {
  const text = $("ocrText")?.value || "";
  const list = normalizeIngredients(extractOCRLines(text).join(", "));
  if (!list.length) {
    alert("Chua tach duoc nguyen lieu tu OCR. Ban co the copy/paste vao o nhap tay.");
    return;
  }
  const pantry = [];
  const ingredients = [];
  list.forEach((item) => {
    if (isPantryItem(item)) pantry.push(item);
    else ingredients.push(item);
  });

  const ingEl = $("ingredientsText");
  if (ingEl) ingEl.value = ingredients.join(", ");
  const pantryEl = $("pantryText");
  if (pantryEl) pantryEl.value = pantry.join(", ");
  updateShoppingList(lastResult);
}

function showResult(result) {
  lastResult = result;
  $("resultEmpty")?.classList.add("hidden");
  $("result")?.classList.remove("hidden");
  if (!activeResults.length && result) {
    setActiveResults([result]);
  }
  if (result?.generation_id) lastGenerationId = result.generation_id;

  const titleEl = $("resultTitle");
  if (titleEl) titleEl.textContent = result?.title || "Goi y mon an";

  const metaEl = $("resultMeta");
  if (metaEl) metaEl.textContent = recipeMetaLine(result);

  const ingHost = $("resultIngredients");
  if (ingHost) {
    ingHost.innerHTML = "";
    (result?.ingredients || []).forEach((it) => {
      const li = document.createElement("li");
      if (typeof it === "string") {
        li.textContent = it;
      } else {
        li.textContent = it.qty ? `${it.name} - ${it.qty}` : it.name;
      }
      ingHost.appendChild(li);
    });
  }

  const stepsHost = $("resultSteps");
  if (stepsHost) {
    stepsHost.innerHTML = "";
    (result?.steps || []).forEach((st) => {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", updateStepsProgress);
      const span = document.createElement("span");
      span.textContent = st;
      label.appendChild(checkbox);
      label.appendChild(span);
      li.appendChild(label);
      stepsHost.appendChild(li);
    });
  }

  const tipsHost = $("resultTips");
  if (tipsHost) {
    tipsHost.innerHTML = "";
    const tips = result?.tips || [];
    if (!tips.length) {
      const li = document.createElement("li");
      li.textContent = "Co the nem nem lai theo khau vi, uu tien an toan thuc pham.";
      tipsHost.appendChild(li);
    } else {
      tips.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        tipsHost.appendChild(li);
      });
    }
  }

  updateStepsProgress();
  setTimerFromResult(result);
  updateShoppingList(result);
}

function updateStepsProgress() {
  const stepsHost = $("resultSteps");
  const progressEl = $("stepsProgress");
  if (!stepsHost || !progressEl) return;
  const checks = Array.from(stepsHost.querySelectorAll("input[type='checkbox']"));
  const done = checks.filter((c) => c.checked).length;
  progressEl.textContent = `${done}/${checks.length} buoc`;
}

function setTimerFromResult(result) {
  const input = $("timerMinutes");
  if (!input) return;
  const total =
    (result?.time?.prep_min || 0) + (result?.time?.cook_min || 0) || Number(input.value || 15);
  input.value = String(Math.max(1, total));
  remainingSeconds = total * 60;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const display = $("timerDisplay");
  if (!display) return;
  const min = Math.floor(remainingSeconds / 60);
  const sec = remainingSeconds % 60;
  display.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) return;
  if (!remainingSeconds) {
    const input = $("timerMinutes");
    const mins = Number(input?.value || 0);
    remainingSeconds = Math.max(1, mins) * 60;
  }
  timerInterval = setInterval(() => {
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      pauseTimer();
      alert("Het gio! Ban kiem tra mon nhe.");
    }
  }, 1000);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  pauseTimer();
  const input = $("timerMinutes");
  const mins = Number(input?.value || 15);
  remainingSeconds = Math.max(1, mins) * 60;
  updateTimerDisplay();
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

function pushHistory(entry) {
  const items = loadHistory();
  items.unshift(entry);
  saveHistory(items);
  renderHistory();
}

function demoGenerate(ingredients, constraints, variantIndex = 0) {
  const styles = ["Xao", "Canh", "Chien", "Nuong", "Salad", "Sup"];
  const main = ingredients[0] || "rau cu";
  const style = styles[variantIndex % styles.length];
  const hasEgg = ingredients.some((item) => {
    const val = item.toLowerCase();
    return val.includes("trung");
  });

  const title = hasEgg && style === "Chien" ? "Trung chien rau cu nhanh" : `${style} ${main}`;
  const difficulty = constraints.difficulty
    ? labelDifficulty(constraints.difficulty)
    : variantIndex % 3 === 0
      ? "De"
      : variantIndex % 3 === 1
        ? "Vua"
        : "Kho";
  const budget = constraints.budget_level
    ? labelBudget(constraints.budget_level)
    : variantIndex % 3 === 0
      ? "Tiet kiem"
      : variantIndex % 3 === 1
        ? "Vua"
        : "Thoai mai";
  const calories = constraints.calorie_limit
    ? Math.min(constraints.calorie_limit, 750)
    : 350 + variantIndex * 80;

  return {
    title,
    servings: constraints.servings || 2,
    time: { prep_min: 8 + variantIndex * 2, cook_min: Math.min(25, constraints.time_limit_min || 20) },
    ingredients: ingredients.slice(0, 10).map((name) => ({ name, qty: "" })),
    steps: [
      "Rua sach va so che nguyen lieu (cat vua an).",
      "Lam nong chao voi it dau, phi thom hanh/toi neu co.",
      "Cho nguyen lieu lau chin vao truoc, dao 2-3 phut.",
      "Nem muoi/nuoc mam/tieu vua an, dao deu.",
      "Hoan thien, tat bep, don nong.",
    ],
    tips: [
      "Neu co trung: danh trung voi chut muoi roi chien hoac dao cung rau.",
      "Neu it thoi gian: uu tien mon xao/canh nhanh.",
    ],
    difficulty,
    budget_level: budget,
    calories,
  };
}

function demoGenerateMultiple(ingredients, constraints, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(demoGenerate(ingredients, constraints, i));
  }
  return out;
}

const SETTINGS = {
  theme: "cookai.theme",
  lang: "cookai.lang",
  teamName: "cookai.teamName",
  reviewNote: "cookai.reviewNote",
};

function getSetting(key, fallback = "") {
  const raw = localStorage.getItem(key);
  return raw == null ? fallback : raw;
}

function setSetting(key, value) {
  localStorage.setItem(key, String(value ?? ""));
}

function updateUserUI() {
  const user = loadUser();
  const navName = document.querySelector(".sidebar-user-name");
  if (navName) navName.textContent = user?.name || "Dang nhap";

  const profileName = $("profileName");
  if (profileName) profileName.value = user?.name || "";
  const profileEmail = $("profileEmail");
  if (profileEmail) profileEmail.value = user?.email || "";

  const btnLogout = $("btnFakeLogout");
  if (btnLogout) btnLogout.textContent = user ? "Dang xuat" : "Dang nhap";
}


function applyRestore() {
  const raw = localStorage.getItem(LS.restore);
  if (!raw) return;
  localStorage.removeItem(LS.restore);
  try {
    const data = JSON.parse(raw);
    if (data?.result) showResult(data.result);
    const ingEl = $("ingredientsText");
    if (ingEl && Array.isArray(data?.ingredients)) ingEl.value = data.ingredients.join(", ");
  } catch {
    // ignore bad restore payload
  }
}
function saveFavorite() {
  if (!lastResult) {
    alert("Chua co mon nao de luu.");
    return;
  }
  const items = loadFavorites();
  items.unshift({
    createdAt: Date.now(),
    title: lastResult.title || "Mon goi y",
    ingredients: Array.isArray(lastIngredientsInput) ? [...lastIngredientsInput] : [],
    result: lastResult,
  });
  saveFavorites(items);
  renderFavorites();
  alert("Da luu mon yeu thich.");
}

function shuffleSuggestions() {
  if (activeResults.length > 1) {
    activeResults = [...activeResults].sort(() => Math.random() - 0.5);
    renderResultList(activeResults);
    showResult(activeResults[0]);
    return;
  }
  if (lastIngredientsInput.length) {
    generateRecipe({ useLast: true, addHistory: false });
    return;
  }
  alert("Chua co du lieu de goi y.");
}

async function generateRecipe(options = {}) {
  const { useLast = false, addHistory = true } = options;
  const ingEl = $("ingredientsText");
  const raw = useLast ? lastIngredientsInput.join(", ") : ingEl?.value || "";
  const ingredients = useLast ? lastIngredientsInput.slice() : normalizeIngredients(raw);

  if (!ingredients.length) {
    alert("Ban hay nhap nguyen lieu truoc.");
    return;
  }
  if (!useLast) lastIngredientsInput = ingredients;

  const constraints = useLast && lastConstraints ? lastConstraints : getConstraints();
  lastConstraints = constraints;
  if (constraints?.recipe_count) saveRecipeCount(constraints.recipe_count);

  const btn = $("btnGenerate");
  const btnShuffle = $("btnShuffle");
  if (btn) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent || "Goi y mon ngay";
    btn.textContent = "Dang tao...";
  }
  if (btnShuffle) btnShuffle.disabled = true;

    let results = [];
  try {
    const payload = {
      session_id: getSessionId(),
      source: "manual",
      ingredients,
      constraints,
    };
    const resp = await fetch(`${getApiBase()}/api/suggest-recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data?.results)) results = data.results;
    else if (data?.result) results = [data.result];
  } catch (err) {
    results = [];
  }

  if (!results.length) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || "Goi y mon ngay";
      delete btn.dataset.label;
    }
    if (btnShuffle) btnShuffle.disabled = false;
    alert("Khong the ket noi AI. Hay kiem tra backend va API key.");
    return;
  }
  const genBase = Date.now();
  results.forEach((item, idx) => {
    if (!item.generation_id) item.generation_id = genBase + idx;
  });

  setActiveResults(results);
  if (!results.length) {
    $("result")?.classList.add("hidden");
    $("resultEmpty")?.classList.remove("hidden");
  } else {
    showResult(results[0]);
    if (addHistory) {
      pushHistory({
        createdAt: Date.now(),
        title: results[0].title || "Mon goi y",
        ingredients,
        result: results[0],
      });
      renderReviewSelect();
    }
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || "Goi y mon ngay";
    delete btn.dataset.label;
  }
  if (btnShuffle) btnShuffle.disabled = false;
}

async function runOCR() {
  const input = $("imageInput");
  if (!input || !input.files || !input.files.length) {
    alert("Ban hay chon anh truoc.");
    return;
  }
  if (!window.Tesseract) {
    alert("OCR chua san sang.");
    return;
  }

  const file = input.files[0];
  setStatus("Dang OCR...", "warn");

  try {
    const result = await window.Tesseract.recognize(file, "vie+eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const pct = Math.round((m.progress || 0) * 100);
          setStatus(`OCR ${pct}%`, "warn");
        }
      },
    });
    const text = result?.data?.text || "";
    const ocrEl = $("ocrText");
    if (ocrEl) ocrEl.value = text.trim();
    setStatus(text.trim() ? "OCR xong." : "Khong nhan duoc van ban.", text.trim() ? "good" : "warn");
  } catch (err) {
    setStatus("OCR loi. Thu lai voi anh ro hon.", "bad");
  }
}

function extractIngredientsFromOCR() {
  const text = $("ocrText")?.value || "";
  const list = normalizeIngredients(extractOCRLines(text).join(", "));
  if (!list.length) {
    alert("Chua co du lieu OCR.");
    return;
  }
  const ingEl = $("ingredientsText");
  if (ingEl) ingEl.value = list.join(", ");
  updateShoppingList(lastResult);
}

function clearAll() {
  const inputIds = ["ingredientsText", "allergies", "notes", "calorieLimit", "pantryText", "ocrText"];
  inputIds.forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });

  const selects = ["diet", "cuisine", "spicyLevel", "difficulty", "budget"];
  selects.forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });

  document.querySelectorAll(".equip").forEach((el) => {
    el.checked = false;
  });

  const timeInput = $("timeLimit");
  if (timeInput) timeInput.value = "30";
  const servInput = $("servings");
  if (servInput) servInput.value = "2";
  const countInput = $("recipeCountMain");
  if (countInput) countInput.value = String(loadRecipeCount());

  lastResult = null;
  lastIngredientsInput = [];
  lastConstraints = null;
  lastGenerationId = null;
  activeResults = [];

  renderResultList([]);
  $("result")?.classList.add("hidden");
  $("resultEmpty")?.classList.remove("hidden");
  updateShoppingList(null);
  resetTimer();
}

function setActivePill(btn) {
  const group = btn.closest(".pill-group");
  if (!group) return;
  group.querySelectorAll(".pill").forEach((pill) => pill.classList.remove("pill-active"));
  btn.classList.add("pill-active");
}

function bindPills() {
  document.querySelectorAll("[data-time]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePill(btn);
      const value = Number(btn.getAttribute("data-time"));
      const input = $("timeLimit");
      if (input && Number.isFinite(value)) input.value = String(value);
    });
  });

  document.querySelectorAll("[data-serv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePill(btn);
      const value = Number(btn.getAttribute("data-serv"));
      const input = $("servings");
      if (input && Number.isFinite(value)) input.value = String(value);
    });
  });

  document.querySelectorAll("[data-diet]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePill(btn);
      const value = btn.getAttribute("data-diet");
      const input = $("diet");
      if (input && value != null) input.value = value;
    });
  });

  document.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePill(btn);
      const theme = btn.getAttribute("data-theme") || "light";
      setSetting(SETTINGS.theme, theme);
    });
  });
}

function bindQuickChips() {
  const host = $("quickChips");
  const input = $("ingredientsText");
  if (!host || !input) return;
  host.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-add");
      if (!value) return;
      const current = normalizeIngredients(input.value);
      const exists = current.some((item) => item.toLowerCase() === value.toLowerCase());
      if (!exists) current.push(value);
      input.value = current.join(", ");
    });
  });
}

function performLogout() {
  clearUser();
  updateUserUI();
  if (window.location.pathname.endsWith("settings.html")) {
    window.location.href = "login.html";
  }
}

function setupAuth() {
  const page = document.body?.dataset?.page;
  if (!page) return;

  if (page === "login") {
    const form = $("loginForm");
    if (!form) return;
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

  if (page === "register") {
    const form = $("registerForm");
    if (!form) return;
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

function setupSettings() {
  const theme = getSetting(SETTINGS.theme, "light");
  document.querySelectorAll("[data-theme]").forEach((btn) => {
    if (btn.getAttribute("data-theme") === theme) setActivePill(btn);
  });

  const langSelect = $("langSelect");
  if (langSelect) {
    langSelect.value = getSetting(SETTINGS.lang, langSelect.value || "vi");
    langSelect.addEventListener("change", () => setSetting(SETTINGS.lang, langSelect.value));
  }

  const teamName = $("teamName");
  if (teamName) {
    teamName.value = getSetting(SETTINGS.teamName, "");
    teamName.addEventListener("input", () => setSetting(SETTINGS.teamName, teamName.value));
  }

  const reviewNote = $("reviewNote");
  if (reviewNote) {
    reviewNote.value = getSetting(SETTINGS.reviewNote, "");
    reviewNote.addEventListener("input", () => setSetting(SETTINGS.reviewNote, reviewNote.value));
  }

  const recipeCount = $("recipeCount");
  if (recipeCount) {
    recipeCount.value = String(loadRecipeCount());
    recipeCount.addEventListener("change", () => saveRecipeCount(recipeCount.value));
  }

  const recipeCountMain = $("recipeCountMain");
  if (recipeCountMain) recipeCountMain.value = String(loadRecipeCount());
}

document.addEventListener("DOMContentLoaded", () => {
  updateUserUI();
  if ($("favorites")) renderFavorites();
});















