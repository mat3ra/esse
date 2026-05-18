/* global monaco */
/* eslint-disable import/no-amd, import/no-dynamic-require, no-use-before-define */

// ── Monaco bootstrap ──────────────────────────────────────────────────────────
let monacoEditor = null;
let pendingContent = null;

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
    if (pendingContent !== null) {
        applyContent(pendingContent);
        pendingContent = null;
    }
});

function applyContent(text) {
    if (!monacoEditor) {
        pendingContent = text;
        return;
    }
    document.getElementById("welcome").style.display = "none";
    document.getElementById("monaco-editor").style.display = "block";
    monacoEditor.setValue(text);
    monacoEditor.revealLine(1);
}

// ── State ─────────────────────────────────────────────────────────────────────
let allFiles = [];
const expandedSet = new Set(); // set of folder paths that are expanded
let selectedFile = null; // currently selected file path
let currentQuery = "";

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

// ── Open / display a file ─────────────────────────────────────────────────────
function openFile(path) {
    selectedFile = path;
    expandToFile(path);

    if (currentQuery) {
        currentQuery = "";
        document.getElementById("search-input").value = "";
    }

    rebuildTree("");

    // Highlight in tree (works for both tree and search views)
    focusSelectedFileInTree(path);

    // Tab
    const fname = path.split("/").pop();
    document.getElementById(
        "tabbar",
    ).innerHTML = `<div class="tab active"><span>📄</span><span>${escHtml(fname)}</span></div>`;

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

    // Update URL hash for deep-linking
    window.history.replaceState(null, "", "#" + path);

    // Fetch
    fetch(path)
        .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then((data) => applyContent(JSON.stringify(data, null, 2)))
        .catch((err) => applyContent(`// Error loading file\n// ${err.message}`));
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
// Load README into the welcome panel
fetch("README.md")
    .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
    })
    .then((text) => {
        /* global marked */
        document.getElementById("welcome-readme").innerHTML = marked.parse(text);
    })
    .catch(() => {
        document.getElementById("welcome-readme").innerHTML =
            "<p>Welcome to ESSEntial Source of Schemas and Examples (ESSE).<br>" +
            "Select a schema from the explorer on the left, or start typing to search.</p>";
    });

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
