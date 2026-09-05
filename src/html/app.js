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
const expandedSet = new Set(); // set of folder paths that are expanded
let selectedFile = null; // currently selected file path
let currentQuery = "";

// Open files, left to right as they appear in the tab bar. Everything below is keyed
// by path and cleared when the tab closes, so nothing accumulates for a closed file.
const openTabs = [];
const fileContent = new Map(); // path -> text, so switching back does not refetch
const models = new Map(); // path -> Monaco model
const viewStates = new Map(); // path -> scroll/cursor position
let shownPath = null; // the file whose model the editor currently holds

// ── Build nested tree object from flat path list ──────────────────────────────
function pathsToTree(paths) {
    const root = {};
    paths.forEach((p) => {
        const parts = p.split("/");
        let node = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                if (!node.__files) node.__files = [];
                node.__files.push({ name: part, path: p });
            } else {
                if (!node[part]) node[part] = {};
                node = node[part];
            }
        }
    });
    return root;
}

// ── Render tree (lazy — children only rendered when folder is opened) ─────────
function renderTree(container, node, depth, folderPath) {
    // Folders first (alphabetical)
    const folderKeys = Object.keys(node)
        .filter((k) => k !== "__files")
        .sort();
    folderKeys.forEach((key) => {
        const fp = folderPath ? `${folderPath}/${key}` : key;
        const isOpen = expandedSet.has(fp);

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
                expandedSet.add(fp);
                if (children.dataset.rendered === "false") {
                    renderTree(children, node[key], depth + 1, fp);
                    children.dataset.rendered = "true";
                }
            } else {
                expandedSet.delete(fp);
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

    matches.forEach((path) => {
        const fileName = path.split("/").pop();
        const dirPart = path.slice(0, path.length - fileName.length - 1);
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

    if (!query) {
        document.getElementById("status-count").textContent = `${allFiles.length} file${
            allFiles.length !== 1 ? "s" : ""
        }`;
        const tree = pathsToTree(allFiles);
        renderTree(container, tree, 0, "");
    } else {
        const q = query.toLowerCase();
        const matches = allFiles.filter((f) => f.toLowerCase().includes(q));
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
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
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

    // Breadcrumb
    const parts = path.split("/");
    document.getElementById("breadcrumb").innerHTML = parts
        .map((p, i) =>
            i < parts.length - 1
                ? `<span>${escHtml(p)}</span><span class="bc-sep">›</span>`
                : `<span style="color:var(--text-primary)">${escHtml(p)}</span>`,
        )
        .join("");

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

    // Update URL hash for deep-linking
    window.history.replaceState(null, "", "#" + path);

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
function expandToFile(path) {
    const parts = path.split("/");
    let folderPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
        folderPath = folderPath ? `${folderPath}/${parts[i]}` : parts[i];
        expandedSet.add(folderPath);
    }
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

// ── Init ──────────────────────────────────────────────────────────────────────
fetch("files.json")
    .then((r) => r.json())
    .then((files) => {
        allFiles = files;
        // Pre-expand to second degree by default
        const tree = pathsToTree(allFiles);
        preExpand(tree, 0, "", 2);
        // Handle deep-link hash
        const hash = window.location.hash.slice(1);
        if (hash && allFiles.includes(hash)) {
            expandToFile(hash);
        }
        rebuildTree("");
        if (hash && allFiles.includes(hash)) {
            openFile(hash);
        }
    })
    .catch((err) => {
        document.getElementById(
            "file-tree",
        ).innerHTML = `<div class="tree-msg" style="color:#f88">Failed to load file index: ${err.message}</div>`;
    });

window.addEventListener("hashchange", () => {
    const hash = window.location.hash.slice(1);
    if (hash && allFiles.includes(hash)) openFile(hash);
});
