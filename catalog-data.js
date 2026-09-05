(() => {
  "use strict";

  const scriptElement = document.currentScript
    || (typeof document.querySelector === "function"
      ? document.querySelector('script[src*="catalog-data.js"]')
      : null);
  const scriptSource = scriptElement?.src || document.baseURI;
  const scriptBaseUrl = new URL("./", scriptSource);
  const STATIC_CATALOG_PATH = new URL("data/matches/index.json", scriptBaseUrl).href;
  const STATIC_MATCH_DIRECTORY = new URL("data/matches/", scriptBaseUrl).href;
  const DEFAULT_PERSPECTIVE_COUNT = 11;

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

  function normalizeMatchId(value) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || id.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) return "";
    return id;
  }

  function normalizeVideoId(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^[\w-]{11}$/.test(raw)) return raw;
    if (/^[\w-]+$/.test(raw)) return raw;

    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtu.be")) return url.pathname.replace(/^\//, "").split("/")[0];
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const embedIndex = url.pathname.indexOf("/embed/");
      if (embedIndex >= 0) return url.pathname.slice(embedIndex + 7).split("/")[0];
      const shortsIndex = url.pathname.indexOf("/shorts/");
      if (shortsIndex >= 0) return url.pathname.slice(shortsIndex + 8).split("/")[0];
    } catch (_error) {
      return raw;
    }
    return raw;
  }

  function normalizeMapKey(value) {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "";
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)) {
      throw new Error("マップの識別子が不正です");
    }
    return key;
  }

  function normalizePatchVersion(value) {
    const version = String(value || "").trim();
    if (!version) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
      throw new Error("パッチバージョンはYYYY-MM-DD形式で入力してください。");
    }

    const date = new Date(`${version}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== version) {
      throw new Error("パッチバージョンの日付が不正です。");
    }
    return version;
  }

  function normalizeReplayCode(value) {
    const code = String(value || "").trim().toUpperCase();
    if (!code) return "";
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      throw new Error("リプレイコードは6文字の英数字で入力してください。");
    }
    return code;
  }

  function normalizePerspective(perspective, index) {
    const source = perspective && typeof perspective === "object" ? perspective : {};
    const fallback = defaultPerspectives[index];
    const rawVideoId = source.youtubeVideoId || source.videoId || source.url || source.sourceUrl || "";
    const videoId = normalizeVideoId(rawVideoId);
    if (rawVideoId && !/^[\w-]{11}$/.test(videoId)) {
      throw new Error(`視点${String(index + 1).padStart(2, "0")}のYouTube動画IDが不正です。`);
    }

    const offsetSeconds = Number(source.offsetSeconds ?? source.offset ?? 0);
    if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > 7200) {
      throw new Error(`視点${String(index + 1).padStart(2, "0")}の補正値が不正です。`);
    }

    return {
      slot: index,
      key: String(source.key || fallback.key),
      name: String(source.name || fallback.name).trim().slice(0, 80) || fallback.name,
      role: String(source.role || fallback.role).trim().slice(0, 30) || fallback.role,
      team: String(source.team || fallback.team).trim().slice(0, 30) || fallback.team,
      youtubeVideoId: videoId,
      offsetSeconds: Math.round(offsetSeconds * 1000) / 1000,
    };
  }

  function normalizeMatch(match) {
    const source = match && typeof match === "object" ? match : {};
    const id = normalizeMatchId(source.id || source.matchId);
    if (!id) throw new Error("試合IDが不正です。");

    const title = String(source.title || "").trim().slice(0, 200);
    if (!title) throw new Error("試合タイトルがありません。");

    if (!Array.isArray(source.perspectives) || source.perspectives.length !== defaultPerspectives.length) {
      throw new Error("11視点分の設定が必要です。");
    }

    const sourceReplayCode = normalizeReplayCode(source.sourceReplayCode || source.replayCode);
    const mapKey = normalizeMapKey(source.mapKey || source.map);
    const patchVersion = normalizePatchVersion(source.patchVersion);
    const perspectives = source.perspectives.map((perspective, index) => normalizePerspective(
      perspective,
      index,
    ));

    return {
      id,
      title,
      sourceReplayCode,
      mapKey,
      patchVersion,
      createdAt: typeof source.createdAt === "string" ? source.createdAt : null,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
      perspectives,
    };
  }

  function summarizeMatch(match, manifestFile = `${match.id}.json`) {
    const videoCount = match.perspectives.filter((perspective) => Boolean(perspective.youtubeVideoId)).length;
    return {
      id: match.id,
      title: match.title,
      sourceReplayCode: match.sourceReplayCode,
      mapKey: match.mapKey,
      patchVersion: match.patchVersion,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      manifestFile,
      perspectiveCount: match.perspectives.length,
      videoCount,
    };
  }

  function normalizeCatalogEntry(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const id = normalizeMatchId(source.id || source.matchId);
    if (!id) throw new Error("試合IDが不正です。");

    const title = String(source.title || "").trim().slice(0, 200);
    if (!title) throw new Error("試合タイトルがありません。");

    const rawManifestFile = String(source.manifestFile || source.matchFile || `${id}.json`).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/i.test(rawManifestFile)) {
      throw new Error(`試合「${title}」のマッチJSONファイル名が不正です。`);
    }

    const perspectiveCount = Number(source.perspectiveCount ?? DEFAULT_PERSPECTIVE_COUNT);
    const videoCount = source.videoCount === undefined || source.videoCount === null
      ? null
      : Number(source.videoCount);

    return {
      id,
      title,
      sourceReplayCode: normalizeReplayCode(source.sourceReplayCode || source.replayCode),
      mapKey: normalizeMapKey(source.mapKey || source.map),
      patchVersion: normalizePatchVersion(source.patchVersion),
      createdAt: typeof source.createdAt === "string" ? source.createdAt : null,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
      manifestFile: rawManifestFile,
      perspectiveCount: Number.isInteger(perspectiveCount) && perspectiveCount > 0
        ? perspectiveCount
        : DEFAULT_PERSPECTIVE_COUNT,
      videoCount: Number.isInteger(videoCount) && videoCount >= 0 ? videoCount : null,
    };
  }

  function normalizeCatalogPayload(payload) {
    const rawMatches = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.matches)
        ? payload.matches
        : payload?.match
          ? [payload.match]
          : null;

    if (!rawMatches) throw new Error("カタログ形式のJSONではありません。");

    const errors = [];
    const matches = rawMatches
      .map((rawMatch, index) => {
        try {
          if (Array.isArray(rawMatch?.perspectives)) {
            const inlineMatch = normalizeMatch(rawMatch);
            return { ...summarizeMatch(inlineMatch), inlineMatch };
          }
          return normalizeCatalogEntry(rawMatch);
        } catch (error) {
          errors.push(`${index + 1}件目: ${error.message}`);
          return null;
        }
      })
      .filter(Boolean);

    const seenIds = new Set();
    const uniqueMatches = matches.filter((match) => {
      if (seenIds.has(match.id)) {
        errors.push(`MATCH ID「${match.id}」が重複しているため、後の試合を除外しました。`);
        return false;
      }
      seenIds.add(match.id);
      return true;
    });

    return { matches: uniqueMatches, errors };
  }

  async function loadCatalog() {
    const response = await fetch(STATIC_CATALOG_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`カタログ一覧を読み込めませんでした（HTTP ${response.status}）。`);

    const staticResult = normalizeCatalogPayload(await response.json());
    return {
      matches: staticResult.matches.slice().sort((first, second) => {
        const firstDate = first.updatedAt || first.createdAt || "";
        const secondDate = second.updatedAt || second.createdAt || "";
        return secondDate.localeCompare(firstDate) || first.title.localeCompare(second.title, "ja");
      }),
      errors: staticResult.errors,
    };
  }

  async function loadMatch(matchId, catalogResult = null) {
    const normalizedId = normalizeMatchId(matchId);
    if (!normalizedId) return null;

    const catalog = catalogResult || await loadCatalog();
    const entry = catalog.matches.find((match) => match.id === normalizedId);
    if (!entry) return null;
    if (entry.inlineMatch) return entry.inlineMatch;

    const response = await fetch(`${STATIC_MATCH_DIRECTORY}${encodeURIComponent(entry.manifestFile)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`試合「${entry.title}」のマッチJSONを読み込めませんでした（HTTP ${response.status}）。`);
    }

    const payload = await response.json();
    const rawMatch = payload?.match && typeof payload.match === "object" ? payload.match : payload;
    const match = normalizeMatch(rawMatch);
    if (match.id !== normalizedId) {
      throw new Error(`マッチJSONのIDが一致しません（${entry.manifestFile}）。`);
    }
    return match;
  }

  function formatDate(value) {
    if (!value) return "日付未設定";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "日付未設定";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.MatchCatalog = {
    normalizeMatch,
    normalizeMatchId,
    normalizeVideoId,
    normalizeMapKey,
    normalizePatchVersion,
    normalizeCatalogEntry,
    loadCatalog,
    loadMatch,
    formatDate,
    escapeHtml,
  };
})();
