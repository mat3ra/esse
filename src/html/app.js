/* global monaco */
/* eslint-disable import/no-amd, import/no-dynamic-require, no-use-before-define */

// ── Monaco bootstrap ──────────────────────────────────────────────────────────
let monacoEditor = null;
let pendingPath = null; // a file opened before the editor finished loading

require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs" } });
require(["vs/editor/editor.main"], () => {
    monacoEditor = monaco.editor.create(document.getElementById("monaco-editor"), {
        value: "",
        language: "json",
        theme: "vs-dark",
        readOnly: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: "on",
        wordWrap: "off",
        automaticLayout: true,
        renderLineHighlight: "all",
    });
    if (pendingPath !== null) {
        const path = pendingPath;
        pendingPath = null;
        showInEditor(path);
    }
});

/**
 * One Monaco model per open file, so each tab keeps its own folding and undo history
 * rather than sharing a single buffer that gets overwritten on every switch.
 */
function modelFor(path) {
    let model = models.get(path);
    if (!model) {
        model = monaco.editor.createModel(
            fileContent.get(path) || "",
            "json",
            monaco.Uri.from({ scheme: "esse", path: `/${path}` }),
        );
        models.set(path, model);
    }
    return model;
}

function showInEditor(path) {
    if (!monacoEditor) {
        pendingPath = path;
        return;
    }
    document.getElementById("welcome").style.display = "none";
    document.getElementById("monaco-editor").style.display = "block";

    // Remember where the outgoing file was, so coming back lands where you left.
    if (shownPath && shownPath !== path) {
        viewStates.set(shownPath, monacoEditor.saveViewState());
    }

    monacoEditor.setModel(modelFor(path));
    const state = viewStates.get(path);
    if (state) monacoEditor.restoreViewState(state);
    else monacoEditor.revealLine(1);
    shownPath = path;
}

// ── State ─────────────────────────────────────────────────────────────────────
let allFiles = [];
let selectedFile = null; // currently selected file path
let currentQuery = "";

/**
 * The Explorer shows the same files three ways. "files" is the source tree; "categories"
 * and "directories" are virtual trees built at deploy time into views.json — the CateCom
 * ladders and M-CODE axes on one side, the catalogue grouped by coordinate on the other.
 * Each keeps its own expanded folders, so switching back does not collapse what you opened.
 */
const VIEWS = ["files", "categories", "directories"];
let view = "files";
let views = null; // views.json, fetched once on first use
const expandedByView = { files: new Set(), categories: new Set(), directories: new Set() };
const expandedSet = expandedByView.files; // the source tree's set, pre-expanded at startup

/** Folders currently open in whichever view is showing. */
function expandedFolders() {
    return expandedByView[view];
}

// Open files, left to right as they appear in the tab bar. Everything below is keyed
// by path and cleared when the tab closes, so nothing accumulates for a closed file.
const openTabs = [];
const fileContent = new Map(); // path -> text, so switching back does not refetch
const models = new Map(); // path -> Monaco model
const viewStates = new Map(); // path -> scroll/cursor position
let shownPath = null; // the file whose model the editor currently holds

// ── Build nested tree object from a flat entry list ───────────────────────────
/**
 * Entries are `{ segments, path }`: the folder chain with the leaf label last, and the file
 * to open. Segments rather than a joined string because a leaf label can itself contain a
 * slash — a catalogue entry filed under a vocabulary node reads `models_directory/gga.json`
 * — and splitting one would invent a folder that is not there.
 */
function entriesToTree(entries) {
    const root = {};
    entries.forEach(({ segments, path: filePath }) => {
        let node = root;
        segments.forEach((part, index) => {
            if (index === segments.length - 1) {
                if (!node.__files) node.__files = [];
                node.__files.push({ name: part, path: filePath });
            } else {
                if (!node[part]) node[part] = {};
                node = node[part];
            }
        });
    });
    return root;
}

/** The source tree as entries, so every view shares one renderer. */
function fileEntries() {
    return allFiles.map((filePath) => ({ segments: filePath.split("/"), path: filePath }));
}

/** Entries for whichever view is showing. */
function currentEntries() {
    if (view === "files") return fileEntries();
    return (views && views[view]) || [];
}

