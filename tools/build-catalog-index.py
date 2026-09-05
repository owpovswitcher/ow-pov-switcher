#!/usr/bin/env python3
"""Build the public catalog index from one JSON manifest per match."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


MATCH_FORMAT = "ow-replay-viewer-match"
CATALOG_FORMAT = "ow-replay-viewer-catalog-index"
CATALOG_VERSION = 1
CATALOG_SCOPE = "shared-catalog-index"
EXPECTED_PERSPECTIVES = 11


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_match(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{path.name}: JSONを読み込めません: {error}") from error

    if not isinstance(payload, dict) or payload.get("format") != MATCH_FORMAT or not isinstance(payload.get("match"), dict):
        raise ValueError(f"{path.name}: マッチJSON形式ではありません")

    match = payload["match"]
    match_id = str(match.get("id") or "").strip()
    if not match_id or match_id != path.stem or not match_id.replace("-", "").replace("_", "").isalnum():
        raise ValueError(f"{path.name}: ファイル名とMATCH IDが一致しません")

    title = str(match.get("title") or "").strip()
    if not title:
        raise ValueError(f"{path.name}: 試合タイトルがありません")

    perspectives = match.get("perspectives")
    if not isinstance(perspectives, list) or len(perspectives) != EXPECTED_PERSPECTIVES:
        raise ValueError(f"{path.name}: {EXPECTED_PERSPECTIVES}視点分の設定が必要です")

    map_key = str(match.get("mapKey") or "").strip().lower()
    if map_key and not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", map_key):
        raise ValueError(f"{path.name}: mapKeyが不正です")

    patch_version = str(match.get("patchVersion") or "").strip()
    if patch_version:
        try:
            datetime.strptime(patch_version, "%Y-%m-%d")
        except ValueError as error:
            raise ValueError(f"{path.name}: patchVersionはYYYY-MM-DD形式で入力してください") from error

    video_count = sum(bool(item.get("youtubeVideoId")) for item in perspectives if isinstance(item, dict))
    return {
        "id": match_id,
        "title": title,
        "mapKey": map_key or None,
        "patchVersion": patch_version or None,
        "sourceReplayCode": match.get("sourceReplayCode") or None,
        "createdAt": match.get("createdAt") if isinstance(match.get("createdAt"), str) else None,
        "updatedAt": match.get("updatedAt") if isinstance(match.get("updatedAt"), str) else None,
        "manifestFile": path.name,
        "perspectiveCount": len(perspectives),
        "videoCount": video_count,
    }


def build_index(input_dir: Path) -> dict:
    match_files = sorted(path for path in input_dir.glob("*.json") if path.name != "index.json")
    entries = [load_match(path) for path in match_files]

    seen_ids: set[str] = set()
    for entry in entries:
        if entry["id"] in seen_ids:
            raise ValueError(f"MATCH IDが重複しています: {entry['id']}")
        seen_ids.add(entry["id"])

    timestamps = [entry["updatedAt"] or entry["createdAt"] for entry in entries]
    timestamps = [value for value in timestamps if value]
    updated_at = max(timestamps) if timestamps else now_iso()
    return {
        "format": CATALOG_FORMAT,
        "version": CATALOG_VERSION,
        "scope": CATALOG_SCOPE,
        "updatedAt": updated_at,
        "matches": entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="マッチJSONを含むディレクトリ")
    parser.add_argument("--output", type=Path, required=True, help="生成するindex.jsonのパス")
    args = parser.parse_args()

    input_dir = args.input.resolve()
    output_path = args.output.resolve()
    if not input_dir.is_dir():
        print(f"入力ディレクトリがありません: {input_dir}", file=sys.stderr)
        return 1

    try:
        payload = build_index(input_dir)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    except OSError as error:
        print(f"カタログ一覧を書き出せません: {error}", file=sys.stderr)
        return 1

    print(f"Generated {output_path} ({len(payload['matches'])} matches)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
