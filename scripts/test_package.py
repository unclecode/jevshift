"""Publication-boundary tests. Synthetic files only; no network or inference."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import uuid
import zipfile

spec = importlib.util.spec_from_file_location('package_builder', Path(__file__).with_name('package.py'))
pkg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pkg)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        for name in pkg.public_files(pkg.ROOT):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((pkg.ROOT / name).read_bytes())

    def test_private_and_unlisted_files_excluded_and_reproducible(self):
        sentinel = 'private-' + uuid.uuid4().hex
        (self.root / 'lab').mkdir()
        (self.root / 'lab/private.jsonl').write_text(sentinel)
        (self.root / '.env').write_text(sentinel)
        (self.root / 'docs/unreviewed.md').write_text(sentinel)
        a = pkg.build(self.root, Path(self.temp.name) / 'first')
        b = pkg.build(self.root, Path(self.temp.name) / 'second')
        self.assertEqual(a['sha256'], b['sha256'])
        with zipfile.ZipFile(Path(self.temp.name) / 'first' / a['archive']) as z:
            self.assertEqual(set(z.namelist()), {'jevshift/' + name for name in pkg.public_files(self.root)})
            self.assertTrue(all(sentinel.encode() not in z.read(name) for name in z.namelist()))
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            pkg.build(self.root, Path(self.temp.name) / 'first')

    def test_external_symlink_refused(self):
        external = Path(self.temp.name) / 'outside';external.write_text('private')
        target = self.root / 'README.md';target.unlink();target.symlink_to(external)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            pkg.validate(self.root)

    def test_unsafe_public_path_refused(self):
        p = self.root / 'public-files.json';names = json.loads(p.read_text())
        p.write_text(json.dumps(sorted(names + ['../outside.txt'])))
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            pkg.validate(self.root)

    def test_invalid_configuration_and_missing_dependency_refused(self):
        p = self.root / '.claude-plugin/plugin.json';manifest = json.loads(p.read_text())
        manifest['userConfig']['experimental_auto']['default'] = True
        p.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Unsafe default'):
            pkg.validate(self.root)
        p.write_bytes((pkg.ROOT / '.claude-plugin/plugin.json').read_bytes())
        (self.root / 'src/jev.ts').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing'):
            pkg.validate(self.root)


if __name__ == '__main__':
    unittest.main()