/** Every place a file appears in the current view — M-CODE files a recipe under each axis. */
function placementsOf(filePath) {
    return currentEntries().filter((entry) => entry.path === filePath);
}

// ── Render tree (lazy — children only rendered when folder is opened) ─────────
function renderTree(container, node, depth, folderPath) {
    // Folders first (alphabetical)
    const folderKeys = Object.keys(node)
        .filter((k) => k !== "__files")
        .sort();
    folderKeys.forEach((key) => {
        const fp = folderPath ? `${folderPath}/${key}` : key;
        const isOpen = expandedFolders().has(fp);

        const row = document.createElement("div");
        row.className = "t-item folder";
        row.style.paddingLeft = `${depth * 12 + 4}px`;
        row.dataset.fp = fp;
        row.setAttribute("aria-expanded", String(isOpen));

        row.innerHTML =
            `<span class="t-chevron">${isOpen ? "▾" : "▸"}</span>` +
            `<span class="t-icon" style="color:var(--icon-folder)">${isOpen ? "📂" : "📁"}</span>` +
            `<span class="t-label">${escHtml(key)}</span>`;

        const children = document.createElement("div");
        children.className = "t-children" + (isOpen ? " open" : "");
        children.dataset.rendered = "false";

        row.addEventListener("click", (e) => {
            e.stopPropagation();
            const opening = !children.classList.contains("open");
            children.classList.toggle("open", opening);
            row.querySelector(".t-chevron").textContent = opening ? "▾" : "▸";
            row.querySelector(".t-icon").textContent = opening ? "📂" : "📁";
            row.setAttribute("aria-expanded", String(opening));
            if (opening) {
                expandedFolders().add(fp);
                if (children.dataset.rendered === "false") {
                    renderTree(children, node[key], depth + 1, fp);
                    children.dataset.rendered = "true";
                }
            } else {
                expandedFolders().delete(fp);
            }
        });

        if (isOpen && children.dataset.rendered === "false") {
            renderTree(children, node[key], depth + 1, fp);
            children.dataset.rendered = "true";
        }

        container.appendChild(row);
        container.appendChild(children);
    });

    // Then files
    if (node.__files) {
        node.__files
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(({ name, path }) => {
                const row = document.createElement("div");
                row.className = "t-item file" + (path === selectedFile ? " selected" : "");
                row.style.paddingLeft = `${depth * 12 + 22}px`;
                row.dataset.path = path;

                row.innerHTML =
                    `<span class="t-icon">📄</span>` +
                    `<span class="t-label">${escHtml(name)}</span>`;

                row.addEventListener("click", () => openFile(path));
                container.appendChild(row);
            });
    }
}

// ── Render flat search results ────────────────────────────────────────────────
function renderSearch(container, matches, query) {
    if (matches.length === 0) {
        container.innerHTML = '<div class="tree-msg">No results found.</div>';
        return;
    }
    document.getElementById("status-count").textContent = `${matches.length} result${
        matches.length !== 1 ? "s" : ""
    }`;

    matches.forEach((entry) => {
        const { path } = entry;
        const fileName = entry.segments[entry.segments.length - 1];
        const dirPart = entry.segments.slice(0, -1).join(" / ");
        const row = document.createElement("div");
        row.className = "t-item file flat-result" + (path === selectedFile ? " selected" : "");
        row.style.paddingLeft = "8px";
        row.dataset.path = path;

        const hl = (s) => hlMatch(s, query);

        row.innerHTML =
            `<span class="t-icon" style="flex-shrink:0">📄</span>` +
            `<span class="t-label">` +
            `<span class="t-filename">${hl(fileName)}</span>` +
            `<span class="t-filepath">${hl(dirPart)}</span>` +
            `</span>`;

        row.addEventListener("click", () => openFile(path));
        container.appendChild(row);
    });
}

