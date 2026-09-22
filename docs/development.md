# Development and packaging

Development requires Bun 1.3.1+ and Python 3.10+. There are no third-party runtime packages or install scripts. `package.json` is intentionally private: distribution is a Claude plugin, not an npm package. Claude provides the `claude-code` hook types/runtime; tests erase type-only imports. Do not install an unrelated package of that name to satisfy types.

```sh
bun test ./tests
python3 scripts/test_package.py
bun scripts/example.ts --check
python3 scripts/package.py --check
python3 scripts/package.py --output dist
```

The first commands are offline and use synthetic data. Package generation writes a versioned ZIP and SHA-256 inventory under a new output directory; it refuses overwrite. The ZIP contains the same reviewed public tree, with no build step needed to load hooks. Load its extracted root or ZIP using Claude's `--plugin-dir` option, or add the extracted root as a local marketplace.

## Publication boundary

`public-files.json` lists every allowed public file. `.gitignore` is generated from that list and defaults to ignoring everything else. Historical scripts/reports and `lab/` remain local. The package checker rejects missing files, path traversal, symlinks, unsafe names, a mismatched manifest/default configuration, broken relative Markdown links, undeclared runtime modules, and any actual environment credential it finds. This is a bounded check, not comprehensive secret detection or a security audit.

To add a public file, review it, add its exact relative path to the list, then run `python3 scripts/package.py --sync-ignore` and the checks. Never use `git add -f` for private material. Git ignore does not remove already-tracked files; when preparing publication, verify that every tracked path belongs to the allowed list and that Git history contains no private data.

The checker requires the example to use the exact current evaluator prompt. Regenerate it with `bun scripts/example.ts` after a deliberate prompt change; keep its messages synthetic. Runtime behavior, prompt changes and fresh quality evaluation are separate from package preparation.

## Release verification

Validate both manifests with the tested CLI:

```sh
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```

The release-preparation checks cover the staged snapshot, archive extraction, unit tests from extracted files, and isolated-profile installation/command registration. Those checks make no paid model requests. A schema pass alone does not prove that experimental hooks execute. GitHub publication must be followed by a new-profile install from the actual public URL; do not reuse a local-path success as that proof.
