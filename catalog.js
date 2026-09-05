(() => {
  "use strict";

  const state = {
    matches: [],
    query: "",
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    ["catalogCount", "catalogSearch", "catalogStatusMessage", "catalogGrid"]
      .forEach((id) => { elements[id] = document.getElementById(id); });

    elements.catalogSearch.addEventListener("input", () => {
      state.query = elements.catalogSearch.value.trim().toLowerCase();
      render();
    });

    renderLoading();
    if (window.location.protocol === "file:") {
      setStatus("このカタログはfile://では読み込めません。HTTPサーバー経由で http://localhost:4173/catalog.html を開いてください。", true);
      render();
      return;
    }

    await refreshCatalog();
  }

  async function refreshCatalog() {
    try {
      const result = await MatchCatalog.loadCatalog();
      state.matches = result.matches;
      if (result.errors.length) {
        setStatus(`一部のデータを読み込めませんでした。${result.errors.length}件`, true);
      } else {
        setStatus("", false);
      }
      render();
    } catch (error) {
      state.matches = [];
      setStatus(error.message || "カタログを読み込めませんでした。", true);
      render();
    }
  }

  function renderLoading() {
    elements.catalogCount.textContent = "読み込み中";
    elements.catalogGrid.innerHTML = `
      <div class="catalog-empty panel">
        <span class="empty-glyph" aria-hidden="true">◌</span>
        <strong>カタログを読み込んでいます</strong>
        <span>静的マニフェストを確認しています</span>
      </div>
    `;
  }

  function render() {
    const visibleMatches = state.matches.filter(matchesFilter);
    elements.catalogCount.textContent = `${visibleMatches.length}件の試合`;

    if (!visibleMatches.length) {
      elements.catalogGrid.innerHTML = `
        <div class="catalog-empty panel">
          <span class="empty-glyph" aria-hidden="true">＋</span>
          <strong>${state.matches.length ? "条件に合う試合がありません" : "まだ試合が登録されていません"}</strong>
          <span>${state.matches.length ? "検索語を変更してください" : "カタログJSONに試合を登録すると、ここに表示されます"}</span>
        </div>
      `;
      return;
    }

    elements.catalogGrid.innerHTML = visibleMatches.map(renderMatchCard).join("");
  }

  function matchesFilter(match) {
    if (!state.query) return true;

    const map = getMapDisplay(match);
    const haystack = [match.title, match.id, match.sourceReplayCode, match.patchVersion, map.name, match.mapKey]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.query);
  }

  function renderMatchCard(match) {
    const matchHref = `./index.html?matchId=${encodeURIComponent(match.id)}`;
    const replayCode = match.sourceReplayCode ? `CODE ${match.sourceReplayCode}` : "CODE —";
    const perspectiveCount = match.perspectiveCount || 11;
    const videoCount = Number.isInteger(match.videoCount) ? match.videoCount : "—";
    const map = getMapDisplay(match);
    const mapMode = map.mode || "";
    const patch = getPatchDisplay(match);
    const cardClass = map.imageUrl ? "match-card has-map-image" : "match-card";
    const cardStyle = map.imageUrl
      ? ` style="--match-map-image: url('${MatchCatalog.escapeHtml(map.imageUrl)}')"`
      : "";

    return `
      <article class="${cardClass}"${cardStyle}>
        <div class="match-card-topline">
          <span class="match-card-date">${MatchCatalog.formatDate(match.updatedAt || match.createdAt)}</span>
          <span class="match-card-map">
            <span class="match-card-map-label">MAP</span>
            <span class="match-card-map-name">${MatchCatalog.escapeHtml(map.name)}</span>
            ${mapMode ? `<span class="match-card-map-mode">${MatchCatalog.escapeHtml(mapMode)}</span>` : ""}
          </span>
        </div>
        <div class="match-card-heading">
          <h2>${MatchCatalog.escapeHtml(match.title)}</h2>
        </div>
        <div class="match-card-meta">
          <span>${perspectiveCount}視点</span>
          <span>動画 ${videoCount} / ${perspectiveCount}</span>
          <span>${MatchCatalog.escapeHtml(replayCode)}</span>
          ${patch.kind === "current" ? `<span class="match-card-patch-current">PATCH ${MatchCatalog.escapeHtml(formatPatchLabel(patch))}</span>` : ""}
        </div>
        ${renderPatchNotice(patch)}
        <div class="match-card-actions">
          <a class="button button-primary" href="${matchHref}">
            <span>プレイヤーで開く</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </article>
    `;
  }

  function getPatchDisplay(match) {
    if (window.OWPatch?.getStatus) return window.OWPatch.getStatus(match.patchVersion);
    return {
      kind: "unknown",
      version: String(match.patchVersion || "").trim(),
      currentVersion: "",
      currentLabel: "",
      notesUrl: "",
    };
  }

  function formatPatchLabel(patch) {
    return [patch.version, patch.label].filter(Boolean).join(" · ");
  }

  function renderPatchNotice(patch) {
    if (patch.kind === "current") return "";

    const notesLink = patch.notesUrl
      ? `<a href="${MatchCatalog.escapeHtml(patch.notesUrl)}" target="_blank" rel="noreferrer noopener">パッチノート ↗</a>`
      : "";

    if (patch.kind === "outdated") {
      const recordedPatch = formatPatchLabel(patch) || patch.version || "不明";
      const currentPatch = [patch.currentVersion, patch.currentLabel].filter(Boolean).join(" · ") || "未設定";
      return `
        <div class="match-card-patch-warning" role="status">
          <span class="match-card-patch-warning-icon" aria-hidden="true">!</span>
          <span class="match-card-patch-warning-copy">
            <strong>現行パッチと異なります</strong>
            <small>${MatchCatalog.escapeHtml(recordedPatch)} · 最新 ${MatchCatalog.escapeHtml(currentPatch)}</small>
          </span>
          ${notesLink}
        </div>
      `;
    }

    const currentPatch = [patch.currentVersion, patch.currentLabel].filter(Boolean).join(" · ") || "未設定";
    return `
      <div class="match-card-patch-warning is-unknown" role="status">
        <span class="match-card-patch-warning-icon" aria-hidden="true">?</span>
        <span class="match-card-patch-warning-copy">
          <strong>パッチ未確認</strong>
          <small>最新パッチ ${MatchCatalog.escapeHtml(currentPatch)} と比較できません</small>
        </span>
        ${notesLink}
      </div>
    `;
  }

  function getMapDisplay(match) {
    const map = window.OWMaps?.getMap(match.mapKey);
    if (map) return map;
    if (match.mapKey) {
      return {
        name: `未登録マップ (${match.mapKey})`,
        mode: "",
        imageUrl: "",
      };
    }
    return {
      name: "マップ未設定",
      mode: "",
      imageUrl: "",
    };
  }

  function setStatus(message, isError) {
    elements.catalogStatusMessage.textContent = message;
    elements.catalogStatusMessage.classList.toggle("is-error", isError);
  }
})();
