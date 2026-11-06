/*!
 * canaria.js v1 - shared behaviour for canaria.cc sites
 * https://canaria.cc/canaria.js
 *
 * Load synchronously in <head>, after canaria.css and the site's main.css, so the theme is set
 * before the first paint. Every feature switches itself on only when its markup is present:
 *
 *   theme          always sets <html data-theme>; wires every [data-theme-toggle] button.
 *                  Optional labels: data-label-to-dark / data-label-to-light on the button.
 *   page language  <html data-langs="zh-Hant zh-Hans ja en"> picks a language from ?lang=,
 *                  the saved choice or the browser, and sets <html lang> before the first paint.
 *                  The choice is saved under <html data-lang-storage> (default "lang").
 *   language menu  every [data-lang-switch] that has no `hidden` attribute when the page loads.
 *                  data-lang-scope="page" (default) switches the page language and saves it under
 *                  the page's key above; "content" only reports the choice to the site's own code
 *                  and saves it under the menu's data-lang-storage (default "content-lang").
 *                  Menus with the same scope and key stay in sync. data-lang-label sets the
 *                  button's accessible name; each option needs data-lang and data-short.
 *   translations   Canaria.i18n.define(dictionaries) fills [data-i18n], [data-i18n-html] and
 *                  [data-i18n-aria]; the default language's text stays in the HTML. After adding
 *                  such elements (with default-language text), call Canaria.i18n.apply().
 *   reveal         every [data-reveal] in the page fades in the first time it scrolls into view.
 *                  Skipped (content simply shows) without IntersectionObserver or with reduced
 *                  motion. Call Canaria.reveal(element) for [data-reveal] elements added later.
 *
 * Events on document: canaria:themechange { theme }, canaria:langchange { lang, scope, initial }.
 */
