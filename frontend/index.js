(function () {
  function setupIndexPage() {
    setupAuth();
    updateUserUI();
    bindPills();
    bindQuickChips();
    setupSettings();

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

    $("btnRunOCR")?.addEventListener("click", runOCR);
    $("btnExtractIngredients")?.addEventListener("click", extractIngredientsFromOCR);
    $("btnClassifyOCR")?.addEventListener("click", classifyOCR);

    $("btnSavePantry")?.addEventListener("click", () => {
      savePantryText($("pantryText")?.value || "");
      updateShoppingList(lastResult);
      alert("Da luu tu lanh.");
    });

    $("btnUsePantry")?.addEventListener("click", () => {
      const ingEl = $("ingredientsText");
      const pantryEl = $("pantryText");
      if (!ingEl || !pantryEl) return;
      const combined = normalizeIngredients([ingEl.value, pantryEl.value].join(", "));
      ingEl.value = combined.join(", ");
      updateShoppingList(lastResult);
    });

    const pantryEl = $("pantryText");
    if (pantryEl) pantryEl.value = loadPantryText();

    const recipeCountMain = $("recipeCountMain");
    if (recipeCountMain) {
      recipeCountMain.addEventListener("change", () => saveRecipeCount(recipeCountMain.value));
    }

    document.querySelectorAll("#ratingStars [data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => setRating(Number(btn.getAttribute("data-rate")) || 0));
    });
    $("btnSendFeedback")?.addEventListener("click", sendFeedback);

    $("ingredientsText")?.addEventListener("input", () => updateShoppingList(lastResult));
    $("pantryText")?.addEventListener("input", () => updateShoppingList(lastResult));

    renderHistory();
    renderFavorites();
    renderFeedbackList();
    renderReviewSelect();
    applyRestore();
    updateShoppingList(lastResult);
  }

  document.addEventListener("DOMContentLoaded", setupIndexPage);
})();
