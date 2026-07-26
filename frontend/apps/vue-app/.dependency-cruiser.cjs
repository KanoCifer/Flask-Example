// @ts-check
// Deep-module enforcement for dependency-cruiser (frontend).
//
// ALL top-level directories under src/ are deep modules: each package's PUBLIC
// SURFACE is its entry points — the files at the package root. Implementation
// lives in SUBFOLDERS (api/, components/, composables/, stores/, lib/, ...) and
// is private. Packages reach each other only through entry points.
//
// Packages: features/<name>/, components/, lib/.
//
// Severity is 'error'. The migration from the old features-only model (which
// counted 507 violations) to this full model is tracked under spec task-101 /
// task-102, which add shared to the package list and clear
// the resulting deep-import violations package-by-package.
//
// lib/ is the infrastructure layer (request / auth / dayjs / websocket):
// framework-agnostic core for all infra concerns.

/** Packages root, relative to this config file (frontend/). */
const PACKAGES_ROOT = 'src';

/**
 * Deep-module packages under src/. Each entry is a directory whose ROOT FILES
 * are entry points and whose SUBFOLDERS are private internals.
 */
const PACKAGES = [
  'components',
  'features/analytics',
  'features/auth',
  'features/blog',
  'features/books',
  'features/changelog',
  'features/color',
  'features/device',
  'features/entry',
  'features/fishing',
  'features/friend-links',
  'features/moments',
  'features/pages',
  'features/pic',
  'features/rss',
  'features/status',
  'features/subscription',
  'features/todos',
  'features/toolbox',
  'features/websites',
  'lib',
];

// --- derived patterns (no need to edit) -------------------------------------
const R = PACKAGES_ROOT;
// Escape "/" in package paths (e.g. "features/auth") for use in regex.
const PKG = PACKAGES.map((p) => p.replace(/\//g, '\\/')).join('|');

/**
 * A package's private internals: anything nested inside a package subfolder.
 * Root files are entry points and are NOT matched here. $1 = full package path
 * (e.g. "features/auth").
 */
const PACKAGE_INTERNALS = `^${R}/(${PKG})\\/[^/]+/`;

/** Inside a package ($1 = full package path). */
const IN_PACKAGES = `^${R}/(${PKG})\\/`;

/** A package's __tests__/ folder ($1 = full package path). */
const PACKAGE_TESTS = `^${R}/(${PKG})\\/__tests__/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'entrypoint-boundary-from-app',
      comment:
        "Shared infra / app code may import a package's entry points (its root files), but nothing inside its subfolders.",
      severity: 'error',
      // importer is NOT inside any package (shared infra, root, other features'
      // tests handled separately)
      from: { pathNot: IN_PACKAGES },
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: 'entrypoint-boundary-across-packages',
      comment:
        'Packages reach each other only through entry points — never through internals. Intra-package imports are free.',
      severity: 'error',
      // importer is inside a package ($1), but not a test file
      from: { path: IN_PACKAGES, pathNot: PACKAGE_TESTS },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/`, // same package → intra-package freedom
      },
    },
    {
      name: 'tests-through-entrypoints',
      comment:
        "A package's tests exercise it through its entry points like everyone else: they may import any package's entry points and their own __tests__/ fixtures, but never any package's internals — not even their own.",
      severity: 'error',
      from: { path: PACKAGE_TESTS }, // a test file, in package $1
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/__tests__/`, // own __tests__/ fixtures → allowed
      },
    },
    {
      name: 'tests-folder-is-private',
      comment:
        "A package's __tests__/ folder is reachable only from tests — nothing else may import fixtures.",
      severity: 'error',
      from: { pathNot: PACKAGE_TESTS }, // importer is not itself a test
      to: { path: PACKAGE_TESTS },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // tsconfig.vitest.json (not tsconfig.json) so __tests__/ files are included
    // in module resolution — the root tsconfig excludes them.
    tsConfig: { fileName: 'tsconfig.vitest.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.vue'],
    },
  },
};
