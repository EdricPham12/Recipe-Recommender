(function () {
  function setupSettingsPage() {
    setupAuth();
    updateUserUI();
    setupSettings();

    // navigation and logout behavior handled by login.js

  }

  document.addEventListener("DOMContentLoaded", setupSettingsPage);
})();
