const tracks = [
    { videoId: videoID1, lyrics: { "zh-Hant": lyricZH1, ja: lyric1 } }
];

const lyricViewport = document.querySelector(".bg");
const lyricList = document.createElement("ul");
lyricViewport.append(lyricList);

const langSwitch = document.querySelector('[data-lang-switch]');
const langTrigger = langSwitch.querySelector('.lang-trigger');
const langCurrent = langSwitch.querySelector('.lang-current');
const langOptions = Array.from(langSwitch.querySelectorAll('[data-lang]'));
const LANG_SHORT = { 'zh-Hant': '繁中', ja: '日本語' };
const videoFallback = document.querySelector(".video-fallback");
const videoPoster = document.createElement("img");
videoPoster.className = "video-poster";
videoPoster.alt = "";
videoFallback.prepend(videoPoster);

let player;
let currentTrack;
let currentLang = "zh-Hant";
try {
    if (localStorage.getItem("lyric-language") === "ja") currentLang = "ja";
} catch { /* storage unavailable */ }
let lyrics = [];
let activeLine = -1;
let activeTop = 0; // Last scroll target; resizes re-align only when the layout moves it.

function parseLyrics(source) {
    const lines = [];
    for (const line of source.split("\n")) {
        const cues = [...line.matchAll(/\[(\d{2}):(\d{2})[.:](\d{2})\]/g)];
        const content = line.replace(/\[\d{2}:\d{2}[.:]\d{2}\]/g, "").trim();
        for (const [, minutes, seconds, hundredths] of cues) {
            lines.push({
                time: Number(minutes) * 60 + Number(seconds) + Number(hundredths) / 100,
                content
            });
        }
    }
    return lines.sort((a, b) => a.time - b.time);
}

function renderLyrics(time = 0) {
    lyrics = parseLyrics(currentTrack.lyrics[currentLang]);
    lyricList.lang = currentLang;
    const items = lyrics.map(({ content }) => {
        const item = document.createElement("li");
        item.textContent = content;
        return item;
    });
    lyricList.replaceChildren(...items);
    activeLine = -1;
    scrollToActiveLine("instant");
    syncLyrics(time, "instant");
}

function getActiveTop() {
    const current = lyricList.children[activeLine];
    if (!current) return 0;
    // Center the active cue on the anchor slot, where the list's top padding places the first cue.
    // Centering (not bottom-aligning) keeps wrapped cues from hiding the previous line.
    const anchorTop = parseFloat(getComputedStyle(lyricList).paddingTop) || 0;
    const cueHeight = parseFloat(getComputedStyle(current).minHeight) || 0;
    return current.offsetTop - anchorTop + (current.offsetHeight - cueHeight) / 2;
}

function scrollToActiveLine(behavior) {
    activeTop = getActiveTop();
    lyricViewport.scrollTo({ top: activeTop, behavior });
}

function syncLyrics(time, behavior = "auto") {
    if (!Number.isFinite(time)) return;

    let nextLine = lyrics.length - 1;
    while (nextLine >= 0 && lyrics[nextLine].time > time) {
        nextLine--;
    }
    if (nextLine === activeLine) return;

    const previous = lyricList.children[activeLine];
    previous?.classList.remove("active");
    previous?.removeAttribute("aria-current");
    activeLine = nextLine;

    const current = lyricList.children[activeLine];
    current?.classList.add("active");
    current?.setAttribute("aria-current", "true");
    scrollToActiveLine(behavior);
}

// syncLyrics only scrolls when the cue changes, so re-align when the layout moves the active cue
// (e.g. lines above it re-wrap), even while paused. Comparing with the last target leaves the
// smooth scroll of a cue change alone.
function realignActiveLine() {
    if (Math.abs(getActiveTop() - activeTop) >= 1) scrollToActiveLine("instant");
}

const lyricResizeObserver = new ResizeObserver(realignActiveLine);
lyricResizeObserver.observe(lyricViewport);
lyricResizeObserver.observe(lyricList);
// A font swap can re-wrap lines while the list keeps the same total height, which the observer misses.
document.fonts.addEventListener("loadingdone", realignActiveLine);

function selectTrack() {
    currentTrack = tracks[Math.floor(Math.random() * tracks.length)];
    const { videoId } = currentTrack;
    videoFallback.href = `https://www.youtube.com/watch?v=${videoId}`;
    const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    if (videoPoster.src !== posterUrl) {
        videoPoster.hidden = true;
        videoPoster.src = posterUrl;
    }
}

