#!/usr/bin/env python3
"""Compare a candidate GTFS archive with the repository's bundled snapshot."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile

MAX_ARCHIVE_BYTES = 50_000_000
MAX_UNCOMPRESSED_BYTES = 250_000_000
REQUIRED_FILES = {
    "agency.txt",
    "routes.txt",
    "stops.txt",
    "trips.txt",
    "stop_times.txt",
}
COUNTED_FILES = (
    "agency.txt",
    "routes.txt",
    "stops.txt",
    "trips.txt",
    "stop_times.txt",
    "shapes.txt",
)


class FeedCheckError(ValueError):
    """Raised when an archive cannot be treated as a safe GTFS snapshot."""


def normalize(content: bytes, name: str) -> bytes:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise FeedCheckError(f"{name} is not valid UTF-8") from error
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def load_archive(path: Path) -> tuple[dict[str, bytes], str]:
    if not path.is_file():
        raise FeedCheckError(f"Archive does not exist: {path}")
    if path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise FeedCheckError(f"Archive exceeds {MAX_ARCHIVE_BYTES} bytes: {path}")

    archive_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    files: dict[str, bytes] = {}
    total_size = 0

    try:
        with ZipFile(path) as archive:
            for entry in archive.infolist():
                if entry.is_dir():
                    continue
                name = entry.filename
                parsed = PurePosixPath(name)
                if parsed.name != name or name in {".", ".."}:
                    raise FeedCheckError(f"Archive entry must be a root filename: {name}")
                if not name.endswith(".txt"):
                    continue
                if name in files:
                    raise FeedCheckError(f"Archive contains duplicate entry: {name}")
                total_size += entry.file_size
                if total_size > MAX_UNCOMPRESSED_BYTES:
                    raise FeedCheckError("Archive expands beyond the safe size limit")
                files[name] = normalize(archive.read(entry), name)
    except BadZipFile as error:
        raise FeedCheckError(f"Invalid ZIP archive: {path}") from error

    missing = sorted(REQUIRED_FILES - files.keys())
    if missing:
        raise FeedCheckError(f"Archive is missing required GTFS files: {', '.join(missing)}")
    if "calendar.txt" not in files and "calendar_dates.txt" not in files:
        raise FeedCheckError("Archive must contain calendar.txt or calendar_dates.txt")
    return files, archive_hash


def row_count(content: bytes) -> int:
    rows = list(csv.reader(StringIO(content.decode("utf-8"))))
    return max(0, len(rows) - 1)


def feed_metadata(files: dict[str, bytes]) -> dict[str, str | None]:
    content = files.get("feed_info.txt")
    if content is None:
        return {"version": None, "startDate": None, "endDate": None, "license": None}
    rows = list(csv.DictReader(StringIO(content.decode("utf-8"))))
    first = rows[0] if rows else {}
    return {
        "version": first.get("feed_version"),
        "startDate": first.get("feed_start_date"),
        "endDate": first.get("feed_end_date"),
        "license": first.get("license"),
    }


def summarize(baseline_path: Path, candidate_path: Path, source_url: str) -> dict[str, object]:
    baseline, baseline_hash = load_archive(baseline_path)
    candidate, candidate_hash = load_archive(candidate_path)
    baseline_names = set(baseline)
    candidate_names = set(candidate)
    changed = sorted(
        name for name in baseline_names & candidate_names if baseline[name] != candidate[name]
    )
    added = sorted(candidate_names - baseline_names)
    removed = sorted(baseline_names - candidate_names)

    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "sourceUrl": source_url,
        "changed": bool(added or removed or changed),
        "baseline": {
            "archive": str(baseline_path),
            "sha256": baseline_hash,
            "metadata": feed_metadata(baseline),
            "counts": {name: row_count(baseline[name]) for name in COUNTED_FILES if name in baseline},
        },
        "candidate": {
            "archive": str(candidate_path),
            "sha256": candidate_hash,
            "metadata": feed_metadata(candidate),
            "counts": {name: row_count(candidate[name]) for name in COUNTED_FILES if name in candidate},
        },
        "files": {"added": added, "removed": removed, "changed": changed},
    }


def render_markdown(report: dict[str, object]) -> str:
    baseline = report["baseline"]
    candidate = report["candidate"]
    file_changes = report["files"]
    status = "Update detected" if report["changed"] else "Bundled snapshot matches the candidate"
    lines = [
        "# GTFS freshness report",
        "",
        f"**Status:** {status}",
        "",
        f"Source: {report['sourceUrl']}",
        "",
        "| Snapshot | Version | Coverage | Archive SHA-256 |",
        "|---|---|---|---|",
    ]
    for label, item in (("Bundled", baseline), ("Candidate", candidate)):
        metadata = item["metadata"]
        coverage = f"{metadata['startDate'] or 'unknown'}–{metadata['endDate'] or 'unknown'}"
        lines.append(
            f"| {label} | {metadata['version'] or 'unknown'} | {coverage} | `{item['sha256'][:12]}` |"
        )

    lines.extend(["", "## Record counts", "", "| File | Bundled | Candidate | Delta |", "|---|---:|---:|---:|"])
    count_names = sorted(set(baseline["counts"]) | set(candidate["counts"]))
    for name in count_names:
        before = baseline["counts"].get(name, 0)
        after = candidate["counts"].get(name, 0)
        lines.append(f"| `{name}` | {before:,} | {after:,} | {after - before:+,} |")

    lines.extend(["", "## File changes", ""])
    for label, key in (("Added", "added"), ("Removed", "removed"), ("Changed", "changed")):
        names = file_changes[key]
        lines.append(f"- **{label}:** {', '.join(f'`{name}`' for name in names) if names else 'none'}")
    lines.extend(
        [
            "",
            "This check is read-only. A detected update requires review, attribution preservation, regeneration, and CI before the tracked snapshot changes.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--json", type=Path, required=True, dest="json_output")
    parser.add_argument("--markdown", type=Path, required=True)
    args = parser.parse_args()

    report = summarize(args.baseline, args.candidate, args.source_url)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    args.markdown.write_text(render_markdown(report), encoding="utf-8")
    print("update-detected" if report["changed"] else "snapshot-current")


if __name__ == "__main__":
    main()
