// IndexedDB 数据库相关功能
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;
const STORE_PLAYLISTS = 'playlists';
const STORE_SETTINGS = 'settings';
const STORE_PLAY_HISTORY = 'playHistory';

let db;

// 打开数据库
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // 创建播放列表存储
      if (!database.objectStoreNames.contains(STORE_PLAYLISTS)) {
        database.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      
      // 创建设置存储
      if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
        database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      
      // 创建播放历史存储
      if (!database.objectStoreNames.contains(STORE_PLAY_HISTORY)) {
        database.createObjectStore(STORE_PLAY_HISTORY, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// 保存播放列表到数据库
function savePlaylistToDB(listId, playlist) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PLAYLISTS], 'readwrite');
    const store = transaction.objectStore(STORE_PLAYLISTS);
    const request = store.put({ id: listId, data: playlist, timestamp: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 从数据库获取播放列表
function getPlaylistFromDB(listId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PLAYLISTS], 'readonly');
    const store = transaction.objectStore(STORE_PLAYLISTS);
    const request = store.get(listId);
    
    request.onsuccess = () => resolve(request.result ? request.result.data : null);
    request.onerror = () => reject(request.error);
  });
}

// 保存设置到数据库
function saveSetting(key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.put({ key, value });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 从数据库获取设置
function getSetting(key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SETTINGS], 'readonly');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}

// 保存播放历史
function addToPlayHistory(songIndex) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PLAY_HISTORY], 'readwrite');
    const store = transaction.objectStore(STORE_PLAY_HISTORY);
    const request = store.add({ songIndex, timestamp: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 获取最近播放的歌曲
function getRecentPlayed(count = 10) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PLAY_HISTORY], 'readonly');
    const store = transaction.objectStore(STORE_PLAY_HISTORY);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const history = request.result || [];
      history.sort((a, b) => b.timestamp - a.timestamp);
      resolve(history.slice(0, count).map(item => item.songIndex));
    };
    request.onerror = () => reject(request.error);
  });
}

// 保存音乐列表信息
var musicList = [];
// 声明变量，保存当前播放的是哪一首歌曲
var currentIndex = 0;
// 播放模式: 'sequence' 顺序播放, 'shuffle' 随机播放
var playMode = 'sequence';
// 已播放过的索引（用于随机播放时避免重复）
var playedIndices = [];
// 实现列表切换功能所用的列表信息
var musicLists = [
  { name: '默认', url: './music.json' },
  { name: '《遮羞艾莉》', url: './zxal.json' },
];


// Fisher-Yates 洗牌算法
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 获取下一个随机索引
function getNextRandomIndex() {
  if (musicList.length <= 1) return 0;
  
  // 如果全部歌曲都播放过了，重置
  if (playedIndices.length >= musicList.length) {
    playedIndices = [currentIndex];
  }
  
  // 获取未播放的索引
  const availableIndices = [];
  for (let i = 0; i < musicList.length; i++) {
    if (!playedIndices.includes(i)) {
      availableIndices.push(i);
    }
  }
  
  // 如果没有可用索引（理论上不会发生），返回随机
  if (availableIndices.length === 0) {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * musicList.length);
    } while (nextIndex === currentIndex && musicList.length > 1);
    return nextIndex;
  }
  
  // 从可用索引中随机选一个
  return availableIndices[Math.floor(Math.random() * availableIndices.length)];
}

// 获取下一个索引
function getNextIndex() {
  if (playMode === 'shuffle') {
    return getNextRandomIndex();
  } else {
    // 顺序播放
    return currentIndex < musicList.length - 1 ? currentIndex + 1 : 0;
  }
}

// 获取上一个索引
function getPrevIndex() {
  if (playMode === 'shuffle') {
    // 随机播放模式下上一首也随机
    return getNextRandomIndex();
  } else {
    // 顺序播放
    return currentIndex > 0 ? currentIndex - 1 : musicList.length - 1;
  }
}

// 更新播放模式按钮UI
function updateModeButton() {
  const modeBtn = $('#modeBtn');
  if (playMode === 'shuffle') {
    modeBtn.removeClass('fa-repeat').addClass('fa-random').addClass('active');
    modeBtn.attr('title', '随机播放');
  } else {
    modeBtn.removeClass('fa-random').addClass('fa-repeat').removeClass('active');
    modeBtn.attr('title', '顺序播放');
  }
}

