(() => {
  "use strict";

  // The public site is intentionally static, so this value is the single
  // manually maintained reference used to identify the current replay patch.
  // Overwatch's public patch notes are date-labelled rather than exposing a
  // stable numeric build identifier in this catalog.
  const CURRENT_PATCH_VERSION = "2026-08-20";
  const PATCH_NOTES_URL = "https://overwatch.blizzard.com/en-us/news/patch-notes/";

  const knownPatches = [
    { version: "2026-08-20", label: "Hotfix" },
    { version: "2026-08-19", label: "Client update" },
    { version: "2026-08-14", label: "Hotfix" },
    { version: "2026-08-11", label: "Season 4: Heroes of Busan" },
    { version: "2026-06-30", label: "Community Crafted" },
    { version: "2026-04-14", label: "Season 2: Summit" },
  ];

  function normalizePatchVersion(value) {
    return String(value || "").trim();
  }

  function getPatchLabel(version) {
    const patch = knownPatches.find((item) => item.version === version);
    return patch?.label || "";
  }

  function getStatus(value) {
    const version = normalizePatchVersion(value);
    const currentLabel = getPatchLabel(CURRENT_PATCH_VERSION);

    if (!version) {
      return {
        kind: "unknown",
        version: "",
        currentVersion: CURRENT_PATCH_VERSION,
        currentLabel,
        notesUrl: PATCH_NOTES_URL,
      };
    }

    if (version === CURRENT_PATCH_VERSION) {
      return {
        kind: "current",
        version,
        label: getPatchLabel(version),
        currentVersion: CURRENT_PATCH_VERSION,
        currentLabel,
        notesUrl: PATCH_NOTES_URL,
      };
    }

    return {
      kind: "outdated",
      version,
      label: getPatchLabel(version),
      currentVersion: CURRENT_PATCH_VERSION,
      currentLabel,
      notesUrl: PATCH_NOTES_URL,
    };
  }

  window.OWPatch = {
    currentVersion: CURRENT_PATCH_VERSION,
    currentLabel: getPatchLabel(CURRENT_PATCH_VERSION),
    notesUrl: PATCH_NOTES_URL,
    knownPatches: Object.freeze(knownPatches),
    normalizePatchVersion,
    getStatus,
  };
})();
