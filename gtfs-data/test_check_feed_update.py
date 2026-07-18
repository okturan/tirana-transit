import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from check_feed_update import COUNTED_FILES, FeedCheckError, feed_metadata, load_archive, row_count, summarize


class FeedUpdateCheckTest(unittest.TestCase):
    def setUp(self):
        self.baseline = Path(__file__).with_name("gtfs.zip")

    def test_bundled_archive_matches_itself(self):
        report = summarize(self.baseline, self.baseline, "https://example.invalid/gtfs.zip")

        self.assertFalse(report["changed"])
        self.assertEqual("0.2.0", report["baseline"]["metadata"]["version"])
        self.assertEqual(27, report["baseline"]["counts"]["routes.txt"])
        self.assertEqual(490, report["baseline"]["counts"]["stops.txt"])

    def test_snapshot_manifest_matches_bundled_archive(self):
        manifest_path = Path(__file__).with_name("snapshot-manifest.json")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files, archive_hash = load_archive(self.baseline)
        metadata = feed_metadata(files)

        self.assertEqual(archive_hash, manifest["archiveSha256"])
        self.assertEqual(metadata["version"], manifest["feed"]["version"])
        self.assertEqual(metadata["startDate"], manifest["feed"]["startDate"])
        self.assertEqual(metadata["endDate"], manifest["feed"]["endDate"])
        self.assertEqual(metadata["license"], manifest["feed"]["license"])
        self.assertEqual(
            {name: row_count(files[name]) for name in COUNTED_FILES},
            manifest["records"],
        )

    def test_reports_a_changed_feed_version(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / "candidate.zip"
            with ZipFile(self.baseline) as source, ZipFile(candidate, "w", ZIP_DEFLATED) as target:
                for entry in source.infolist():
                    content = source.read(entry)
                    if entry.filename == "feed_info.txt":
                        content = content.replace(b",0.2.0,", b",0.3.0,")
                    target.writestr(entry.filename, content)

            report = summarize(self.baseline, candidate, "https://example.invalid/gtfs.zip")

        self.assertTrue(report["changed"])
        self.assertEqual("0.3.0", report["candidate"]["metadata"]["version"])
        self.assertEqual(["feed_info.txt"], report["files"]["changed"])

    def test_rejects_archive_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / "unsafe.zip"
            with ZipFile(candidate, "w", ZIP_DEFLATED) as archive:
                archive.writestr("../routes.txt", "route_id\n1\n")

            with self.assertRaisesRegex(FeedCheckError, "root filename"):
                load_archive(candidate)


if __name__ == "__main__":
    unittest.main()
