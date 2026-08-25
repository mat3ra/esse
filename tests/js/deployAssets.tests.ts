import { expect } from "chai";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Deliberately not `__dirname`. Mocha tries `import()` before `require()` and only
 * falls back on ERR_MODULE_NOT_FOUND, so a test file is loaded as CJS only when its
 * imports make ESM resolution fail — which, in this suite, happens by accident:
 * every other file imports a project module extensionlessly. This file imports only
 * bare specifiers, so it loads as a real ES module, where `__dirname` is undefined.
 * `process.cwd()` is correct under both, and npm/nyc run mocha from the repo root.
 */
const REPOSITORY_ROOT = process.cwd();
const HTML_SOURCE_DIR = path.join(REPOSITORY_ROOT, "src/html");

function trackedUnder(directory: string): Set<string> {
    const output = execFileSync("git", ["ls-files", "-z", "--", directory], {
        cwd: REPOSITORY_ROOT,
        encoding: "utf-8",
    });
    return new Set(output.split("\0").filter(Boolean));
}

function filesOnDisk(directory: string, base: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(directory, entry.name);
        const relative = path.posix.join(base, entry.name);
        return entry.isDirectory() ? filesOnDisk(full, relative) : [relative];
    });
}

/**
 * The deploy job copies `src/html/` verbatim into the published site. A file that
 * exists locally but is not committed is invisible to CI's fresh checkout, so the
 * site ships without it while every local check passes.
 *
 * That is not hypothetical: `.gitignore` ignores `*.html` and re-included only
 * `!src/html/*.html`, which silently dropped `src/html/map/index.html` — the Entity
 * Map shipped with no page to load its script. It surfaced only in the deploy job,
 * after merge, as 63 broken links.
 */
describe("deploy assets", () => {
    before(function () {
        // No .git in a packaged checkout; the invariant is meaningless there.
        if (!fs.existsSync(path.join(REPOSITORY_ROOT, ".git"))) this.skip();
    });

    it("tracks every file the deploy job copies from src/html", () => {
        const tracked = trackedUnder("src/html");
        const untracked = filesOnDisk(HTML_SOURCE_DIR, "src/html").filter(
            (file) => !tracked.has(file),
        );

        expect(
            untracked,
            `these files exist locally but are not committed, so CI's checkout will not ` +
                `have them and the published site will be missing them:\n  ${untracked.join(
                    "\n  ",
                )}\nIf a .gitignore rule is excluding them, add a negation for it.`,
        ).to.deep.equal([]);
    });

    it("commits the page for each published surface", () => {
        const tracked = trackedUnder("src/html");

        ["src/html/index.html", "src/html/map/index.html"].forEach((page) => {
            expect(tracked.has(page), `${page} must be committed — it is a page CI publishes`).to.be
                .true;
        });
    });
});
