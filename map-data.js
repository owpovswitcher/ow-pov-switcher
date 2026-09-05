(() => {
  "use strict";

  const maps = [
    { key: "", name: "マップを選択", mode: "", imageUrl: "", sourceUrl: "" },

    { key: "midtown", name: "Midtown", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt32ee2e586ba508c5/62298aff9485354f9b460bd0/midtown_screenshot_01.png", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/midtown-screenshot-001/" },
    { key: "new-queen-street", name: "New Queen Street", mode: "PUSH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt702c5a0a442b5d69/62298ab6e47e3d2eff2101be/new-queen-street_screenshot_01_thumb.png", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/newqueenstreet-screenshot-001/" },
    { key: "colosseo", name: "Colosseo", mode: "PUSH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt936abd4cd2e98231/62298aff04503350d255bce8/colosseo_screenshot_01.png", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/colosseo-screenshot-001/" },
    { key: "circuit-royal", name: "Circuit Royal", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt81bc002795797cb2/62298aff91f4232f0085d406/circuit-royal_screenshot_01.png", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/circuit-royal-screenshot-001/" },

    { key: "busan", name: "Busan", mode: "CONTROL", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt898d79b7cb93ff52/5cef226b425980470abca5ad/busan-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/busan-screenshot-001/" },
    { key: "ilios", name: "Ilios", mode: "CONTROL", imageUrl: "", sourceUrl: "" },
    { key: "lijiang-tower", name: "Lijiang Tower", mode: "CONTROL", imageUrl: "", sourceUrl: "" },
    { key: "nepal", name: "Nepal", mode: "CONTROL", imageUrl: "", sourceUrl: "" },
    { key: "oasis", name: "Oasis", mode: "CONTROL", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt28a85ae16eedc261/5cf15deda812cef409149b26/oasis-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/oasis-screenshot-001/" },
    { key: "samoa", name: "Samoa", mode: "CONTROL", imageUrl: "", sourceUrl: "" },
    { key: "antarctic-peninsula", name: "Antarctic Peninsula", mode: "CONTROL", imageUrl: "", sourceUrl: "" },

    { key: "dorado", name: "Dorado", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltbd2cb20e96673878/5cef227372eb37ee09921a16/dorado-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/dorado-screenshot-001/" },
    { key: "junkertown", name: "Junkertown", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt8a381f93b24a3780/5cef22b4cf7aa6330ac66573/junkertown-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/junkertown-screenshot-001/" },
    { key: "rialto", name: "Rialto", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt205497d1e312c614/5cef22e47b48be290a7f884e/rialto-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/rialto-screenshot-001/" },
    { key: "route-66", name: "Route 66", mode: "ESCORT", imageUrl: "", sourceUrl: "" },
    { key: "watchpoint-gibraltar", name: "Watchpoint: Gibraltar", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt83168a5b8e6eb0bc/5cef229672eb37ee09921a22/gibraltar-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/gibraltar-screenshot-001/" },
    { key: "havana", name: "Havana", mode: "ESCORT", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt5d4dfc8105f56852/5cef22ab578308e4094573fa/havana-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/havana-screenshot-001/" },
    { key: "shambali-monastery", name: "Shambali Monastery", mode: "ESCORT", imageUrl: "", sourceUrl: "" },

    { key: "eichenwalde", name: "Eichenwalde", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blteea67a2c7473f74e/5cef227a486d1c3d0af723d6/eichenwalde-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/eichenwalde-screenshot-001/" },
    { key: "hollywood", name: "Hollywood", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltef45617888ec27e7/5cef22b472eb37ee09921a34/hollywood-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/hollywood-screenshot-001/" },
    { key: "kings-row", name: "King's Row", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltd708bb168c584d9e/5cef22bc425980470abca5d7/kings-row-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/kings-row-screenshot-001/" },
    { key: "numbani", name: "Numbani", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt01eebe81ef1321d6/5cef22cd486d1c3d0af72404/numbani-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/numbani-screenshot-001/" },
    { key: "blizzard-world", name: "Blizzard World", mode: "HYBRID", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltbc50eba1da1b9318/5cf19e1a425980470abcaaf1/blizzardworld-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/blizzardworld-screenshot-001/" },
    { key: "paraiso", name: "Paraíso", mode: "HYBRID", imageUrl: "", sourceUrl: "" },

    { key: "esperanca", name: "Esperança", mode: "PUSH", imageUrl: "", sourceUrl: "" },
    { key: "runasapi", name: "Runasapi", mode: "PUSH", imageUrl: "", sourceUrl: "" },
    { key: "suravasa", name: "Suravasa", mode: "FLASHPOINT", imageUrl: "", sourceUrl: "" },
    { key: "new-junk-city", name: "New Junk City", mode: "FLASHPOINT", imageUrl: "", sourceUrl: "" },
    { key: "hanaoka", name: "Hanaoka", mode: "CLASH", imageUrl: "", sourceUrl: "" },
    { key: "throne-of-anubis", name: "Throne of Anubis", mode: "CLASH", imageUrl: "", sourceUrl: "" },

    { key: "malevento", name: "Malevento", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltbea126587c7e7848/610314752285fc502f305d8a/malevento-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/malevento-screenshot-001/" },
    { key: "kanezaka", name: "Kanezaka", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltdbe05870c07cc41f/5ff79aa7ac5b7f11814f8777/kanezaka-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/kanezaka-screenshot-001/" },
    { key: "petra", name: "Petra", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt109fc4191cdf0ff8/5cef22dd4e4776020a334035/petra-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/petra-screenshot-001/" },
    { key: "ayutthaya", name: "Ayutthaya", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt3fa6a828639a259a/5cef225acf7aa6330ac66537/ayutthaya-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/ayutthaya-screenshot-001/" },
    { key: "paris", name: "Paris", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt51d3bd01ec36234a/5cef22dd7b48be290a7f8848/paris-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/paris-screenshot-001/" },
    { key: "chateau-guillard", name: "Château Guillard", mode: "DEATHMATCH", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltb7fc707a759f9b6f/5cef226b578308e4094573dc/chateau-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/chateau-screenshot-001/" },
    { key: "hanamura", name: "Hanamura", mode: "ASSAULT / ARCADE", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt97fbc264d47f2e78/5cef22ab7b48be290a7f8812/hanamura-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/hanamura-screenshot-001/" },
    { key: "temple-of-anubis", name: "Temple of Anubis", mode: "ASSAULT / ARCADE", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt35fa962b31e40571/5cef22f74e4776020a334059/temple-of-anubis-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/temple-of-anubis-screenshot-001/" },
    { key: "volskaya-industries", name: "Volskaya Industries", mode: "ASSAULT / ARCADE", imageUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltf378cfd4cc14ec72/5cef2312425980470abca619/volskaya-screenshot-001.jpg", sourceUrl: "https://overwatch.blizzard.com/en-us/media/image/volskaya-screenshot-001/" },
  ].map((map) => Object.freeze(map));

  const mapsByKey = new Map(maps.map((map) => [map.key, map]));

  function normalizeMapKey(value) {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "";
    return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(key) ? key : "";
  }

  function getMap(value) {
    const key = normalizeMapKey(value);
    if (!key) return null;
    return mapsByKey.get(key) || null;
  }

  window.OWMaps = Object.freeze({
    list: Object.freeze(maps),
    normalizeMapKey,
    getMap,
  });
})();
