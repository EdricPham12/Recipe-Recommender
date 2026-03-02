(function () {
  function setupPantryPage() {
    setupAuth();
    updateUserUI();
    setupSettings();

    // login.js manages nav links and logout interactions

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

    $("ingredientsText")?.addEventListener("input", () => updateShoppingList(lastResult));
    $("pantryText")?.addEventListener("input", () => updateShoppingList(lastResult));

    updateShoppingList(lastResult);
  }

  document.addEventListener("DOMContentLoaded", setupPantryPage);
})();
