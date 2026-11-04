(() => {
    const root = document.documentElement;
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const storageKey = "user-color-scheme";
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const systemColor = () => systemTheme.matches ? "dark" : "light";
    let preference;

    try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "dark" || saved === "light") preference = saved;
    } catch {
        // The system theme remains available when storage is blocked.
    }

    function applyTheme() {
        const theme = preference ?? systemColor();
        root.dataset.theme = theme;
        themeColorMeta.setAttribute("content", getComputedStyle(root).getPropertyValue("--paper").trim());
    }

    applyTheme();

    document.addEventListener("DOMContentLoaded", () => {
        const button = document.querySelector("[data-theme-toggle]");

        function updateButton() {
            const isDark = root.dataset.theme === "dark";
            button.setAttribute("aria-pressed", String(isDark));
            button.setAttribute("aria-label", isDark ? "切換淺色模式" : "切換深色模式");
        }

        button.addEventListener("click", () => {
            const next = root.dataset.theme === "dark" ? "light" : "dark";
            preference = next === systemColor() ? undefined : next;
            applyTheme();
            updateButton();
            try {
                if (preference) localStorage.setItem(storageKey, preference);
                else localStorage.removeItem(storageKey);
            } catch {
                // Keep the selected theme for this page.
            }
        });

        systemTheme.addEventListener("change", () => {
            applyTheme();
            updateButton();
        });
        updateButton();
    });
})();
