(function () {
  function setupIndexPage() {
    setupAuth();
    updateUserUI();
    bindPills();
    bindQuickChips();
    setupSettings();

    // UI navigation and logout are wired via login.js


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