// ── Highlight query match in text ─────────────────────────────────────────────
function hlMatch(text, query) {
    if (!query) return escHtml(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escHtml(text);
    return (
        escHtml(text.slice(0, idx)) +
        `<mark>${escHtml(text.slice(idx, idx + query.length))}</mark>` +
        escHtml(text.slice(idx + query.length))
    );
}

function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Pre-expand folders up to a given depth ────────────────────────────────────
function preExpand(node, depth, folderPath, maxDepth) {
    if (depth >= maxDepth) return;
    Object.keys(node)
        .filter((k) => k !== "__files")
        .forEach((key) => {
            const fp = folderPath ? `${folderPath}/${key}` : key;
            expandedSet.add(fp);
            preExpand(node[key], depth + 1, fp, maxDepth);
        });
}

// ── Rebuild the whole tree pane ───────────────────────────────────────────────
function rebuildTree(query) {
    currentQuery = query;
    const container = document.getElementById("file-tree");
    container.innerHTML = "";

    const entries = currentEntries();

    if (!query) {
        const noun = view === "files" ? "file" : "entry";
        const plural = view === "files" ? "files" : "entries";
        document.getElementById("status-count").textContent = `${entries.length} ${
            entries.length === 1 ? noun : plural
        }`;
        renderTree(container, entriesToTree(entries), 0, "");
    } else {
        // Matched against the whole displayed row, so searching a view finds the labels it
        // shows — "physics-based" in Categories — not just file names.
        const q = query.toLowerCase();
        const matches = entries.filter((entry) =>
            entry.segments.join(" / ").toLowerCase().includes(q),
        );
        renderSearch(container, matches, query);
    }
}

function focusSelectedFileInTree(path) {
    document.querySelectorAll(".t-item.selected").forEach((el) => el.classList.remove("selected"));
    const el = document.querySelector(`.t-item.file[data-path="${CSS.escape(path)}"]`);
    if (el) {
        el.classList.add("selected");
        el.scrollIntoView({ block: "nearest" });
    }
}

// ── Views ─────────────────────────────────────────────────────────────────────
/**
 * A hash, not a query string: the site's link checker resolves the path part of every href
 * and would flag `index.html?view=categories` as a missing file. A leading slash cannot
 * collide with a file path, which is what a bare `#schema/model.json` still means.
 */
function hashFor(viewName, filePath) {
    if (viewName === "files") return filePath ? `#${filePath}` : "";
    return filePath ? `#/${viewName}/${filePath}` : `#/${viewName}`;
}

function parseHash(hash) {
    const match = hash.match(/^#?\/([a-z]+)(?:\/(.*))?$/);
    if (match && VIEWS.includes(match[1])) {
        return { view: match[1], path: match[2] || "" };
    }
    return { view: "files", path: hash.replace(/^#/, "") };
}

/** The Explorer answers to three nav items; the highlighted one has to follow the view. */
function markCurrentSurface() {
    document.querySelectorAll("#surfaces a[data-view]").forEach((link) => {
        link.classList.toggle("current", link.dataset.view === view);
    });
    document.querySelectorAll("#view-switch button").forEach((button) => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
}

/** Fetched once, and only when a view that needs it is first opened. */
function loadViews() {
    if (views) return Promise.resolve(views);
    return fetch("views.json")
        .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then((data) => {
            views = data;
            return views;
        })
        .catch(() => {
            views = { categories: [], directories: [] };
            return views;
        });
}

function setView(next, keepSelection) {
    if (!VIEWS.includes(next)) return Promise.resolve();
    view = next;
    markCurrentSurface();

    const apply = () => {
        if (currentQuery) {
            currentQuery = "";
            document.getElementById("search-input").value = "";
        }
        // Keep the open file selected where the new view also contains it.
        if (keepSelection && selectedFile) expandToFile(selectedFile);
        rebuildTree("");
        if (keepSelection && selectedFile) {
            focusSelectedFileInTree(selectedFile);
            renderBreadcrumb(selectedFile);
        }
        if (selectedFile) {
            window.history.replaceState(null, "", hashFor(view, selectedFile));
        } else {
            window.history.replaceState(
                null,
                "",
                hashFor(view, "") || window.location.pathname + window.location.search,
            );
        }
    };

    if (view === "files") {
        apply();
        return Promise.resolve();
    }
    return loadViews().then(apply);
}

/**
 * In a view this is the coordinate the file sits at, which is the whole point of the view;
 * in Files it is the path. A file filed under several M-CODE axes shows the first, which is
 * the one the sort put at the top.
 */
function renderBreadcrumb(path) {
    const placement = placementsOf(path)[0];
    const parts = placement ? placement.segments : path.split("/");
    document.getElementById("breadcrumb").innerHTML = parts
        .map((part, index) =>
            index < parts.length - 1
                ? `<span>${escHtml(part)}</span><span class="bc-sep">›</span>`
                : `<span style="color:var(--text-primary)">${escHtml(part)}</span>`,
        )
        .join("");
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
/**
 * Basenames repeat across the corpus (`model.json` exists under both `schema/` and
 * `example/`), so a tab shows its parent folder as soon as another open tab would
 * otherwise look identical.
 */
function tabLabel(path) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const ambiguous = openTabs.some((other) => other !== path && other.split("/").pop() === name);
    return ambiguous && parts.length > 1 ? `${parts[parts.length - 2]}/${name}` : name;
}

/** Built as DOM rather than markup: paths go in unescaped and listeners attach directly. */
function renderTabs() {
    const bar = document.getElementById("tabbar");
    bar.innerHTML = "";

    openTabs.forEach((path) => {
        const tab = document.createElement("div");
        tab.className = path === selectedFile ? "tab active" : "tab";
        tab.title = path;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(path === selectedFile));
        tab.tabIndex = 0;

        const icon = document.createElement("span");
        icon.textContent = "📄";
        const label = document.createElement("span");
        label.className = "tab-name";
        label.textContent = tabLabel(path);

        const close = document.createElement("button");
        close.className = "tab-close";
        close.type = "button";
        close.textContent = "\u00d7";
        close.setAttribute("aria-label", `Close ${tabLabel(path)}`);
        close.addEventListener("click", (event) => {
            event.stopPropagation();
            closeTab(path);
        });

        tab.append(icon, label, close);
        tab.addEventListener("click", () => activateTab(path));
        tab.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateTab(path);
            }
        });
        // Middle-click closes, as it does in an editor and in a browser.
        tab.addEventListener("auxclick", (event) => {
            if (event.button === 1) {
                event.preventDefault();
                closeTab(path);
            }
        });

        bar.appendChild(tab);
    });

    const active = bar.querySelector(".tab.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function clearEditor() {
    selectedFile = null;
    shownPath = null;
    if (monacoEditor) monacoEditor.setModel(null);

    document.getElementById("monaco-editor").style.display = "none";
    document.getElementById("welcome").style.display = "";
    document.getElementById("tabbar").innerHTML = "";
    document.getElementById("breadcrumb").textContent = "Essential Source of Schemas and Examples";
    document.getElementById("status-path").textContent = "No file selected";
    document.getElementById("view-on-map").hidden = true;
    document.querySelectorAll(".t-item.selected").forEach((el) => el.classList.remove("selected"));
    window.history.replaceState(
        null,
        "",
        hashFor(view, "") || window.location.pathname + window.location.search,
    );
}

function closeTab(path) {
    const index = openTabs.indexOf(path);
    if (index === -1) return;

    openTabs.splice(index, 1);
    const model = models.get(path);
    if (model) model.dispose();
    models.delete(path);
    viewStates.delete(path);
    fileContent.delete(path);
    if (shownPath === path) shownPath = null;

    if (selectedFile !== path) {
        renderTabs();
        return;
    }

    // The tab that slid into this one's place, else the one before it.
    const successor = openTabs[index] || openTabs[index - 1];
    if (successor) activateTab(successor);
    else clearEditor();
}

// ── Open / display a file ─────────────────────────────────────────────────────
function openFile(path) {
    if (!openTabs.includes(path)) openTabs.push(path);
    activateTab(path);
}

function activateTab(path) {
    selectedFile = path;
    expandToFile(path);

    if (currentQuery) {
        currentQuery = "";
        document.getElementById("search-input").value = "";
    }

    rebuildTree("");

    // Highlight in tree (works for both tree and search views)
    focusSelectedFileInTree(path);

    renderTabs();

    renderBreadcrumb(path);

    // Status
    document.getElementById("status-path").textContent = path;

    // Ontology map link. A schema's $id is its published path with underscores turned back
    // into dashes — exact, because no $id contains an underscore. Examples have no node
    // of their own, so the link points at the schema they illustrate.
    const viewOnMap = document.getElementById("view-on-map");
    const schemaPath = path.replace(/^example\//, "schema/");
    if (schemaPath.startsWith("schema/")) {
        const schemaId = schemaPath
            .replace(/^schema\//, "")
            .replace(/\.json$/, "")
            .replace(/_/g, "-");
        viewOnMap.href = `map/index.html#/entity/${encodeURIComponent(schemaId)}`;
        viewOnMap.hidden = false;
    } else {
        viewOnMap.hidden = true;
    }

    // Update URL hash for deep-linking, carrying the view along with the file.
    window.history.replaceState(null, "", hashFor(view, path));

    if (fileContent.has(path)) {
        showInEditor(path);
        return;
    }

    fetch(path)
        .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then((data) => JSON.stringify(data, null, 2))
        .catch((err) => `// Error loading file\n// ${err.message}`)
        .then((text) => {
            fileContent.set(path, text);
            // A slow response must not overwrite whatever tab is showing by now, and a
            // tab closed while in flight should not be resurrected.
            if (selectedFile === path) showInEditor(path);
            else if (!openTabs.includes(path)) fileContent.delete(path);
        });
}

// ── Expand all ancestor folders for a given file path ────────────────────────
/**
 * Expands every folder above the file, in each place the current view puts it: an M-CODE
 * recipe is filed under two or three axes at once, and opening it from one should not leave
 * the others collapsed.
 */
function expandToFile(path) {
    const expanded = expandedByView[view];
    placementsOf(path).forEach(({ segments }) => {
        let folderPath = "";
        segments.slice(0, -1).forEach((part) => {
            folderPath = folderPath ? `${folderPath}/${part}` : part;
            expanded.add(folderPath);
        });
    });
}

// ── Search handler ────────────────────────────────────────────────────────────
let searchTimer = null;
document.getElementById("search-input").addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => rebuildTree(this.value.trim()), 150);
});

// ── Resizer ───────────────────────────────────────────────────────────────────
(function initResizer() {
    const resizer = document.getElementById("resizer");
    const sidebar = document.getElementById("sidebar");
    let dragging = false;
    let startX = 0;
    let startW = 0;

    resizer.addEventListener("mousedown", (e) => {
        dragging = true;
        startX = e.clientX;
        startW = sidebar.offsetWidth;
        resizer.classList.add("active");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const w = Math.max(120, Math.min(window.innerWidth * 0.6, startW + e.clientX - startX));
        sidebar.style.width = w + "px";
        if (monacoEditor) monacoEditor.layout();
    });
    document.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove("active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
})();

// ── View switch ───────────────────────────────────────────────────────────────
(function initViewSwitch() {
    const container = document.getElementById("view-switch");
    if (!container) return;

    const buttons = [...container.querySelectorAll("button")];
    buttons.forEach((button, index) => {
        button.addEventListener("click", () => setView(button.dataset.view, true));
        button.addEventListener("keydown", (event) => {
            const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
            if (!step) return;
            event.preventDefault();
            const next = buttons[(index + step + buttons.length) % buttons.length];
            next.focus();
            setView(next.dataset.view, true);
        });
    });
})();

// ── Routing ───────────────────────────────────────────────────────────────────
/** Applies a hash to the view and, when it names one, the open file. */
function applyHash() {
    const target = parseHash(window.location.hash);
    const wanted = target.path;

    return setView(target.view, !wanted).then(() => {
        if (wanted && allFiles.includes(wanted)) openFile(wanted);
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
fetch("files.json")
    .then((r) => r.json())
    .then((files) => {
        allFiles = files;
        // Pre-expand the source tree to second degree by default
        preExpand(entriesToTree(fileEntries()), 0, "", 2);
        rebuildTree("");
        return applyHash();
    })
    .catch((err) => {
        document.getElementById(
            "file-tree",
        ).innerHTML = `<div class="tree-msg" style="color:#f88">Failed to load file index: ${err.message}</div>`;
    });

window.addEventListener("hashchange", () => {
    // Ignore the hashes we write ourselves while opening or switching.
    const target = parseHash(window.location.hash);
    if (target.view === view && target.path === (selectedFile || "")) return;
    applyHash();
});