// 切换播放模式
function togglePlayMode() {
  playMode = playMode === 'sequence' ? 'shuffle' : 'sequence';
  if (playMode === 'shuffle') {
    // 重置已播放记录
    playedIndices = [currentIndex];
  }
  updateModeButton();
  saveSetting('playMode', playMode);
}

// 加载音乐列表信息
async function loadMusicList(url) {
  const listId = url;
  
  // 先尝试从数据库获取
  try {
    const cachedList = await getPlaylistFromDB(listId);
    if (cachedList && cachedList.length > 0) {
      musicList = cachedList;
      render(musicList[currentIndex]);
      renderMusicList(musicList);
      return;
    }
  } catch (e) {
    console.log('No cached playlist found, loading from network');
  }
  
  // 从网络加载
  $.ajax({
    type: "GET",
    url: url,
    dataType: "json",
    success: async function(data) {
      musicList = data;
      render(musicList[currentIndex]);
      renderMusicList(musicList);
      // 保存到数据库
      try {
        await savePlaylistToDB(listId, data);
      } catch (e) {
        console.log('Failed to save playlist to DB:', e);
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("Error loading the music list: " + textStatus + ", " + errorThrown);
    }
  });
}

// 给播放按钮绑定点击事件
$("#playBtn").on("click", function () {
  if ($("audio").get(0).paused) {
    // 暂停状态，应该播放
    // 修改播放按钮的图标状态
    $(this).removeClass("fa-play").addClass("fa-pause");
    // 让音乐信息卡片显示出来
    $(".player-info").animate(
      {
        top: "-120%",
        opacity: 1,
      },
      "slow"
    );

    // 让封面旋转起来
    $(".cover").css({
      "animation-play-state": "running",
    });

    // 让音乐播放起来
    $("audio").get(0).play();
  } else {
    // 播放状态，应该暂停
    $(this).removeClass("fa-pause").addClass("fa-play");
    // 让音乐信息卡片消失
    $(".player-info").animate(
      {
        top: "0%",
        opacity: 0,
      },
      "slow"
    );

    // 让封面旋转暂停
    $(".cover").css({
      "animation-play-state": "paused",
    });

    // 让音乐暂停
    $("audio").get(0).pause();
  }

  // 重新渲染列表数据
  renderMusicList(musicList);
});

// 给上一首按钮绑定点击事件
$("#prevBtn").on("click", function () {
  currentIndex = getPrevIndex();
  if (playMode === 'shuffle' && !playedIndices.includes(currentIndex)) {
    playedIndices.push(currentIndex);
  }
  
  // 重新渲染歌曲信息
  render(musicList[currentIndex]);
  addToPlayHistory(currentIndex);
  // 让音乐播放
  if (!$("audio").get(0).paused) {
    $("#playBtn").trigger("click");
  }
  $("#playBtn").trigger("click");
});

// 给下一首按钮绑定点击事件
$("#nextBtn").on("click", function () {
  currentIndex = getNextIndex();
  if (playMode === 'shuffle' && !playedIndices.includes(currentIndex)) {
    playedIndices.push(currentIndex);
  }
  
  // 重新渲染歌曲信息
  render(musicList[currentIndex]);
  addToPlayHistory(currentIndex);
  // 让音乐播放
  if (!$("audio").get(0).paused) {
    $("#playBtn").trigger("click");
  }
  $("#playBtn").trigger("click");
});

// 给播放模式按钮绑定点击事件
$("#modeBtn").on("click", function () {
  togglePlayMode();
});

// 给音乐列表绑定点击事件
$("#openModal").on("click", function () {
  $(".modal").css({
    display: "block",
  });
});

$(".modal-close").on("click", function () {
  $(".modal").css({
    display: "none",
  });
});

// 监听audio标签的 timeupdate 事件
$("audio").on("timeupdate", function () {
  // 获取音乐当前到的时间，单位：秒
  var currentTime = $("audio").get(0).currentTime || 0;
  // 获取音乐的总时长，单位：秒
  var duration = $("audio").get(0).duration || 0;
  // 设置当前播放时间
  $(".current-time").text(formatTime(currentTime));
  // 设置进度条
  var value = (currentTime / duration) * 100;
  $(".music_progress_line").css({
    width: value + "%",
  });
});

// 监听音乐播放完毕的事件 - 自动播放下一首
$("audio").on("ended", function () {
  currentIndex = getNextIndex();
  if (playMode === 'shuffle' && !playedIndices.includes(currentIndex)) {
    playedIndices.push(currentIndex);
  }
  
  render(musicList[currentIndex]);
  addToPlayHistory(currentIndex);
  
  // 继续播放
  $("#playBtn").removeClass("fa-pause").addClass("fa-play");
  setTimeout(function() {
    $("#playBtn").trigger("click");
  }, 100);
});

// 通过事件委托给音乐列表的播放按钮绑定点击事件
$(".music-list").on("click", ".play-circle", function () {
  if ($(this).hasClass("fa-play-circle")) {
    var index = $(this).attr("data-index");
    currentIndex = parseInt(index);
    
    if (playMode === 'shuffle' && !playedIndices.includes(currentIndex)) {
      playedIndices.push(currentIndex);
    }
    
    render(musicList[currentIndex]);
    addToPlayHistory(currentIndex);
    $("#playBtn").trigger("click");
  } else {
    $("#playBtn").trigger("click");
  }
});

// 格式化时间
function formatTime(time) {
  // 329 -> 05:29
  var min = parseInt(time / 60);
  var sec = parseInt(time % 60);
  min = min < 10 ? "0" + min : min;
  sec = sec < 10 ? "0" + sec : sec;

  return `${min}:${sec}`;
}

// 根据信息，设置页面对应标签中的内容
function render(data) {
  $(".name").text(data.name);
  $(".singer-album").text(`${data.singer} - ${data.album}`);
  $(".time").text(data.time);
  $(".cover img").attr("src", data.cover);
  $("audio").attr("src", data.audio_url);
  $(".mask_bg").css({
    background: `url("${data.cover}") no-repeat center center`,
  });
}

// 根据音乐列表数据，创建li
function renderMusicList(list) {
  $(".music-list").empty();

  $.each(list, function (index, item) {
    var $li = $(`
      <li class="${index == currentIndex ? "playing" : ""}">
        <span>0${index + 1}. ${item.name} - ${item.singer}</span>
        <span data-index="${index}" class="fa ${
      index == currentIndex && !$("audio").get(0).paused
        ? "fa-pause-circle"
        : "fa-play-circle"
    } play-circle"></span>
      </li>
    `);
    $(".music-list").append($li);
  });
}

// 填充 select 元素
function populateMusicSelect() {
  var select = $('#musicSelect');
  select.empty(); // 清空现有选项
  $.each(musicLists, function(index, list) {
    select.append($('<option></option>').val(list.url).html(list.name));
  });
  select.val(musicLists[0].url); // 默认选择第一个列表
}

// 给 select 元素绑定 change 事件
$('#musicSelect').on('change', function() {
  var selectedUrl = $(this).val();
  currentIndex = 0;
  playedIndices = [];
  loadMusicList(selectedUrl);
});

// 页面加载完成后，初始化
$(document).ready(async function() {
  try {
    await openDB();
    
    // 从数据库恢复播放模式设置
    const savedMode = await getSetting('playMode');
    if (savedMode) {
      playMode = savedMode;
    }
    updateModeButton();
    
    populateMusicSelect();
    loadMusicList(musicLists[0].url); // 默认加载第一个列表
  } catch (e) {
    console.error('Failed to initialize database:', e);
    // 如果数据库初始化失败，仍继续加载
    populateMusicSelect();
    loadMusicList(musicLists[0].url);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var audioPlayer = document.getElementById('audio');
  var volumeControl = document.getElementById('volumeControl');
  audioPlayer.volume = volumeControl.value;  // 设置初始音量
  volumeControl.addEventListener('input', function() {
      audioPlayer.volume = this.value;
  });  // 监听滑条变化事件
});

