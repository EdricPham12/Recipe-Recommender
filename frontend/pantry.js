(function () {
  function setupPantryPage() {
    setupAuth();
    updateUserUI();
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