videoPoster.addEventListener("load", () => {
    videoPoster.hidden = false;
});

function applyLang(lang) {
    currentLang = lang;
    langCurrent.textContent = LANG_SHORT[currentLang];
    langTrigger.setAttribute('aria-label', '歌詞語言：' + LANG_SHORT[currentLang]);
    langOptions.forEach((option) => {
        if (option.dataset.lang === currentLang) option.setAttribute('aria-current', 'true');
        else option.removeAttribute('aria-current');
    });
    renderLyrics(player?.getCurrentTime?.() ?? 0);
}

/* Language popover: a disclosure button plus a short list of buttons. */
function isLangMenuOpen() {
    return langSwitch && langSwitch.classList.contains('is-open');
}

function openLangMenu(focusTarget) {
    if (!langSwitch) return;
    langSwitch.classList.add('is-open');
    langTrigger.setAttribute('aria-expanded', 'true');
    const current = langOptions.find((option) => option.dataset.lang === currentLang) || langOptions[0];
    const target = focusTarget === 'last' ? langOptions[langOptions.length - 1] : current;
    // Wait a frame so the menu is visible (focusable) before moving focus.
    window.requestAnimationFrame(() => target && target.focus());
}

function closeLangMenu(returnFocus) {
    if (!isLangMenuOpen()) return;
    langSwitch.classList.remove('is-open');
    langTrigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) langTrigger.focus();
}

if (langSwitch && langTrigger) {
    langTrigger.addEventListener('click', () => {
        if (isLangMenuOpen()) closeLangMenu(false);
        else openLangMenu();
    });
    langTrigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openLangMenu(event.key === 'ArrowUp' ? 'last' : undefined);
        }
    });
    langOptions.forEach((option, index) => {
        option.addEventListener('click', () => {
            try {
                localStorage.setItem('lyric-language', option.dataset.lang);
            } catch { /* storage unavailable */ }
            applyLang(option.dataset.lang);
            closeLangMenu(true);
        });
        option.addEventListener('keydown', (event) => {
            let next = null;
            if (event.key === 'ArrowDown') next = langOptions[(index + 1) % langOptions.length];
            else if (event.key === 'ArrowUp') next = langOptions[(index - 1 + langOptions.length) % langOptions.length];
            else if (event.key === 'Home') next = langOptions[0];
            else if (event.key === 'End') next = langOptions[langOptions.length - 1];
            if (next) {
                event.preventDefault();
                next.focus();
            }
        });
    });
    langSwitch.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isLangMenuOpen()) {
            event.preventDefault();
            closeLangMenu(true);
        }
    });
    // Close when keyboard focus moves elsewhere. Pointer clicks outside are handled below
    // (relatedTarget is null for those, e.g. Safari doesn't focus buttons on click).
    langSwitch.addEventListener('focusout', (event) => {
        if (event.relatedTarget && !langSwitch.contains(event.relatedTarget)) closeLangMenu(false);
    });
    document.addEventListener('click', (event) => {
        if (!langSwitch.contains(event.target)) closeLangMenu(false);
    });
}

selectTrack();
applyLang(currentLang);

window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("ytplayer", {
        videoId: currentTrack.videoId,
        // rel: 0 limits related videos (pause and end screens) to the playing video's channel.
        playerVars: { playsinline: 1, rel: 0 },
        events: {
            onReady({ target }) {
                target.getIframe().classList.add("player-ready");
                videoFallback.hidden = true;
                target.playVideo();
                setInterval(() => syncLyrics(target.getCurrentTime()), 100);
            },
            onStateChange({ target, data }) {
                if (data === YT.PlayerState.ENDED) {
                    selectTrack();
                    renderLyrics();
                    target.loadVideoById(currentTrack.videoId);
                }
            },
            // The page shows its own lyrics, so switch off YouTube's default caption track each time
            // the captions module loads (once per video). Viewers can still turn CC back on.
            onApiChange({ target }) {
                if (target.getOptions().includes("captions")) {
                    target.setOption("captions", "track", {});
                }
            },
            onError({ target }) {
                target.getIframe().classList.remove("player-ready");
                videoFallback.hidden = false;
            }
        }
    });
};

const youtubeApi = document.createElement("script");
youtubeApi.src = "https://www.youtube.com/iframe_api";
document.head.append(youtubeApi);
