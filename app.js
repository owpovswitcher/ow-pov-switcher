(() => {
  "use strict";

  const DEMO_VIDEO_ID = "M7lc1UVf-VE";
  const CONFIG_KEY = "ow-pov-switchboard-config-v1";
  const NOTES_KEY_PREFIX = "ow-replay-viewer:notes:";
  const EXPORT_FORMAT = "ow-replay-viewer";
  const EXPORT_VERSION = 3;
  const MAX_OFFSET_SECONDS = 7200;
  const LOCAL_FILE_MESSAGE = "このプレイヤーはfile://では動作しません。HTTPサーバー経由で http://localhost:4173/ を開いてください。";

  const defaultPerspectives = [
    { key: "map", name: "Overview", role: "MAP", team: "WORLD", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p01", name: "Player 01", role: "TANK", team: "ALLY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p02", name: "Player 02", role: "DPS", team: "ALLY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p03", name: "Player 03", role: "DPS", team: "ALLY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p04", name: "Player 04", role: "SUPPORT", team: "ALLY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p05", name: "Player 05", role: "SUPPORT", team: "ALLY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p06", name: "Player 06", role: "TANK", team: "ENEMY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p07", name: "Player 07", role: "DPS", team: "ENEMY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p08", name: "Player 08", role: "DPS", team: "ENEMY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p09", name: "Player 09", role: "SUPPORT", team: "ENEMY", videoId: DEMO_VIDEO_ID, offset: 0 },
    { key: "p10", name: "Player 10", role: "SUPPORT", team: "ENEMY", videoId: DEMO_VIDEO_ID, offset: 0 },
  ];

  const state = {
    matchId: createMatchId(),
    requestedMatchId: "",
    matchLoadError: "",
    matchTitle: "Ranked test match / Midtown",
    mapKey: "",
    patchVersion: "",
    sourceReplayCode: "",
    videoDuration: 0,
    perspectives: clone(defaultPerspectives),
    notes: [],
    activeIndex: 0,
    player: null,
    playerGeneration: 0,
    ready: 0,
    total: 1,
    isPlaying: false,
    pauseAfterLoad: false,
    volume: 100,
    noteDraftTimeMs: null,
    rafId: null,
    apiReady: false,
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", initializeApp);

  async function initializeApp() {
    cacheElements();
    if (window.location.protocol === "file:") {
      setDataStatus(LOCAL_FILE_MESSAGE, true);
      showStageMessage("HTTPサーバーで開いてください", LOCAL_FILE_MESSAGE);
      return;
    }

    const catalogMatchLoaded = await loadMatchFromUrl();
    hydrateConfig({ preserveMatch: catalogMatchLoaded });
    updateMatchPageTitle();
    renderPerspectiveSelector();
    bindEvents();
    updateDurationUI();
    updateVolumeUI();
    updateActiveUI();
    renderNotes();
    if (state.matchLoadError) {
      setDataStatus(state.matchLoadError, true);
      showStageMessage("試合を読み込めません", state.matchLoadError);
    }
    startClockLoop();
    bootYouTubeApi();
  }

  async function loadMatchFromUrl() {
    const requestedMatchId = new URL(window.location.href).searchParams.get("matchId");
    state.requestedMatchId = requestedMatchId ? String(requestedMatchId).trim() : "";
    if (!state.requestedMatchId) return false;

    if (!window.MatchCatalog || typeof window.MatchCatalog.loadMatch !== "function") {
      state.matchLoadError = "試合カタログを読み込めません。ページを再読み込みしてください。";
      return false;
    }

    try {
      const match = await window.MatchCatalog.loadMatch(state.requestedMatchId);
      if (!match) {
        state.matchLoadError = "指定された試合がカタログにありません。";
        return false;
      }

      applyCatalogMatch(match);
      return true;
    } catch (error) {
      state.matchLoadError = error.message || "試合カタログを読み込めませんでした。";
      return false;
    }
  }

  function applyCatalogMatch(match) {
    state.matchId = match.id;
    state.matchTitle = match.title;
    state.mapKey = normalizeMapKey(match.mapKey);
    state.patchVersion = normalizePatchVersion(match.patchVersion);
    state.sourceReplayCode = match.sourceReplayCode || "";
    state.perspectives = match.perspectives.map((perspective, index) => ({
      ...defaultPerspectives[index],
      key: perspective.key || defaultPerspectives[index].key,
      name: perspective.name || defaultPerspectives[index].name,
      role: perspective.role || defaultPerspectives[index].role,
      team: perspective.team || defaultPerspectives[index].team,
      videoId: normalizeVideoId(perspective.youtubeVideoId || perspective.videoId || perspective.url),
      offset: Number(perspective.offsetSeconds ?? perspective.offset ?? 0),
    }));
    state.notes = readNotesForMatch(state.matchId, []);
    state.activeIndex = 0;
  }

  function cacheElements() {
    const ids = [
      "matchPageTitle",
      "povList",
      "exportConfig",
      "importConfig",
      "importFile",
      "dataStatus",
      "viewerTitle",
      "playerMount",
      "stageEmpty",
      "playPause",
      "backFive",
      "forwardFive",
      "timeline",
      "volume",
      "volumeValue",
      "currentTime",
      "durationLabel",
      "reloadActive",
      "activeName",
      "activeMeta",
      "addNote",
      "noteComposer",
      "noteTime",
      "noteText",
      "cancelNote",
      "noteList",
    ];

    ids.forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.playPause.addEventListener("click", togglePlayback);
    elements.backFive.addEventListener("click", () => seekBy(-5));
    elements.forwardFive.addEventListener("click", () => seekBy(5));
    elements.reloadActive.addEventListener("click", reloadActiveAtCurrentTime);
    elements.timeline.addEventListener("input", () => seekToMatchTime(Number(elements.timeline.value), false));
    elements.volume.addEventListener("input", () => {
      state.volume = clamp(Math.round(Number(elements.volume.value)), 0, 100);
      updateVolumeUI();
      applyVolumeToPlayer(state.player);
      persistConfig();
    });
    elements.addNote.addEventListener("click", openNoteComposer);
    elements.noteComposer.addEventListener("submit", saveNote);
    elements.cancelNote.addEventListener("click", closeNoteComposer);
    elements.noteList.addEventListener("click", handleNoteListClick);
    elements.exportConfig.addEventListener("click", downloadConfig);
    elements.importConfig.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", handleImportFile);

    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      const index = keyToIndex(event.key);
      if (index !== null && index < state.perspectives.length) {
        selectPerspective(index);
      }
    });
  }

  function bootYouTubeApi() {
    loadYouTubeApi()
      .then(() => {
        state.apiReady = true;
        if (state.matchLoadError) {
          showStageMessage("試合を読み込めません", state.matchLoadError);
          return;
        }
        initializePlayer();
      })
      .catch(() => {
        showStageMessage("YouTube APIの読み込みに失敗しました", "ネットワーク接続とHTTPサーバー起動を確認してください");
      });
  }

  function loadYouTubeApi() {
    if (window.YT && typeof window.YT.Player === "function") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") previousReady();
        resolve();
      };

      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existingScript) return;

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("IFrame Player API script failed to load"));
      document.head.appendChild(script);
    });
  }

  function initializePlayer() {
    if (!state.apiReady || state.matchLoadError) return;

    closeNoteComposer();
    state.playerGeneration += 1;
    destroyPlayer();
    state.activeIndex = Math.min(state.activeIndex, state.perspectives.length - 1);
    state.isPlaying = false;
    state.pauseAfterLoad = false;
    state.ready = 0;
    state.total = 1;
    state.videoDuration = 0;
    const perspective = state.perspectives[state.activeIndex];

    updateActiveUI();
    updateDurationUI();
    updatePlayButton();
    updateNoteControls();

    if (!perspective || !perspective.videoId) {
      showStageMessage("この視点の動画は未登録です", "カタログに動画が登録されていません");
      return;
    }

    showStageMessage("1つのプレイヤーを初期化しています", "現在の視点の動画を読み込んでいます");

    const host = document.createElement("div");
    host.id = "player-host";
    elements.playerMount.appendChild(host);

    const generation = state.playerGeneration;
    state.player = new YT.Player(host.id, playerOptions(perspective.videoId, {
      onReady: (event) => onPlayerReady(generation, event),
      onStateChange: (event) => onPlayerStateChange(generation, event),
      onError: (event) => onPlayerError(generation, event),
    }));
  }

  function destroyPlayer() {
    if (state.player && typeof state.player.destroy === "function") {
      try {
        state.player.destroy();
      } catch (_error) {
        // Ignore a teardown race while replacing the player.
      }
    }
    state.player = null;
    elements.playerMount.innerHTML = "";
  }

  function playerOptions(videoId, events) {
    const vars = {
      autoplay: 0,
      controls: 0,
      cc_load_policy: 0,
      disablekb: 1,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
    };

    if (window.location.origin && window.location.origin !== "null") {
      vars.origin = window.location.origin;
    }

    return {
      width: "100%",
      height: "100%",
      videoId,
      playerVars: vars,
      events,
    };
  }

  function onPlayerReady(generation, event) {
    if (generation !== state.playerGeneration) return;

    state.ready = 1;
    syncDurationFromPlayer(event.target);
    scheduleDurationSync(generation, event.target);
    applyVolumeToPlayer(event.target);

    try {
      event.target.pauseVideo();
    } catch (_error) {
      // The player may not have completed its internal setup yet.
    }
    hideStageMessage();
    updateNoteControls();
  }

  function onPlayerStateChange(generation, event) {
    if (generation !== state.playerGeneration) return;

    syncDurationFromPlayer(event.target);

    if (event.data === YT.PlayerState.PLAYING) {
      if (state.pauseAfterLoad) {
        state.pauseAfterLoad = false;
        state.isPlaying = false;
        if (typeof event.target.pauseVideo === "function") event.target.pauseVideo();
        updatePlayButton();
        updateNoteControls();
        return;
      }

      state.isPlaying = true;
      updatePlayButton();
      updateNoteControls();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
      state.isPlaying = false;
      updatePlayButton();
      updateNoteControls();
    }
  }

  function onPlayerError(generation, event) {
    if (generation !== state.playerGeneration) return;

    state.pauseAfterLoad = false;
    const code = event && event.data !== undefined ? event.data : "unknown";
    showStageMessage("動画を再生できません", `YouTube error ${code} / 動画IDまたは埋め込み設定を確認してください`);
  }

  function selectPerspective(index) {
    if (index < 0 || index >= state.perspectives.length || index === state.activeIndex) return;

    const matchTime = getMatchTime();
    const targetPerspective = state.perspectives[index];
    const wasPlaying = state.isPlaying;

    state.activeIndex = index;
    state.pauseAfterLoad = !wasPlaying;

    updateActiveUI();
    updateTimeline(matchTime);

    if (!targetPerspective.videoId) {
      state.pauseAfterLoad = false;
      state.isPlaying = false;
      state.playerGeneration += 1;
      destroyPlayer();
      state.ready = 0;
      state.total = 1;
      state.videoDuration = 0;
      updateDurationUI();
      updatePlayButton();
      updateNoteControls();
      showStageMessage("この視点の動画は未登録です", "カタログに動画が登録されていません");
      return;
    }

    if (!state.apiReady) return;

    if (!state.player) {
      initializePlayer();
      return;
    }

    const player = state.player;
    if (typeof player.loadVideoById !== "function") return;

    const targetVideoTime = getTargetVideoTime(matchTime, targetPerspective);

    player.loadVideoById({ videoId: targetPerspective.videoId, startSeconds: targetVideoTime });
  }

  function togglePlayback() {
    const player = state.player;
    if (!player) return;

    if (state.isPlaying) {
      if (typeof player.pauseVideo === "function") player.pauseVideo();
      state.isPlaying = false;
      updatePlayButton();
      updateNoteControls();
      return;
    }

    if (typeof player.playVideo === "function") {
      state.pauseAfterLoad = false;
      player.playVideo();
      state.isPlaying = true;
      updatePlayButton();
      updateNoteControls();
    }
  }

  function seekBy(delta) {
    seekToMatchTime(clamp(getMatchTime() + delta, 0, state.videoDuration), true);
  }

  function seekToMatchTime(matchTime, preservePlayback) {
    const player = state.player;
    if (!player || typeof player.seekTo !== "function") return;

    const perspective = state.perspectives[state.activeIndex];
    const targetTime = getTargetVideoTime(matchTime, perspective, state.player);
    const shouldPlay = preservePlayback && state.isPlaying;

    if (!preservePlayback && state.isPlaying && typeof player.pauseVideo === "function") {
      player.pauseVideo();
    }
    player.seekTo(targetTime, true);

    if (shouldPlay && typeof player.playVideo === "function") player.playVideo();
    if (!preservePlayback) {
      state.isPlaying = false;
      updatePlayButton();
    }
    updateTimeline(matchTime);
  }

  function reloadActiveAtCurrentTime() {
    const player = state.player;
    const perspective = state.perspectives[state.activeIndex];
    if (!perspective || !perspective.videoId) {
      showStageMessage("この視点の動画は未登録です", "カタログに動画が登録されていません");
      return;
    }
    if (!player || typeof player.loadVideoById !== "function") return;

    const matchTime = getMatchTime();
    const targetTime = getTargetVideoTime(matchTime, perspective, player);
    const wasPlaying = state.isPlaying;

    state.pauseAfterLoad = !wasPlaying;
    player.loadVideoById({ videoId: perspective.videoId, startSeconds: targetTime });

    updateTimeline(matchTime);
  }

  function getMatchTime() {
    const perspective = state.perspectives[state.activeIndex];
    if (!state.player || !perspective || typeof state.player.getCurrentTime !== "function") {
      return Number(elements.timeline.value) || 0;
    }

    const videoTime = Number(state.player.getCurrentTime());
    if (!Number.isFinite(videoTime)) return Number(elements.timeline.value) || 0;
    return clamp(videoTime - perspective.offset, 0, state.videoDuration);
  }

  function getTargetVideoTime(matchTime, perspective, player = null) {
    const offset = Number(perspective?.offset) || 0;
    const requestedTime = Math.max(0, Number(matchTime) || 0) + offset;
    const videoDuration = getPlayerDuration(player);
    return videoDuration > 0 ? clamp(requestedTime, 0, videoDuration) : requestedTime;
  }

  function getPlayerDuration(player) {
    if (!player || typeof player.getDuration !== "function") return 0;
    const duration = Number(player.getDuration());
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  function syncDurationFromPlayer(player) {
    const duration = getPlayerDuration(player);
    if (!duration) return;

    const normalizedDuration = Math.round(duration * 10) / 10;
    if (Math.abs(state.videoDuration - normalizedDuration) < 0.05) return;

    state.videoDuration = normalizedDuration;
    updateDurationUI();
  }

  function scheduleDurationSync(generation, player) {
    [150, 600].forEach((delay) => {
      window.setTimeout(() => {
        if (generation !== state.playerGeneration || state.player !== player) return;
        syncDurationFromPlayer(player);
      }, delay);
    });
  }

  function renderPerspectiveSelector() {
    elements.povList.innerHTML = state.perspectives
      .map((perspective, index) => {
        const label = String(index + 1).padStart(2, "0");
        const isActive = index === state.activeIndex;
        return `
          <button class="pov-row${isActive ? " is-active" : ""}" type="button" data-index="${index}" aria-pressed="${isActive}">
            <span class="pov-number">${label}</span>
            <span class="pov-info">
              <div class="pov-name-line">
                <strong>${escapeHtml(perspective.name)}</strong>
                <small>${escapeHtml(perspective.role)} · ${escapeHtml(perspective.team)}</small>
              </div>
            </span>
            <span class="pov-switch" aria-hidden="true">↗</span>
          </button>
        `;
      })
      .join("");

    [...elements.povList.querySelectorAll(".pov-row")].forEach((row) => {
      row.addEventListener("click", () => {
        selectPerspective(Number(row.dataset.index));
      });
    });
  }

  function updatePerspectiveRows() {
    [...elements.povList.querySelectorAll(".pov-row")].forEach((row) => {
      const isActive = Number(row.dataset.index) === state.activeIndex;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateActiveUI() {
    const perspective = state.perspectives[state.activeIndex] || state.perspectives[0];
    if (!perspective) return;

    elements.viewerTitle.textContent = `${perspective.name} / ${perspective.role}`;
    elements.activeName.textContent = perspective.name;
    elements.activeMeta.textContent = `${perspective.role} · ${perspective.team}`;
    updatePerspectiveRows();
  }

  function updateDurationUI() {
    elements.timeline.max = String(state.videoDuration);
    elements.timeline.value = String(clamp(Number(elements.timeline.value) || 0, 0, state.videoDuration));
    elements.durationLabel.textContent = state.videoDuration > 0 ? formatTime(state.videoDuration) : "--:--";
    updateTimeline(Number(elements.timeline.value));
  }

  function updateTimeline(matchTime) {
    const time = clamp(matchTime, 0, state.videoDuration);
    elements.timeline.value = String(time);
    elements.currentTime.textContent = formatTime(time);
  }

  function updateVolumeUI() {
    state.volume = clamp(Math.round(state.volume), 0, 100);
    elements.volume.value = String(state.volume);
    elements.volumeValue.textContent = `${state.volume}%`;
  }

  function applyVolumeToPlayer(player) {
    if (!player) return;

    if (state.volume === 0 && typeof player.mute === "function") {
      player.mute();
      return;
    }

    if (typeof player.unMute === "function") player.unMute();
    if (typeof player.setVolume === "function") player.setVolume(state.volume);
  }

  function updatePlayButton() {
    elements.playPause.textContent = state.isPlaying ? "Ⅱ" : "▶";
    elements.playPause.setAttribute("aria-label", state.isPlaying ? "一時停止" : "再生");
  }

  function updateNoteControls() {
    const canAddNote = Boolean(state.player && state.ready === state.total && !state.isPlaying && elements.noteComposer.hidden);
    elements.addNote.disabled = !canAddNote;
    elements.addNote.title = state.isPlaying ? "一時停止してからメモを追加" : "現在の再生位置にメモ";
  }

  function openNoteComposer() {
    if (elements.addNote.disabled) return;

    state.noteDraftTimeMs = Math.round(getMatchTime() * 1000);
    elements.noteTime.textContent = formatNoteTime(state.noteDraftTimeMs);
    elements.noteText.value = "";
    elements.noteComposer.hidden = false;
    updateNoteControls();
    elements.noteText.focus();
  }

  function closeNoteComposer() {
    if (!elements.noteComposer) return;

    state.noteDraftTimeMs = null;
    elements.noteComposer.hidden = true;
    elements.noteText.value = "";
    updateNoteControls();
  }

  function saveNote(event) {
    event.preventDefault();

    const text = elements.noteText.value.trim();
    if (!text) {
      elements.noteText.focus();
      return;
    }

    const draftTimeMs = state.noteDraftTimeMs ?? Math.round(getMatchTime() * 1000);
    const matchTimeMs = Math.round(clamp(draftTimeMs / 1000, 0, state.videoDuration) * 1000);
    state.notes.push({
      id: createNoteId(),
      matchTimeMs,
      text,
      createdAt: new Date().toISOString(),
    });
    state.notes.sort((first, second) => first.matchTimeMs - second.matchTimeMs);
    persistConfig();
    renderNotes();
    closeNoteComposer();
  }

  function handleNoteListClick(event) {
    const deleteButton = event.target.closest("[data-note-delete]");
    if (deleteButton) {
      deleteNote(deleteButton.dataset.noteDelete);
      return;
    }

    const noteButton = event.target.closest("[data-note-id]");
    if (!noteButton) return;

    const note = state.notes.find((item) => item.id === noteButton.dataset.noteId);
    if (note) seekToMatchTime(note.matchTimeMs / 1000, state.isPlaying);
  }

  function deleteNote(noteId) {
    state.notes = state.notes.filter((note) => note.id !== noteId);
    persistConfig();
    renderNotes();
  }

  function renderNotes() {
    if (!state.notes.length) {
      elements.noteList.innerHTML = `<p class="notes-empty">一時停止して「この時間にメモ」を押すと、ここに表示されます。</p>`;
      return;
    }

    elements.noteList.innerHTML = state.notes
      .slice()
      .sort((first, second) => first.matchTimeMs - second.matchTimeMs)
      .map((note) => `
        <article class="note-row">
          <button class="note-jump" type="button" data-note-id="${escapeAttribute(note.id)}">
            <time>${formatNoteTime(note.matchTimeMs)}</time>
            <span>${escapeHtml(note.text)}</span>
          </button>
          <button class="note-delete" type="button" data-note-delete="${escapeAttribute(note.id)}" aria-label="${escapeAttribute(formatNoteTime(note.matchTimeMs))}のメモを削除">削除</button>
        </article>
      `)
      .join("");
  }

  function startClockLoop() {
    const tick = () => {
      if (state.player && typeof state.player.getCurrentTime === "function") {
        updateTimeline(getMatchTime());
      }
      state.rafId = window.setTimeout(tick, 250);
    };
    tick();
  }

  function updateViewerTitle() {
    const perspective = state.perspectives[state.activeIndex];
    if (perspective) elements.viewerTitle.textContent = `${perspective.name} / ${perspective.role}`;
  }

  function updateMatchPageTitle() {
    const title = state.matchTitle.trim() || "OW POV Switcher";
    elements.matchPageTitle.textContent = title;
    document.title = title;
  }

  function showStageMessage(title, detail) {
    elements.stageEmpty.classList.remove("is-hidden");
    elements.stageEmpty.innerHTML = `
      <span class="empty-glyph" aria-hidden="true">◌</span>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    `;
  }

  function hideStageMessage() {
    elements.stageEmpty.classList.add("is-hidden");
  }

  function downloadConfig() {
    try {
      persistConfig();

      const payload = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        scope: "personal-backup",
        exportedAt: new Date().toISOString(),
        match: {
          id: state.matchId,
          title: state.matchTitle,
          mapKey: state.mapKey,
          patchVersion: state.patchVersion,
          sourceReplayCode: state.sourceReplayCode || null,
          perspectives: state.perspectives.map((perspective) => ({
            ...perspective,
            url: perspective.videoId ? `https://www.youtube.com/watch?v=${perspective.videoId}` : "",
          })),
        },
        notes: state.notes,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${sanitizeFilename(state.matchTitle)}-notes.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDataStatus("メモをバックアップしました。", false);
    } catch (_error) {
      setDataStatus("メモのバックアップに失敗しました。", true);
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const imported = normalizeImportPayload(payload);
      const confirmed = window.confirm(
        `「${imported.title}」の設定と${imported.notes.length}件のメモで現在の内容を復元しますか？`,
      );
      if (!confirmed) return;

      state.matchId = imported.matchId;
      state.matchTitle = imported.title;
      state.mapKey = imported.mapKey;
      state.patchVersion = imported.patchVersion;
      state.sourceReplayCode = imported.sourceReplayCode;
      state.videoDuration = 0;
      state.perspectives = imported.perspectives;
      state.notes = imported.notes;
      state.activeIndex = 0;
      updateMatchPageTitle();
      renderPerspectiveSelector();
      renderNotes();
      updateDurationUI();
      updateActiveUI();
      persistConfig();
      initializePlayer();
      setDataStatus(`メモを復元しました。${state.notes.length}件`, false);
    } catch (error) {
      setDataStatus(error.message || "メモを復元できませんでした。", true);
    } finally {
      event.target.value = "";
    }
  }

  function normalizeImportPayload(payload) {
    if (!payload || payload.format !== EXPORT_FORMAT) {
      throw new Error("OW POV SwitcherのJSONファイルではありません。");
    }
    const version = Number(payload.version);
    if (![1, 2, EXPORT_VERSION].includes(version)) {
      throw new Error(`対応していないJSONバージョンです: ${payload.version}`);
    }

    const match = payload.match;
    if (!match || !Array.isArray(match.perspectives) || match.perspectives.length !== defaultPerspectives.length) {
      throw new Error("11視点分の試合設定が必要です。");
    }

    const perspectives = match.perspectives.map((perspective, index) => {
      const rawVideoId = perspective?.videoId || perspective?.url || perspective?.sourceUrl || "";
      const videoId = normalizeVideoId(rawVideoId);
      if (rawVideoId && !/^[\w-]{11}$/.test(videoId)) {
        throw new Error(`視点${String(index + 1).padStart(2, "0")}の動画IDが不正です。`);
      }

      const offset = Number(perspective?.offset ?? defaultPerspectives[index].offset);
      if (!Number.isFinite(offset) || Math.abs(offset) > MAX_OFFSET_SECONDS) {
        throw new Error(`視点${String(index + 1).padStart(2, "0")}の補正値が不正です。`);
      }

      return {
        ...defaultPerspectives[index],
        key: String(perspective?.key || defaultPerspectives[index].key),
        name: String(perspective?.name || defaultPerspectives[index].name),
        role: String(perspective?.role || defaultPerspectives[index].role),
        team: String(perspective?.team || defaultPerspectives[index].team),
        videoId,
        offset,
      };
    });

    const matchId = version >= 2 ? normalizeMatchId(match.id) : createMatchId();
    if (version >= 2 && !matchId) {
      throw new Error("試合IDがないメモバックアップは読み込めません。");
    }

    const title = String(match.title || "Untitled match").trim().slice(0, 200) || "Untitled match";
    const mapKey = normalizeMapKey(match.mapKey);
    const patchVersion = normalizePatchVersion(match.patchVersion);
    const sourceReplayCode = normalizeSourceReplayCode(match.sourceReplayCode || match.replayCode);
    const notes = normalizeImportedNotes(payload.notes);
    return { matchId, title, mapKey, patchVersion, sourceReplayCode, perspectives, notes };
  }

  function normalizeImportedNotes(notes) {
    if (notes === undefined) return [];
    if (!Array.isArray(notes)) throw new Error("メモの形式が不正です。");

    return notes.map((note, index) => {
      const matchTimeMs = Number(note?.matchTimeMs);
      const text = typeof note?.text === "string" ? note.text.trim() : "";
      if (!Number.isFinite(matchTimeMs) || matchTimeMs < 0) {
        throw new Error(`メモ${String(index + 1).padStart(2, "0")}の時刻が不正です。`);
      }
      if (!text || text.length > 500) {
        throw new Error(`メモ${String(index + 1).padStart(2, "0")}の本文が不正です。`);
      }

      return {
        id: createNoteId(),
        matchTimeMs: Math.round(matchTimeMs),
        text,
        createdAt: typeof note?.createdAt === "string" ? note.createdAt : new Date().toISOString(),
      };
    });
  }

  function setDataStatus(message, isError) {
    elements.dataStatus.textContent = message;
    elements.dataStatus.classList.toggle("is-error", isError);
  }

  function sanitizeFilename(value) {
    const safe = String(value)
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80);
    return safe || "ow-replay";
  }

  function persistConfig() {
    try {
      persistNotesForMatch();
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        matchId: state.matchId,
        matchTitle: state.matchTitle,
        mapKey: state.mapKey,
        patchVersion: state.patchVersion,
        sourceReplayCode: state.sourceReplayCode,
        perspectives: state.perspectives,
        notes: state.notes,
        volume: state.volume,
      }));
    } catch (_error) {
      // localStorage is optional for this prototype.
    }
  }

  function persistNotesForMatch() {
    const matchId = normalizeMatchId(state.matchId);
    if (!matchId) return;
    localStorage.setItem(`${NOTES_KEY_PREFIX}${encodeURIComponent(matchId)}`, JSON.stringify(state.notes));
  }

  function readNotesForMatch(matchId, fallbackNotes) {
    const normalizedMatchId = normalizeMatchId(matchId);
    if (!normalizedMatchId) return normalizeNotes(fallbackNotes);

    try {
      const raw = localStorage.getItem(`${NOTES_KEY_PREFIX}${encodeURIComponent(normalizedMatchId)}`);
      if (raw) return normalizeNotes(JSON.parse(raw));

      const fallback = normalizeNotes(fallbackNotes);
      if (fallback.length) {
        localStorage.setItem(
          `${NOTES_KEY_PREFIX}${encodeURIComponent(normalizedMatchId)}`,
          JSON.stringify(fallback),
        );
      }
      return fallback;
    } catch (_error) {
      return normalizeNotes(fallbackNotes);
    }
  }

  function hydrateConfig({ preserveMatch = false } = {}) {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.perspectives) && saved.perspectives.length === 11) {
        const savedMatchId = normalizeMatchId(saved.matchId);
        if (!preserveMatch) {
          state.matchId = savedMatchId || state.matchId;
          state.matchTitle = String(saved.matchTitle || state.matchTitle);
          state.mapKey = normalizeMapKey(saved.mapKey);
          state.patchVersion = normalizePatchVersion(saved.patchVersion);
          state.sourceReplayCode = normalizeSourceReplayCode(saved.sourceReplayCode);
          state.perspectives = saved.perspectives.map((perspective, index) => ({
            ...defaultPerspectives[index],
            ...perspective,
            videoId: normalizeVideoId(perspective.videoId),
          }));
        }
        if (Number.isFinite(Number(saved.volume))) state.volume = clamp(Number(saved.volume), 0, 100);
        const fallbackNotes = !preserveMatch || savedMatchId === state.matchId ? saved.notes : [];
        state.notes = readNotesForMatch(state.matchId, fallbackNotes);
      }
    } catch (_error) {
      state.perspectives = clone(defaultPerspectives);
    }
  }

  function normalizeVideoId(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^[\w-]{11}$/.test(raw)) return raw;

    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtu.be")) return url.pathname.replace(/^\//, "").slice(0, 11);
      if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
      const embedIndex = url.pathname.indexOf("/embed/");
      if (embedIndex >= 0) return url.pathname.slice(embedIndex + 7).split("/")[0].slice(0, 11);
      const shortsIndex = url.pathname.indexOf("/shorts/");
      if (shortsIndex >= 0) return url.pathname.slice(shortsIndex + 8).split("/")[0].slice(0, 11);
    } catch (_error) {
      return raw.slice(0, 11);
    }
    return raw.slice(0, 11);
  }

  function normalizeMapKey(value) {
    try {
      return window.MatchCatalog?.normalizeMapKey?.(value) || "";
    } catch (_error) {
      return "";
    }
  }

  function normalizePatchVersion(value) {
    try {
      return window.MatchCatalog?.normalizePatchVersion?.(value) || "";
    } catch (_error) {
      return "";
    }
  }

  function keyToIndex(key) {
    if (/^[1-9]$/.test(key)) return Number(key) - 1;
    if (key === "0") return 9;
    return null;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safe / 60);
    const remainder = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function formatNoteTime(milliseconds) {
    return formatTime(Number(milliseconds) / 1000);
  }

  function normalizeNotes(notes) {
    if (!Array.isArray(notes)) return [];

    return notes
      .map((note) => ({
        id: String(note?.id || createNoteId()),
        matchTimeMs: Number(note?.matchTimeMs),
        text: typeof note?.text === "string" ? note.text.trim() : "",
        createdAt: String(note?.createdAt || ""),
      }))
      .filter((note) => Number.isFinite(note.matchTimeMs) && note.matchTimeMs >= 0 && note.text.length > 0)
      .map((note) => ({
        ...note,
        matchTimeMs: Math.round(note.matchTimeMs),
      }));
  }

  function normalizeMatchId(value) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || id.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) return "";
    return id;
  }

  function normalizeSourceReplayCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(code) ? code : "";
  }

  function createMatchId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createNoteId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function isTypingTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