(() => {
    const root = document.documentElement;

    const storage = {
        get(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
        }
    };

    const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
    const onReady = (fn) => {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    };

    /* ---------- Strings used when the site has no dictionary ---------- */
    const BUILT_IN = {
        'zh-Hant': { langLabel: '語言', themeToDark: '切換深色模式', themeToLight: '切換淺色模式' },
        'zh-Hans': { langLabel: '语言', themeToDark: '切换深色模式', themeToLight: '切换浅色模式' },
        ja: { langLabel: '言語', themeToDark: 'ダークモードに切り替え', themeToLight: 'ライトモードに切り替え' },
        en: { langLabel: 'Language', themeToDark: 'Switch to dark mode', themeToLight: 'Switch to light mode' }
    };

    const LANGUAGE_MAP = {
        'zh-hant': 'zh-Hant', 'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant', 'zh-mo': 'zh-Hant',
        'zh-hans': 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 'zh-my': 'zh-Hans',
        ja: 'ja', en: 'en'
    };

    function normalizeLanguage(value) {
        const tag = String(value || '').toLowerCase().replace(/_/g, '-');
        if (LANGUAGE_MAP[tag]) return LANGUAGE_MAP[tag];
        if (tag.startsWith('zh-hant')) return 'zh-Hant';
        if (tag.startsWith('zh-hans')) return 'zh-Hans';
        if (tag.startsWith('zh-') || tag === 'zh') return /(^|-)(cn|sg|my)(-|$)/.test(tag) ? 'zh-Hans' : 'zh-Hant';
        if (tag.startsWith('ja-')) return 'ja';
        if (tag.startsWith('en-')) return 'en';
        return null;
    }

    function builtIn(key) {
        const lang = normalizeLanguage(root.lang) || 'zh-Hant';
        return (BUILT_IN[lang] || BUILT_IN['zh-Hant'])[key];
    }

    /* ---------- Page language (only with <html data-langs>) ---------- */
    // Read at load and written by page-scope menus, so a saved choice survives a reload.
    const PAGE_LANG_KEY = root.dataset.langStorage || 'lang';
    const CONTENT_LANG_KEY = 'content-lang';
    const pageLangs = (root.dataset.langs || '').split(/\s+/).filter(Boolean);

    function detectPageLang() {
        const pick = (value) => {
            const lang = normalizeLanguage(value);
            return pageLangs.includes(lang) ? lang : null;
        };
        let lang = null;
        try { lang = pick(new URLSearchParams(location.search).get('lang')); } catch { /* ignore */ }
        if (!lang) lang = pick(storage.get(PAGE_LANG_KEY));
        if (!lang) {
            const preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
            for (const value of preferred) {
                lang = pick(value);
                if (lang) break;
            }
            if (!lang) lang = preferred.some(Boolean) && pageLangs.includes('en') ? 'en' : pageLangs[0];
        }
        return lang;
    }

    /* ---------- Translations ---------- */
    const i18n = {
        lang: null,
        defaultLang: pageLangs[0] || root.lang || 'zh-Hant',
        dictionaries: {},
        defined: false
    };
    if (pageLangs.length) {
        i18n.lang = detectPageLang();
        root.setAttribute('lang', i18n.lang);
    }

    function lookup(key, lang = i18n.lang) {
        for (const candidate of [lang, i18n.defaultLang]) {
            const dict = i18n.dictionaries[candidate];
            if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
        }
        return undefined;
    }
    const text = (key) => {
        const value = lookup(key);
        return typeof value === 'string' ? value : undefined;
    };

    // Default-language content, recorded the first time each element is translated, so elements
    // added after define() can still switch back. A WeakMap lets removed elements be collected.
    const originals = new WeakMap();
    const READ = {
        text: (el) => el.textContent,
        html: (el) => el.innerHTML,
        aria: (el) => el.getAttribute('aria-label')
    };
    function original(el, kind) {
        let entry = originals.get(el);
        if (!entry) {
            entry = {};
            originals.set(el, entry);
        }
        if (!(kind in entry)) entry[kind] = READ[kind](el);
        return entry[kind];
    }

    function applyTranslations() {
        if (!i18n.defined) return;
        const isDefault = i18n.lang === i18n.defaultLang;
        const translated = (key) => {
            if (isDefault) return undefined;
            const value = lookup(key, i18n.lang);
            return typeof value === 'string' ? value : undefined;
        };
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const fallback = original(el, 'text');
            el.textContent = translated(el.dataset.i18n) ?? fallback;
        });
        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const fallback = original(el, 'html');
            el.innerHTML = translated(el.dataset.i18nHtml) ?? fallback;
        });
        document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
            // Record the original first, even when a translation exists (e.g. the page opens in English).
            const fallback = original(el, 'aria');
            const value = translated(el.dataset.i18nAria) ?? fallback;
            if (value === null) el.removeAttribute('aria-label');
            else el.setAttribute('aria-label', value);
        });
    }

    function setPageLang(lang) {
        i18n.lang = lang;
        root.setAttribute('lang', lang);
        applyTranslations();
        updateThemeToggles();
    }

    /* ---------- Theme ---------- */
    const THEME_KEY = 'theme';
    const LEGACY_THEME_KEYS = ['user-color-scheme'];
    const isTheme = (value) => value === 'light' || value === 'dark';
    const systemDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    const systemTheme = () => (systemDark && systemDark.matches ? 'dark' : 'light');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    let themePreference = storage.get(THEME_KEY);
    if (!isTheme(themePreference)) {
        themePreference = null;
        for (const key of LEGACY_THEME_KEYS) {
            const legacy = storage.get(key);
            if (legacy === null) continue;
            if (isTheme(legacy) && !themePreference) {
                themePreference = legacy;
                storage.set(THEME_KEY, legacy);
            }
            storage.remove(key);
        }
    }

    function applyTheme() {
        const theme = themePreference || systemTheme();
        root.setAttribute('data-theme', theme);
        if (themeColorMeta) {
            const background = getComputedStyle(root).getPropertyValue('--ui-bg').trim();
            if (background) themeColorMeta.setAttribute('content', background);
        }
        updateThemeToggles();
        return theme;
    }

    function updateThemeToggles() {
        const isDark = root.getAttribute('data-theme') === 'dark';
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.setAttribute('aria-pressed', String(isDark));
            const key = isDark ? 'themeToLight' : 'themeToDark';
            const own = isDark ? button.dataset.labelToLight : button.dataset.labelToDark;
            const label = text(key) ?? own ?? builtIn(key);
            if (label) button.setAttribute('aria-label', label);
        });
    }

    // `null` follows the system again. Choosing the system's own theme also clears the preference,
    // so the page keeps following the system after the visitor switches back.
    function setTheme(theme) {
        const before = root.getAttribute('data-theme');
        themePreference = isTheme(theme) && theme !== systemTheme() ? theme : null;
        if (themePreference) storage.set(THEME_KEY, themePreference);
        else storage.remove(THEME_KEY);
        const after = applyTheme();
        if (after !== before) emit('canaria:themechange', { theme: after });
    }

    applyTheme();

    if (systemDark) {
        const followSystem = () => {
            const before = root.getAttribute('data-theme');
            const after = applyTheme();
            if (after !== before) emit('canaria:themechange', { theme: after });
        };
        if (systemDark.addEventListener) systemDark.addEventListener('change', followSystem);
        else if (systemDark.addListener) systemDark.addListener(followSystem);
    }

    /* ---------- Language menus: a disclosure button plus a short list of buttons ---------- */
    // Menus that share a scope and storage key form one group with one current language.
    const langGroups = new Map();

    function renderLangSwitches() {
        langGroups.forEach((group) => group.views.forEach((view) => view.render()));
    }

    function selectLang(group, lang) {
        group.lang = lang;
        storage.set(group.storageKey, lang);
        if (group.scope === 'page') setPageLang(lang);
        renderLangSwitches();
        emit('canaria:langchange', { lang, scope: group.scope, initial: false });
    }

    function initLangSwitch(langSwitch) {
        if (langSwitch.hidden) return;
        const trigger = langSwitch.querySelector('.lang-trigger');
        const current = langSwitch.querySelector('.lang-current');
        const options = Array.from(langSwitch.querySelectorAll('[data-lang]'));
        if (!trigger || !options.length) return;

        const scope = langSwitch.dataset.langScope === 'content' ? 'content' : 'page';
        if (scope === 'page' && langSwitch.dataset.langStorage && langSwitch.dataset.langStorage !== PAGE_LANG_KEY) {
            console.warn('canaria.js: page-scope language menus save under <html data-lang-storage>; the menu\'s data-lang-storage is ignored.');
        }
        const storageKey = scope === 'page' ? PAGE_LANG_KEY : (langSwitch.dataset.langStorage || CONTENT_LANG_KEY);
        const id = scope + '\n' + storageKey;
        if (!langGroups.has(id)) langGroups.set(id, { scope, storageKey, lang: null, views: [] });
        const group = langGroups.get(id);

        group.views.push({
            has: (lang) => options.some((option) => option.dataset.lang === lang),
            fallback: () => (options.find((option) => option.getAttribute('aria-current') === 'true') || options[0]).dataset.lang,
            render() {
                const selected = options.find((option) => option.dataset.lang === group.lang);
                if (selected) {
                    const short = selected.dataset.short || selected.textContent.trim();
                    if (current) current.textContent = short;
                    const label = langSwitch.dataset.langLabel || text('langLabel') || builtIn('langLabel');
                    const separator = /^(zh|ja)/i.test(root.lang) ? '：' : ': ';
                    trigger.setAttribute('aria-label', label + separator + short);
                }
                options.forEach((option) => {
                    if (option === selected) option.setAttribute('aria-current', 'true');
                    else option.removeAttribute('aria-current');
                });
            }
        });

        const isOpen = () => langSwitch.classList.contains('is-open');

        function open(focusTarget) {
            langSwitch.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            const selected = options.find((option) => option.dataset.lang === group.lang) || options[0];
            const target = focusTarget === 'last' ? options[options.length - 1] : selected;
            // Wait a frame so the menu is visible (focusable) before moving focus.
            requestAnimationFrame(() => target && target.focus());
        }

        function close(returnFocus) {
            if (!isOpen()) return;
            langSwitch.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            if (returnFocus) trigger.focus();
        }

        trigger.addEventListener('click', () => {
            if (isOpen()) close(false);
            else open();
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                open(event.key === 'ArrowUp' ? 'last' : undefined);
            }
        });
        options.forEach((option, index) => {
            option.addEventListener('click', () => {
                selectLang(group, option.dataset.lang);
                close(true);
            });
            option.addEventListener('keydown', (event) => {
                let next = null;
                if (event.key === 'ArrowDown') next = options[(index + 1) % options.length];
                else if (event.key === 'ArrowUp') next = options[(index - 1 + options.length) % options.length];
                else if (event.key === 'Home') next = options[0];
                else if (event.key === 'End') next = options[options.length - 1];
                if (next) {
                    event.preventDefault();
                    next.focus();
                }
            });
        });
        langSwitch.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isOpen()) {
                event.preventDefault();
                close(true);
            }
        });
        // Close when keyboard focus moves elsewhere. Pointer clicks outside are handled below
        // (relatedTarget is null for those, e.g. Safari doesn't focus buttons on click).
        langSwitch.addEventListener('focusout', (event) => {
            if (event.relatedTarget && !langSwitch.contains(event.relatedTarget)) close(false);
        });
        document.addEventListener('click', (event) => {
            if (!langSwitch.contains(event.target)) close(false);
        });
    }

    function initLangSwitches() {
        document.querySelectorAll('[data-lang-switch]').forEach(initLangSwitch);
        langGroups.forEach((group) => {
            const first = group.views[0];
            let lang = group.scope === 'page' ? i18n.lang : storage.get(group.storageKey);
            if (!first.has(lang)) lang = first.fallback();
            group.lang = lang;
            if (group.scope === 'page' && lang !== i18n.lang) setPageLang(lang);
        });
        renderLangSwitches();
        langGroups.forEach((group) => emit('canaria:langchange', { lang: group.lang, scope: group.scope, initial: true }));
    }

    /* ---------- Reveal on scroll ---------- */
    // The class goes on <html> before the first paint, so [data-reveal] content never flashes in
    // and then hides. Without it (no observer, reduced motion) canaria.css leaves the content shown.
    const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealObserver = 'IntersectionObserver' in window && !reducedMotion
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12 })
        : null;
    if (revealObserver) root.classList.add('ui-reveal-ready');

    function reveal(element) {
        if (!element) return;
        if (revealObserver) revealObserver.observe(element);
        else element.classList.add('is-visible');
    }

    /* ---------- Wire up controls once the page is parsed ---------- */
    onReady(() => {
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.addEventListener('click', () => {
                setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
            });
        });
        updateThemeToggles();
        initLangSwitches();
        document.querySelectorAll('[data-reveal]').forEach(reveal);
    });

    window.Canaria = {
        version: '1',
        storage,
        reveal,
        theme: {
            get: () => root.getAttribute('data-theme'),
            set: setTheme,
            toggle: () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
        },
        i18n: {
            get lang() { return i18n.lang; },
            // Register dictionaries keyed by language; values may be strings or functions.
            define(dictionaries, options = {}) {
                i18n.dictionaries = dictionaries || {};
                if (options.defaultLang) i18n.defaultLang = options.defaultLang;
                i18n.defined = true;
                onReady(() => {
                    applyTranslations();
                    updateThemeToggles();
                    renderLangSwitches();
                });
            },
            // Translate elements added after define(); they should hold default-language text.
            apply: () => applyTranslations(),
            t: (key) => lookup(key)
        }
    };
})();
