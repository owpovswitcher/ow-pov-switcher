(() => {
  "use strict";

  const CATALOG_FORMAT = "ow-replay-viewer-catalog-index";
  const CATALOG_VERSION = 1;
  const CATALOG_SCOPE = "shared-catalog-index";
  const MATCH_FORMAT = "ow-replay-viewer-match";
  const MATCH_SCOPE = "shared-match";
  const PERSPECTIVE_COUNT = 11;

  const defaultPerspectives = [
    { key: "map", name: "Overview", role: "MAP", team: "WORLD" },
    { key: "p01", name: "Player 01", role: "TANK", team: "ALLY" },
    { key: "p02", name: "Player 02", role: "DPS", team: "ALLY" },
    { key: "p03", name: "Player 03", role: "DPS", team: "ALLY" },
    { key: "p04", name: "Player 04", role: "SUPPORT", team: "ALLY" },
    { key: "p05", name: "Player 05", role: "SUPPORT", team: "ALLY" },
    { key: "p06", name: "Player 06", role: "TANK", team: "ENEMY" },
    { key: "p07", name: "Player 07", role: "DPS", team: "ENEMY" },
    { key: "p08", name: "Player 08", role: "DPS", team: "ENEMY" },
    { key: "p09", name: "Player 09", role: "SUPPORT", team: "ENEMY" },
    { key: "p10", name: "Player 10", role: "SUPPORT", team: "ENEMY" },
  ];

  const state = {
    indexPayload: null,
    indexEntries: [],
    indexDirty: false,
    currentMatch: null,
    createdMatches: [],
    createdMatchIds: new Set(),
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    renderMapOptions();
    renderPatchReference();
    bindEvents();
    startNewMatch();
    renderIndexState();
  }

  function cacheElements() {
    [
      "catalogCount",
      "importIndex",
      "indexFile",
      "indexStatus",
      "builderStatus",
      "createdMatchList",
      "newMatch",
      "matchForm",
      "editorTitle",
      "editorSubline",
      "editorState",
      "matchTitle",
      "matchMap",
      "patchVersion",
      "patchVersionHelp",
      "matchId",
      "regenerateId",
      "sourceReplayCode",
      "videoCoverage",
      "perspectiveEditor",
      "formMessage",
      "matchJsonPreview",
      "indexJsonPreview",
      "downloadIndex",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function renderMapOptions() {
    const maps = window.OWMaps?.list || [{ key: "", name: "マップを選択", mode: "" }];
    elements.matchMap.innerHTML = maps.map((map) => {
      const label = map.mode ? `${map.name} · ${map.mode}` : map.name;
      return `<option value="${escapeAttribute(map.key)}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderPatchReference() {
    if (!elements.patchVersionHelp || !window.OWPatch?.currentVersion) return;
    const label = window.OWPatch.currentLabel ? ` · ${window.OWPatch.currentLabel}` : "";
    elements.patchVersionHelp.textContent = `公式パッチノートの日付（YYYY-MM-DD）。現在の基準: ${window.OWPatch.currentVersion}${label}。未入力の場合はカタログで「パッチ未確認」と表示します。`;
  }

  function bindEvents() {
    elements.importIndex.addEventListener("click", () => elements.indexFile.click());
    elements.indexFile.addEventListener("change", handleIndexFile);
    elements.newMatch.addEventListener("click", startNewMatch);
    elements.matchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveCurrentMatch();
    });
    elements.regenerateId.addEventListener("click", () => {
      elements.matchId.value = createMatchId();
      setFormMessage("新しいMATCH IDを生成しました。", false);
    });
    elements.downloadIndex.addEventListener("click", downloadIndexFile);
    elements.perspectiveEditor.addEventListener("input", updateVideoCoverage);
    elements.perspectiveEditor.addEventListener("change", updateVideoCoverage);
  }

  async function handleIndexFile(event) {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const normalized = normalizeIndexPayload(payload);
      state.indexPayload = normalized;
      state.indexEntries = normalized.matches.slice();
      state.indexDirty = false;
      state.createdMatches = [];
      state.createdMatchIds.clear();
      renderIndexState();
      setFormMessage("");
      setStatus(`${file.name} を読み込みました。新しい試合を追加できます。`, false);
    } catch (error) {
      setFormMessage(error.message || "index.jsonを読み込めませんでした。", true);
      setStatus("index.jsonの読み込みに失敗しました。", true);
    }
  }

  function normalizeIndexPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("IndexファイルのJSONオブジェクトを読み込んでください。");
    }
    if (payload.format !== CATALOG_FORMAT) {
      throw new Error("このファイルはOW Replay ViewerのIndex形式ではありません。");
    }
    if (!Array.isArray(payload.matches)) {
      throw new Error("Indexファイルに matches 配列がありません。");
    }

    const seenIds = new Set();
    const matches = payload.matches.map((entry, index) => {
      const normalized = window.MatchCatalog.normalizeCatalogEntry(entry);
      if (seenIds.has(normalized.id)) {
        throw new Error(`Index内でMATCH IDが重複しています（${normalized.id}）。${index + 1}件目を確認してください。`);
      }
      seenIds.add(normalized.id);
      return normalized;
    });

    return {
      format: CATALOG_FORMAT,
      version: Number(payload.version) || CATALOG_VERSION,
      scope: payload.scope || CATALOG_SCOPE,
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
      matches,
    };
  }

  function startNewMatch() {
    state.currentMatch = createBlankMatch();
    renderEditor(state.currentMatch);
    setFormMessage("");
    if (state.indexPayload) {
      setStatus("新しい試合を入力しています。保存すると試合JSONだけをダウンロードします。", false);
    } else {
      setStatus("先にindex.jsonを読み込んでください。", false);
    }
  }

  function renderEditor(match) {
    elements.editorTitle.textContent = match.title || "新しい試合";
    elements.editorSubline.textContent = state.createdMatchIds.has(match.id)
      ? "このセッションで追加した試合を再編集できます。"
      : "index.jsonへ追加する新しい試合情報を入力します。";
    elements.editorState.textContent = state.createdMatchIds.has(match.id) ? "SAVED" : "NEW";
    elements.matchTitle.value = match.title || "";
    elements.matchMap.value = match.mapKey || "";
    elements.patchVersion.value = match.patchVersion || "";
    elements.matchId.value = match.id || "";
    elements.sourceReplayCode.value = match.sourceReplayCode || "";
    renderPerspectiveInputs(match.perspectives || []);
    updateVideoCoverage();
    renderMatchPreview(match && state.createdMatchIds.has(match.id) ? match : null);
  }

  function renderPerspectiveInputs(perspectives) {
    const byKey = new Map((perspectives || []).map((perspective) => [perspective.key, perspective]));
    elements.perspectiveEditor.innerHTML = defaultPerspectives.map((definition, index) => {
      const perspective = byKey.get(definition.key) || {};
      const value = perspective.youtubeVideoId || "";
      const label = index === 0 ? "全体視点" : `${definition.name} · ${definition.role}`;
      return `
        <label class="builder-perspective-row">
          <span class="builder-perspective-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="builder-perspective-meta">
            <strong>${escapeHtml(label)}</strong>
            <small>${escapeHtml(definition.team)}</small>
          </span>
          <input data-perspective-input="${escapeAttribute(definition.key)}" class="text-input builder-mono-input" type="text" maxlength="200" placeholder="https://youtu.be/..." value="${escapeAttribute(value)}" autocomplete="off" />
        </label>
      `;
    }).join("");
  }

  function updateVideoCoverage() {
    const inputs = [...elements.perspectiveEditor.querySelectorAll("[data-perspective-input]")];
    const count = inputs.filter((input) => input.value.trim()).length;
    elements.videoCoverage.textContent = `動画 ${count} / ${PERSPECTIVE_COUNT}`;
  }

  function saveCurrentMatch() {
    if (!state.indexPayload) {
      setFormMessage("先にindex.jsonを読み込んでください。", true);
      setStatus("index.jsonが読み込まれていないため、保存できません。", true);
      return;
    }

    try {
      const match = readMatchFromForm();
      const existingEntry = state.indexEntries.find((entry) => entry.id === match.id);
      const isCurrentSessionMatch = state.createdMatchIds.has(match.id);

      if (existingEntry && !isCurrentSessionMatch) {
        throw new Error("このMATCH IDはIndexに登録済みです。新しい試合には別のIDを使用してください。");
      }

      const matchFile = createMatchFile(match);
      downloadTextFile(matchFile.name, matchFile.text);

      upsertIndexEntry(summarizeMatch(match));
      state.createdMatchIds.add(match.id);
      upsertCreatedMatch(match);
      state.currentMatch = match;
      state.indexDirty = true;

      renderEditor(match);
      renderIndexState();
      setFormMessage(`試合JSONをダウンロードしました: ${matchFile.name}。index.jsonは別にダウンロードしてください。`, false);
      setStatus(`試合JSON ${matchFile.name} をダウンロードしました。`, false);
    } catch (error) {
      setFormMessage(error.message || "試合JSONを作成できませんでした。", true);
      setStatus("試合JSONの作成に失敗しました。", true);
    }
  }

  function readMatchFromForm() {
    const perspectives = [...elements.perspectiveEditor.querySelectorAll("[data-perspective-input]")].map((input, index) => {
      const definition = defaultPerspectives[index];
      return {
        slot: index + 1,
        key: definition.key,
        name: definition.name,
        role: definition.role,
        team: definition.team,
        youtubeVideoId: input.value.trim(),
      };
    });

    const now = nowIso();
    const candidate = {
      id: elements.matchId.value.trim(),
      title: elements.matchTitle.value.trim(),
      mapKey: elements.matchMap.value,
      patchVersion: elements.patchVersion.value,
      sourceReplayCode: elements.sourceReplayCode.value.trim(),
      createdAt: state.currentMatch?.createdAt || now,
      updatedAt: now,
      perspectives,
    };

    if (!candidate.id) throw new Error("MATCH IDがありません。再生成してください。");
    if (!candidate.title) throw new Error("試合タイトルを入力してください。");
    if (!candidate.mapKey) throw new Error("マップを選択してください。");
    if (!window.MatchCatalog?.normalizeMatch) throw new Error("JSON定義を読み込めませんでした。");

    return window.MatchCatalog.normalizeMatch(candidate);
  }

  function createMatchFile(match) {
    const payload = {
      format: MATCH_FORMAT,
      version: CATALOG_VERSION,
      scope: MATCH_SCOPE,
      match,
    };
    return {
      name: `${match.id}.json`,
      payload,
      text: `${JSON.stringify(payload, null, 2)}\n`,
    };
  }

  function summarizeMatch(match) {
    const perspectives = Array.isArray(match.perspectives) ? match.perspectives : [];
    return window.MatchCatalog.normalizeCatalogEntry({
      id: match.id,
      title: match.title,
      mapKey: match.mapKey,
      patchVersion: match.patchVersion,
      sourceReplayCode: match.sourceReplayCode || null,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      manifestFile: `${match.id}.json`,
      perspectiveCount: perspectives.length,
      videoCount: perspectives.filter((perspective) => perspective.youtubeVideoId).length,
    });
  }

  function upsertIndexEntry(entry) {
    const index = state.indexEntries.findIndex((candidate) => candidate.id === entry.id);
    if (index === -1) {
      state.indexEntries.push(entry);
    } else {
      state.indexEntries[index] = entry;
    }
  }

  function upsertCreatedMatch(match) {
    const index = state.createdMatches.findIndex((candidate) => candidate.id === match.id);
    if (index === -1) {
      state.createdMatches.push(match);
    } else {
      state.createdMatches[index] = match;
    }
  }

  function buildIndexPayload() {
    return {
      format: state.indexPayload.format,
      version: state.indexPayload.version,
      scope: state.indexPayload.scope,
      updatedAt: state.indexDirty ? nowIso() : (state.indexPayload.updatedAt || nowIso()),
      matches: state.indexEntries,
    };
  }

  function downloadIndexFile() {
    if (!state.indexPayload) {
      setStatus("先にindex.jsonを読み込んでください。", true);
      return;
    }
    if (!state.indexDirty) {
      setStatus("Indexに追加された試合がありません。", false);
      return;
    }

    const payload = buildIndexPayload();
    downloadTextFile("index.json", `${JSON.stringify(payload, null, 2)}\n`);
    state.indexPayload = { ...state.indexPayload, updatedAt: payload.updatedAt, matches: state.indexEntries.slice() };
    state.indexDirty = false;
    renderIndexState();
    setStatus("更新した index.json をダウンロードしました。", false);
  }

  function renderIndexState() {
    const hasIndex = Boolean(state.indexPayload);
    const count = state.indexEntries.length;
    elements.catalogCount.textContent = hasIndex ? `${count}試合` : "index.json未読込";
    elements.indexStatus.textContent = !hasIndex
      ? "index.json未読込み — 最初にファイルを選択してください。"
      : state.indexDirty
        ? `index.json読込済み · ${count}試合 · 未保存の追加 ${state.createdMatches.length}件`
        : `index.json読込済み · ${count}試合 · 変更なし`;
    elements.downloadIndex.disabled = !hasIndex || !state.indexDirty;
    elements.indexJsonPreview.textContent = hasIndex
      ? `${JSON.stringify(buildIndexPayload(), null, 2)}\n`
      : "index.jsonを読み込むと、ここに更新後のindex.jsonを表示します。";
    renderCreatedMatchList();
  }

  function renderCreatedMatchList() {
    if (!state.createdMatches.length) {
      elements.createdMatchList.innerHTML = `<p class="builder-empty-list">このセッションで追加した試合はありません。</p>`;
      return;
    }

    elements.createdMatchList.innerHTML = state.createdMatches.map((match) => `
      <div class="builder-created-match">
        <strong>${escapeHtml(match.title)}</strong>
        <code>${escapeHtml(match.id)}.json</code>
        <span>試合JSONをダウンロード済み</span>
      </div>
    `).join("");
  }

  function renderMatchPreview(match) {
    if (!match || !state.createdMatchIds.has(match.id)) {
      elements.matchJsonPreview.textContent = "試合JSONを保存すると、ここに今回のファイル内容を表示します。";
      return;
    }
    elements.matchJsonPreview.textContent = `${JSON.stringify(createMatchFile(match).payload, null, 2)}\n`;
  }

  function createBlankMatch() {
    const timestamp = nowIso();
    return {
      id: createMatchId(),
      title: "",
      mapKey: "",
      patchVersion: "",
      sourceReplayCode: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      perspectives: defaultPerspectives.map((perspective, index) => ({
        slot: index + 1,
        key: perspective.key,
        name: perspective.name,
        role: perspective.role,
        team: perspective.team,
        youtubeVideoId: "",
      })),
    };
  }

  function createMatchId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      const value = character === "x" ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function downloadTextFile(name, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove?.();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setStatus(message, isError) {
    elements.builderStatus.textContent = message;
    elements.builderStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setFormMessage(message, isError) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle("is-error", Boolean(isError));
  }

  function escapeHtml(value) {
    return String(value ?? "")
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
