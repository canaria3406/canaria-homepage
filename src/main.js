const tracks = [
    { videoId: videoID1, lyrics: { "zh-Hant": lyricZH1, ja: lyric1 } }
];

const lyricViewport = document.querySelector(".bg");
const lyricList = document.createElement("ul");
lyricViewport.append(lyricList);
const lyricMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const LYRIC_MOVE = { duration: 460, easing: "cubic-bezier(.22, .61, .36, 1)" };
lyricViewport.style.setProperty("--lyric-move-easing", LYRIC_MOVE.easing);

const videoFallback = document.querySelector(".video-fallback");
const videoPoster = document.createElement("img");
videoPoster.className = "video-poster";
videoPoster.alt = "";
videoFallback.prepend(videoPoster);

let player;
let currentTrack;
// The lyric language comes from the shared language menu (canaria.js, data-lang-scope="content").
let currentLang = "zh-Hant";
let lyrics = [];
let activeLine = -1;
let activeTop = 0; // Last translation target; resizes re-align only when the layout moves it.
let lyricAnimation;

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
    // The shared translation cancels out; fractional coordinates avoid rounded-pixel jumps.
    const cue = current.getBoundingClientRect();
    const list = lyricList.getBoundingClientRect();
    return Math.max(0, cue.top - list.top - anchorTop + (cue.height - cueHeight) / 2);
}

function updateLyricHighlight() {
    const current = lyricList.children[activeLine];
    lyricViewport.classList.toggle("has-active-line", Boolean(current));
    if (current) {
        const lineHeight = parseFloat(getComputedStyle(current).minHeight) || current.offsetHeight || 1;
        lyricViewport.style.setProperty("--lyric-highlight-scale", current.getBoundingClientRect().height / lineHeight);
    }
}

function scrollToActiveLine(behavior) {
    const top = getActiveTop();
    const animate = behavior !== "instant" && !lyricMotion.matches && Math.abs(top - activeTop) >= 1;
    // Retarget from the visible position so a fast cue can continue an unfinished animation.
    const from = animate ? getComputedStyle(lyricList).transform : null;
    lyricAnimation?.cancel();
    lyricAnimation = null;
    activeTop = top;
    const transform = `translate3d(0, ${-top}px, 0)`;
    lyricList.style.transform = transform;
    // Resize the highlight with the list's timing, or instantly when the list jumps. Only wrapped
    // cues change its scale, so single-line cues are unaffected.
    lyricViewport.style.setProperty("--lyric-move-duration", animate ? `${LYRIC_MOVE.duration}ms` : "0s");
    updateLyricHighlight();
    if (animate) {
        lyricAnimation = lyricList.animate([{ transform: from }, { transform }], LYRIC_MOVE);
    }
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
// cue-change animation alone.
function realignActiveLine() {
    if (Math.abs(getActiveTop() - activeTop) >= 1) scrollToActiveLine("instant");
    else updateLyricHighlight();
}

const lyricResizeObserver = new ResizeObserver(realignActiveLine);
lyricResizeObserver.observe(lyricViewport);
lyricResizeObserver.observe(lyricList);
// A font swap can re-wrap lines while the list keeps the same total height, which the observer misses.
document.fonts.addEventListener("loadingdone", realignActiveLine);
lyricMotion.addEventListener("change", () => scrollToActiveLine("instant"));

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
    if (!currentTrack.lyrics[lang]) return;
    currentLang = lang;
    renderLyrics(player?.getCurrentTime?.() ?? 0);
}

// canaria.js reports the saved choice once the page is parsed, then every change.
document.addEventListener("canaria:langchange", (event) => applyLang(event.detail.lang));

selectTrack();
// Without the shared script, show the default lyrics right away.
if (!window.Canaria) applyLang(currentLang);

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
