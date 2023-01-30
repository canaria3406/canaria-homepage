var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var videotime = 0;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('ytplayer', {
    videoId: 'SyDfuRdmiqQ', 
    events: {
        'onReady': function(event) {
        
            event.target.playVideo();
            function updateTime() {
                if(player && player.getCurrentTime) {
                    videotime = player.getCurrentTime();
                    //console.log(videotime);
                    videoTimeUpdater();
                }
            }
            timeupdater = setInterval(updateTime, 100);
            
        }
        //,'onStateChange': function(event){
        //    if(event.data === YT.PlayerState.ENDED){
        //        event.target.playVideo();
        //    }
        //}
    }
    });
}

let text = "[ti: 愛言葉Ⅲ][ar: 百鬼あやめ]\n[00:22.61] 想いの冒険を　忘れずに全部言えるかな\n[00:29.66] 君から聞きたいよ　何回目の僕に出会った？\n[00:36.72] 僕は変わりました　新しい君に出会うために\n[00:43.50] 久しぶりだねって　言えたならここで泣こっか\n[00:50.41] 好きとかって　嫌いとかって\n[00:53.75] 何度だって愛を歌う君が\n[00:57.50] 恋しくって　嘘じゃない本当だよ\n[01:01.78] また出会おう\n[01:04.12] 僕ら“II”を嫌って　“I”に戻って\n[01:08.13] 何回だって　間違ってきたよ\n[01:12.24] 消えない後悔と　冷めない愛情が\n[01:15.15] 恋を再起動する\n[01:18.21] ほら“I”を嫌って　また“II”に戻って\n[01:22.29] “III”になって　愛を繋いでいこう\n[01:26.34] 言いたい感情は　伝えたい正解は\n[01:29.28] たったひとつだけ\n[01:31.66] ありがとう\n[01:46.89] 想いの冒険は　これからもちゃんと続いていく\n[01:53.74] 3と9に乗って　言葉とか飛び越えちゃって\n[02:00.68] 君も変わりました　新しい誰かに会うために\n[02:07.73] 大人になりました　それだけで良いと思えた\n[02:14.51] 好きとかって　嫌いとかって\n[02:17.81] 何度だって愛を歌う君が\n[02:21.52] 恋しくって　嘘じゃない本当だよ\n[02:25.57] また出会おう\n[02:42.96] “恋”をして　…バカ。\n[02:46.36] “愛”にして　…バカ。\n[02:49.81] バカでいい　この先もずっとこのまま\n[02:56.04] …バカ。\n[02:58.10] 僕ら“II”を嫌って　“I”に戻って\n[03:02.01] 何回だって　間違ってきたよ\n[03:06.21] 消えない後悔と　冷めない愛情が\n[03:09.03] 恋を再起動する\n[03:12.24] ほら“I”を嫌って　また“II”に戻って\n[03:16.17] “III”になって　愛を繋いでいこう\n[03:20.18] 言いたい感情は　伝えたい正解は\n[03:23.06] たったひとつだけ　ありがとう\n[03:26.79] メーデー　僕と判っても\n[03:28.30] もう抱き締めなくて易々んだよ\n[03:30.19] 終わんない愛を抱いてたくないの\n[03:32.14] もっとちゃんと不安にしてよ\n[03:33.75] 妄想感傷代償連盟　愛を懐いて理想を号んだ\n[03:37.50] 行き場のある愛のメロディーを\n[03:40.47] 今これまでにありがとう\n[03:44.10] いつまでも君と　「こんな歌あったね」って\n[03:50.12] 出会いを数えられるように";

function parseLyric(text) {

    let lyricArr = text.split('\n');
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

let result = parseLyric(text);
let ul = document.createElement("ul");
for (let i = 0; i < result.length; i++) {
        let li = document.createElement("li");
        li.textContent = result[i].content;
        ul.appendChild(li);
}
document.querySelector(".bg").appendChild(ul);

let lineNo = 0;
let preLine = 1;
let lineHeight = -30;

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
