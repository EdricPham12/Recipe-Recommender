(function () {
  "use strict";

  const API_BASE_DEFAULT = "http://127.0.0.1:8000";
  const LS = {
    sessionId: "cookai.sessionId",
    history: "cookai.history",
    favorites: "cookai.favorites",
    pantry: "cookai.pantry",
    recipeCount: "cookai.recipeCount",
    user: "cookai.user",
    restore: "cookai.restore",
  };

  let lastResult = null;
  let lastIngredientsInput = [];
  let lastConstraints = null;
  let activeResults = [];
  let timerInterval = null;
  let remainingSeconds = 0;
  let lastGenerationId = null;

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

  function loadPantryText() {
    return localStorage.getItem(LS.pantry) || "";
  }

  function savePantryText(text) {
    localStorage.setItem(LS.pantry, text || "");
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

  function updateUserUI() {
    const user = loadUser();
    const navName = document.querySelector(".sidebar-user-name");
    if (navName) navName.textContent = user?.name || "Đăng nhập";
  }

  function toKey(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatMinutes(min) {
    if (!Number.isFinite(min)) return "";
    return `${min}p`;
  }

  function recipeMetaLine(result) {
    const parts = [];
    if (result?.time?.prep_min != null || result?.time?.cook_min != null) {
      const prep = result?.time?.prep_min != null ? `Sơ chế ${formatMinutes(result.time.prep_min)}` : null;
      const cook = result?.time?.cook_min != null ? `Nấu ${formatMinutes(result.time.cook_min)}` : null;
      parts.push([prep, cook].filter(Boolean).join(" · "));
    }
    if (result?.servings) parts.push(`${result.servings} phần`);
    return parts.filter(Boolean).join(" · ");
  }

  function labelDifficulty(value) {
    const mapping = { easy: "Dễ", medium: "Vừa", hard: "Khó" };
    return mapping[value] || value;
  }

  function labelBudget(value) {
    const mapping = { low: "Tiết kiệm", medium: "Vừa", high: "Thoải mái" };
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
      host.innerHTML = `<div class="empty">Chưa có gợi ý nào.</div>`;
      return;
    }
    host.innerHTML = results
      .map((item, idx) => {
        const tags = buildTags(item)
          .map((t) => `<span class="tag">${escapeHtml(String(t))}</span>`)
          .join("");
        return `
          <div class="recipe-card ${idx === 0 ? "active" : ""}" data-recipe-idx="${idx}">
            <div class="title">${escapeHtml(item.title || "Món gợi ý")}</div>
            <div class="meta">${escapeHtml(recipeMetaLine(item) || "Thời gian linh hoạt")}</div>
            <div class="recipe-tags">${tags}</div>
            <button class="btn btn-ghost" type="button" data-recipe-open="${idx}"><span class="icon">🔎</span>Xem chi tiết</button>
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

  function getRecipeCount() {
    const main = $("recipeCountMain");
    const raw = main ? Number(main.value) : loadRecipeCount();
    if (!Number.isFinite(raw) || raw <= 0) return loadRecipeCount();
    return Math.max(1, raw);
  }

  function renderList(el, items, emptyText) {
    if (!el) return;
    el.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = emptyText;
      el.appendChild(li);
      return;
    }
    items.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      el.appendChild(li);
    });
  }

  function renderRecipePantryStatus(result) {
    const haveEl = $("recipeHaveList");
    const missingEl = $("recipeMissingList");
    if (!haveEl || !missingEl) return;

    const pantryItems = normalizeIngredients(loadPantryText());
    if (!result || !Array.isArray(result.ingredients) || !result.ingredients.length) {
      renderList(haveEl, [], "Chưa có dữ liệu.");
      renderList(missingEl, [], "Chưa có dữ liệu.");
      return;
    }

    const pantryKeys = pantryItems.map((x) => toKey(x));
    const have = [];
    const missing = [];

    result.ingredients.forEach((it) => {
      const name = typeof it === "string" ? it : it.name || "";
      if (!name) return;
      const key = toKey(name);
      const matched = pantryKeys.some((p) => p === key || p.includes(key) || key.includes(p));
      if (matched) have.push(name);
      else missing.push(name);
    });

    renderList(haveEl, have, "Chưa có dữ liệu.");
    renderList(missingEl, missing, "Bạn đã có đủ nguyên liệu.");
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

  function showResult(result) {
    lastResult = result;
    $("suggestionsShell")?.classList.remove("hidden");
    $("resultEmpty")?.classList.add("hidden");
    $("result")?.classList.remove("hidden");
    if (!activeResults.length && result) {
      setActiveResults([result]);
    }
    if (result?.generation_id) lastGenerationId = result.generation_id;

    const titleEl = $("resultTitle");
    if (titleEl) titleEl.textContent = result?.title || "Gợi ý món ăn";

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
        li.textContent = "Có thể nêm nếm lại theo khẩu vị, ưu tiên an toàn thực phẩm.";
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
    renderRecipePantryStatus(result);
  }

  function updateStepsProgress() {
    const stepsHost = $("resultSteps");
    const progressEl = $("stepsProgress");
    if (!stepsHost || !progressEl) return;
    const checks = Array.from(stepsHost.querySelectorAll("input[type='checkbox']"));
    const done = checks.filter((c) => c.checked).length;
    progressEl.textContent = `${done}/${checks.length} bước`;
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
        alert("Hết giờ! Bạn kiểm tra món nhé.");
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

  function pushHistory(entry) {
    const items = loadHistory();
    items.unshift(entry);
    saveHistory(items);
  }

  function saveFavorite() {
    if (!lastResult) {
      alert("Chưa có món nào để lưu.");
      return;
    }
    const items = loadFavorites();
    items.unshift({
      createdAt: Date.now(),
      title: lastResult.title || "Món gợi ý",
      ingredients: lastIngredientsInput,
      result: lastResult,
    });
    saveFavorites(items);
    alert("Đã lưu món yêu thích.");
  }

  function shuffleSuggestions() {
    if (activeResults.length > 1) {
      activeResults = [...activeResults].sort(() => Math.random() - 0.5);
      renderResultList(activeResults);
      $("result")?.classList.add("hidden");
      $("resultEmpty")?.classList.remove("hidden");
      return;
    }
    if (lastIngredientsInput.length) {
      generateRecipe({ useLast: true, addHistory: false });
      return;
    }
    alert("Chưa có dữ liệu để gợi ý.");
  }

  async function generateRecipe(options = {}) {
    const { useLast = false, addHistory = true } = options;
    const ingEl = $("ingredientsText");
    const raw = useLast ? lastIngredientsInput.join(", ") : ingEl?.value || "";
    const ingredients = useLast ? lastIngredientsInput.slice() : normalizeIngredients(raw);

    if (!ingredients.length) {
      alert("Bạn hãy nhập nguyên liệu trước.");
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
      btn.dataset.label = btn.textContent || "Gợi ý món ngay";
      btn.textContent = "Đang tạo...";
    }
    if (btnShuffle) btnShuffle.disabled = true;

    let results = [];
    try {
      const payload = {
        session_id: getSessionId(),
        source: "manual",
        ingredients,
        constraints,
        count: constraints?.recipe_count || undefined,
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
        btn.textContent = btn.dataset.label || "Gợi ý món ngay";
        delete btn.dataset.label;
      }
      if (btnShuffle) btnShuffle.disabled = false;
      alert("Không thể kết nối AI. Hãy kiểm tra backend và API key.");
      $("suggestionsShell")?.classList.add("hidden");
      return;
    }
    const genBase = Date.now();
    results.forEach((item, idx) => {
      if (!item.generation_id) item.generation_id = genBase + idx;
    });

    setActiveResults(results);
    $("suggestionsShell")?.classList.remove("hidden");
    $("result")?.classList.add("hidden");
    $("resultEmpty")?.classList.remove("hidden");

    if (addHistory) {
      pushHistory({
        createdAt: Date.now(),
        title: results[0].title || "Món gợi ý",
        ingredients,
        result: results[0],
      });
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || "Gợi ý món ngay";
      delete btn.dataset.label;
    }
    if (btnShuffle) btnShuffle.disabled = false;
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

  function clearAll() {
    const inputIds = ["ingredientsText", "allergies", "notes", "calorieLimit"];
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
    $("suggestionsShell")?.classList.add("hidden");
    resetTimer();
    renderRecipePantryStatus(null);
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
  }

  function setupIndexPage() {
    updateUserUI();
    bindPills();
    bindQuickChips();

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

    $("btnGenerate")?.addEventListener("click", () => generateRecipe());
    $("btnShuffle")?.addEventListener("click", shuffleSuggestions);
    $("btnClear")?.addEventListener("click", clearAll);
    $("btnSave")?.addEventListener("click", saveFavorite);

    $("btnTimerStart")?.addEventListener("click", startTimer);
    $("btnTimerPause")?.addEventListener("click", pauseTimer);
    $("btnTimerReset")?.addEventListener("click", resetTimer);

    const recipeCountMain = $("recipeCountMain");
    if (recipeCountMain) {
      recipeCountMain.value = String(loadRecipeCount());
      recipeCountMain.addEventListener("change", () => saveRecipeCount(recipeCountMain.value));
    }

    applyRestore();
    window.addEventListener("focus", () => renderRecipePantryStatus(lastResult));
  }

  document.addEventListener("DOMContentLoaded", setupIndexPage);
})();
