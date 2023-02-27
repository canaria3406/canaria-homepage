let tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
let firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let videotime = 0;
let lineNo = 0;
let preLine = 1;
let lineHeight = -30;

const videoArr = Object.values({videoID1, videoID2});
const lyricArr = Object.values({lyric1, lyric2});
const randomInt = Math.floor(Math.random() * videoArr.length);
const videoID = videoArr[randomInt];
const lyric = lyricArr[randomInt];

function onYouTubeIframeAPIReady() {
    player = new YT.Player("ytplayer", {
        videoId: videoID,
        events: {
            "onReady": function(event) {
                event.target.playVideo();
                function updateTime() {
                    if(player && player.getCurrentTime) {
                        videotime = player.getCurrentTime();
                        videoTimeUpdater();
                    }
                }
                timeupdater = setInterval(updateTime, 100);
            }
            ,"onStateChange": function(event){
                if(event.data === YT.PlayerState.ENDED){
                    clearInterval(timeupdater);
                    lineNo = 0;
                    preLine = 1;
                    lineHeight = -30;
                    ul.style.top = "30px";
                    event.target.playVideo();
                    function updateTime() {
                        if(player && player.getCurrentTime) {
                            videotime = player.getCurrentTime();
                            videoTimeUpdater();
                        }
                    }
                    timeupdater = setInterval(updateTime, 100);
                }
            }
        }
    });
}

function parseLyric(lyric) {

    let lyricArr = lyric.split("\n");
    let result = []; 

    for (i = 0; i < lyricArr.length; i++) {
        let playTimeArr = lyricArr[i].match(/\[\d{2}:\d{2}((\.|\:)\d{2})\]/g);
        let lineLyric = "";
        if (lyricArr[i].split(playTimeArr).length > 0) {
            lineLyric = lyricArr[i].split(playTimeArr);
        }
        if (playTimeArr != null) {
            for (let j = 0; j < playTimeArr.length; j++) {
                let time = playTimeArr[j].substring(1, playTimeArr[j].indexOf("]")).split(":");
                    result.push({
                        time: (parseInt(time[0]) * 60 + parseFloat(time[1])).toFixed(4),
                        content: String(lineLyric).substr(1)
                    });
            }
        }
    }
    return result;
}

let result = parseLyric(lyric);
let ul = document.createElement("ul");
for (let i = 0; i < result.length; i++) {
        let li = document.createElement("li");
        li.textContent = result[i].content;
        ul.appendChild(li);
}
document.querySelector(".bg").appendChild(ul);

function highLight() {
    let lis = document.querySelectorAll("li");
    for (let i = 0; i < lis.length; i++) {
            if (i === lineNo) {
                lis[i].classList.add("active");
            } else {
            lis[i].classList.remove("active");
            }
    }
    if (lineNo > preLine) {
        let ul = document.querySelector("ul");
        ul.style.transition = "top 0.5s ease-in-out";
        ul.style.top = (lineNo - preLine) * lineHeight + "px";
    }
}

function videoTimeUpdater() {
    if (lineNo == result.length) return;
    const firstLi = document.querySelector("li");
    if (firstLi.classList.contains("active")) {
        const ul = document.querySelector("ul");
        ul.style.top = "0";
    }
    lineNo = getLineNo(videotime);
    highLight();
    lineNo++;
}
    
function getLineNo(videotime) {
    if (videotime >= parseFloat(result[lineNo].time)) {
        for (let i = result.length - 1; i >= lineNo; i--) {
            if (videotime >= parseFloat(result[i].time)) {
                return i;
            }
        }
    }
    else {
        for (let i = 0; i <= lineNo; i++) {
            if (videotime <= parseFloat(result[i].time)) {
                return i - 1;
            }
        }
    }
}
