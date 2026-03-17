const CONFIG = {
    supabaseUrl: "https://ukjwumswjrspbxgjcter.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrand1bXN3anJzcGJ4Z2pjdGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjAzODAsImV4cCI6MjA4OTI5NjM4MH0.UmCU3j8_QqfxRCto59JQyq0Lsg_LCcx2aEbonsrzgDg",
    bucket: "files",
    pageSize: 18,
    listPageSize: 100,
    maxQueueCount: 30,
    storageQuotaBytes: 50 * 1024 * 1024 * 1024,
    messageMs: 4200
};

const STORAGE_KEYS = {
    settings: "my-cloud-service-settings",
    theme: "my-cloud-service-theme",
    view: "my-cloud-service-view"
};

const DEFAULT_SETTINGS = {
    autoLoad: true,
    maxFileSize: 50,
    compression: false,
    reduceMotion: false
};

const $ = (id) => document.getElementById(id);
const elements = {
    body: document.body,
    message: $("message"),
    themeToggle: $("themeToggle"),
    settingsBtn: $("settingsBtn"),
    refreshBtn: $("refreshBtn"),
    queueMetric: $("queueMetric"),
    libraryMetric: $("libraryMetric"),
    usageMetric: $("usageMetric"),
    uploadArea: $("uploadArea"),
    fileInput: $("fileInput"),
    browseBtn: $("browseBtn"),
    clearQueueBtn: $("clearQueueBtn"),
    uploadSelectedBtn: $("uploadSelectedBtn"),
    uploadHint: $("uploadHint"),
    selectAllBtn: $("selectAllBtn"),
    deselectAllBtn: $("deselectAllBtn"),
    previewList: $("previewList"),
    queueSummary: $("queueSummary"),
    selectionSummary: $("selectionSummary"),
    progressSection: $("progressSection"),
    progressFill: $("progressFill"),
    progressText: $("progressText"),
    progressPercent: $("progressPercent"),
    speedText: $("speedText"),
    etaText: $("etaText"),
    loadFilesBtn: $("loadFilesBtn"),
    statsBtn: $("statsBtn"),
    exportBtn: $("exportBtn"),
    searchInput: $("searchInput"),
    sortSelect: $("sortSelect"),
    filterSelect: $("filterSelect"),
    toggleViewBtn: $("toggleViewBtn"),
    selectVisibleBtn: $("selectVisibleBtn"),
    bulkActions: $("bulkActions"),
    bulkCount: $("bulkCount"),
    shareSelectedBtn: $("shareSelectedBtn"),
    downloadSelectedBtn: $("downloadSelectedBtn"),
    deleteSelectedBtn: $("deleteSelectedBtn"),
    filesCountLabel: $("filesCountLabel"),
    storageUsageLabel: $("storageUsageLabel"),
    filesList: $("filesList"),
    loadMoreSentinel: $("loadMoreSentinel"),
    settingsModal: $("settingsModal"),
    autoLoad: $("autoLoad"),
    maxFileSize: $("maxFileSize"),
    compression: $("compression"),
    reduceMotion: $("reduceMotion"),
    saveSettingsBtn: $("saveSettingsBtn"),
    fileInfoModal: $("fileInfoModal"),
    fileInfoContent: $("fileInfoContent"),
    statsModal: $("statsModal"),
    statsContent: $("statsContent"),
    renameModal: $("renameModal"),
    renameCurrentName: $("renameCurrentName"),
    renameInput: $("renameInput"),
    renameSubmitBtn: $("renameSubmitBtn"),
    themeMeta: document.querySelector('meta[name="theme-color"]')
};

const supabaseClient = window.supabase
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
    : null;

const state = {
    settings: loadStoredSettings(),
    theme: localStorage.getItem(STORAGE_KEYS.theme) === "light" ? "light" : "dark",
    currentView: localStorage.getItem(STORAGE_KEYS.view) === "list" ? "list" : "grid",
    queue: [],
    files: [],
    filteredFiles: [],
    selectedUploaded: new Set(),
    visibleCount: CONFIG.pageSize,
    isLibraryLoaded: false,
    isUploading: false,
    draggedQueueId: null,
    messageTimer: null,
    observer: null,
    revealObserver: null,
    renameTarget: null
};

init();

function init() {
    syncSettingsForm();
    applyTheme(state.theme, false);
    applyReducedMotion();
    applyView(state.currentView, false);
    setUploadHint();
    renderQueue();
    renderLibrary();
    updateMetrics();
    bindEvents();
    setupRevealObserver();
    setupInfiniteScroll();
    registerServiceWorker();
    if (!supabaseClient) {
        showMessage("Supabase could not initialize. Check the CDN script before using uploads.", "error", 7000);
        return;
    }
    if (state.settings.autoLoad) loadLibrary({ silent: true, trigger: "load" });
}

function bindEvents() {
    elements.browseBtn.addEventListener("click", () => !state.isUploading && elements.fileInput.click());
    elements.fileInput.addEventListener("change", (event) => {
        handleFiles(event.target.files);
        event.target.value = "";
    });
    ["dragenter", "dragover"].forEach((name) => elements.uploadArea.addEventListener(name, (event) => {
        event.preventDefault();
        if (!state.isUploading) elements.uploadArea.classList.add("is-dragover");
    }));
    ["dragleave", "drop"].forEach((name) => elements.uploadArea.addEventListener(name, (event) => {
        event.preventDefault();
        elements.uploadArea.classList.remove("is-dragover");
    }));
    elements.uploadArea.addEventListener("drop", (event) => !state.isUploading && handleFiles(event.dataTransfer.files));
    elements.selectAllBtn.addEventListener("click", () => { state.queue.forEach((item) => item.selected = true); renderQueue(); });
    elements.deselectAllBtn.addEventListener("click", () => { state.queue.forEach((item) => item.selected = false); renderQueue(); });
    elements.clearQueueBtn.addEventListener("click", clearQueue);
    elements.uploadSelectedBtn.addEventListener("click", uploadSelectedQueue);
    elements.themeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark", true));
    elements.settingsBtn.addEventListener("click", () => openModal(elements.settingsModal));
    elements.saveSettingsBtn.addEventListener("click", saveSettings);
    elements.renameSubmitBtn.addEventListener("click", submitRename);
    elements.renameInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitRename();
    });
    elements.loadFilesBtn.addEventListener("click", () => loadLibrary({ trigger: "load" }));
    elements.refreshBtn.addEventListener("click", () => loadLibrary({ silent: true, trigger: "refresh" }));
    elements.statsBtn.addEventListener("click", showStats);
    elements.exportBtn.addEventListener("click", exportLibrary);
    elements.searchInput.addEventListener("input", () => applyFilters(true));
    elements.sortSelect.addEventListener("change", () => applyFilters(true));
    elements.filterSelect.addEventListener("change", () => applyFilters(true));
    elements.toggleViewBtn.addEventListener("click", () => applyView(state.currentView === "grid" ? "list" : "grid", true));
    elements.selectVisibleBtn.addEventListener("click", toggleVisibleSelection);
    elements.shareSelectedBtn.addEventListener("click", () => copyPublicLinks(Array.from(state.selectedUploaded)));
    elements.downloadSelectedBtn.addEventListener("click", downloadSelectedFiles);
    elements.deleteSelectedBtn.addEventListener("click", async () => {
        const names = Array.from(state.selectedUploaded);
        if (names.length && window.confirm(`Delete ${names.length} selected file(s)?`)) await deleteFiles(names);
    });
    elements.previewList.addEventListener("click", handlePreviewClick);
    elements.previewList.addEventListener("change", handlePreviewChange);
    elements.previewList.addEventListener("dragstart", handlePreviewDragStart);
    elements.previewList.addEventListener("dragover", handlePreviewDragOver);
    elements.previewList.addEventListener("dragleave", handlePreviewDragLeave);
    elements.previewList.addEventListener("drop", handlePreviewDrop);
    elements.previewList.addEventListener("dragend", handlePreviewDragEnd);
    elements.filesList.addEventListener("click", handleFilesListClick);
    elements.filesList.addEventListener("change", handleFilesListChange);
    document.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeAllModals));
    document.addEventListener("keydown", handleKeyboardShortcuts);
    window.addEventListener("beforeunload", revokeAllPreviewUrls);
}

function loadStoredSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "null") || {}) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function syncSettingsForm() {
    elements.autoLoad.checked = state.settings.autoLoad;
    elements.maxFileSize.value = state.settings.maxFileSize;
    elements.compression.checked = state.settings.compression;
    elements.reduceMotion.checked = state.settings.reduceMotion;
}

function saveSettings() {
    state.settings = {
        autoLoad: elements.autoLoad.checked,
        maxFileSize: Math.max(1, Math.min(2048, Number(elements.maxFileSize.value) || DEFAULT_SETTINGS.maxFileSize)),
        compression: elements.compression.checked,
        reduceMotion: elements.reduceMotion.checked
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    applyReducedMotion();
    setUploadHint();
    renderQueue();
    closeAllModals();
    showMessage("Settings saved.", "success");
}

function applyTheme(theme, persist = true) {
    state.theme = theme === "light" ? "light" : "dark";
    elements.body.dataset.theme = state.theme;
    elements.themeToggle.textContent = state.theme === "dark" ? "Light Mode" : "Dark Mode";
    if (elements.themeMeta) elements.themeMeta.setAttribute("content", state.theme === "dark" ? "#071521" : "#edf7fb");
    if (persist) localStorage.setItem(STORAGE_KEYS.theme, state.theme);
}

function applyReducedMotion() {
    elements.body.classList.toggle("reduce-motion", Boolean(state.settings.reduceMotion));
    if (state.settings.reduceMotion) {
        disconnectRevealObserver();
        document.querySelectorAll(".reveal-on-scroll").forEach((node) => node.classList.add("is-visible"));
        return;
    }
    if (!state.revealObserver) setupRevealObserver();
    observeRevealTargets();
}

function applyView(view, persist = true) {
    state.currentView = view === "list" ? "list" : "grid";
    elements.filesList.classList.remove("grid-view", "list-view");
    elements.filesList.classList.add(`${state.currentView}-view`);
    elements.toggleViewBtn.textContent = state.currentView === "grid" ? "List View" : "Grid View";
    if (persist) localStorage.setItem(STORAGE_KEYS.view, state.currentView);
}

function setUploadHint() {
    if (!elements.uploadHint) return;
    elements.uploadHint.textContent = "";
    elements.uploadHint.hidden = true;
}

function handleFiles(fileList) {
    if (state.isUploading) return showMessage("Wait for the current upload batch to finish first.", "info");
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let accepted = 0;
    let typeRejected = 0;
    let sizeRejected = 0;
    let queueRejected = 0;
    const maxBytes = state.settings.maxFileSize * 1024 * 1024;
    for (const file of files) {
        if (state.queue.length + accepted >= CONFIG.maxQueueCount) {
            queueRejected += 1;
            continue;
        }
        if (!isSupportedFile(file)) {
            typeRejected += 1;
            continue;
        }
        if (file.size > maxBytes) {
            sizeRejected += 1;
            continue;
        }
        state.queue.push({
            id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            selected: true,
            previewUrl: URL.createObjectURL(file)
        });
        accepted += 1;
    }
    renderQueue();
    if (!accepted) return showMessage("No files were added. Check type, size, or queue limit.", "error");
    const parts = [`Added ${accepted} file(s) to the queue.`];
    if (typeRejected) parts.push(`${typeRejected} unsupported.`);
    if (sizeRejected) parts.push(`${sizeRejected} over the size limit.`);
    if (queueRejected) parts.push(`Queue cap is ${CONFIG.maxQueueCount}.`);
    showMessage(parts.join(" "), "success");
}

function renderQueue() {
    const selectedCount = state.queue.filter((item) => item.selected).length;
    elements.queueMetric.textContent = `${state.queue.length} file${state.queue.length === 1 ? "" : "s"}`;
    elements.queueSummary.textContent = state.queue.length ? `${state.queue.length} file(s) staged for upload.` : "No files staged yet.";
    elements.selectionSummary.textContent = `${selectedCount} selected`;
    elements.clearQueueBtn.disabled = state.isUploading || !state.queue.length;
    elements.selectAllBtn.disabled = state.isUploading || !state.queue.length;
    elements.deselectAllBtn.disabled = state.isUploading || !state.queue.length;
    elements.uploadSelectedBtn.disabled = state.isUploading || !selectedCount || !supabaseClient;
    elements.uploadSelectedBtn.textContent = selectedCount ? `Upload Selected (${selectedCount})` : "Upload Selected";
    if (!state.queue.length) {
        elements.previewList.innerHTML = getEmptyStateMarkup(
            "queue",
            "No staged files",
            "Drop images or videos into the upload zone to preview, select, and reorder them before uploading."
        );
        return updateMetrics();
    }
    elements.previewList.innerHTML = state.queue.map((item) => {
        const kind = getFileKind(item.file);
        const media = kind === "image"
            ? `<img src="${item.previewUrl}" alt="${escapeHtml(item.file.name)}">`
            : `<video src="${item.previewUrl}" muted playsinline preload="metadata"></video>`;
        return `
            <article class="preview-card reveal-on-scroll" data-id="${item.id}" draggable="true">
                <div class="preview-card__top">
                    <label class="checkbox-pill">
                        <input type="checkbox" data-action="toggle-queue" data-id="${item.id}" ${item.selected ? "checked" : ""}>
                        <span>Include</span>
                    </label>
                    <button class="icon-button compact" type="button" data-action="remove-queue" data-id="${item.id}">Remove</button>
                </div>
                <div class="preview-card__media">${media}</div>
                <div class="preview-card__meta">
                    <h3 title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</h3>
                    <p>${formatBytes(item.file.size)}${state.settings.compression && canCompress(item.file) ? " - compression ready" : ""}</p>
                </div>
                <div class="preview-card__footer">
                    <span class="file-pill">${kind === "image" ? "Image" : "Video"}</span>
                    <span class="drag-hint">Drag to reorder</span>
                </div>
            </article>
        `;
    }).join("");
    observeRevealTargets(elements.previewList);
    updateMetrics();
}

function handlePreviewClick(event) {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "remove-queue") removeQueueItem(action.dataset.id);
}

function handlePreviewChange(event) {
    const toggle = event.target.closest('input[data-action="toggle-queue"]');
    if (!toggle) return;
    const item = state.queue.find((entry) => entry.id === toggle.dataset.id);
    if (!item) return;
    item.selected = toggle.checked;
    renderQueue();
}

function handlePreviewDragStart(event) {
    const card = event.target.closest(".preview-card");
    if (!card) return;
    state.draggedQueueId = card.dataset.id;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
}

function handlePreviewDragOver(event) {
    const card = event.target.closest(".preview-card");
    if (!card || !state.draggedQueueId) return;
    event.preventDefault();
    card.classList.add("is-drop-target");
}

function handlePreviewDragLeave(event) {
    const card = event.target.closest(".preview-card");
    if (card) card.classList.remove("is-drop-target");
}

function handlePreviewDrop(event) {
    const card = event.target.closest(".preview-card");
    if (!card || !state.draggedQueueId) return;
    event.preventDefault();
    const fromIndex = state.queue.findIndex((item) => item.id === state.draggedQueueId);
    const toIndex = state.queue.findIndex((item) => item.id === card.dataset.id);
    elements.previewList.querySelectorAll(".preview-card").forEach((node) => node.classList.remove("is-drop-target"));
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = state.queue.splice(fromIndex, 1);
    state.queue.splice(toIndex, 0, moved);
    renderQueue();
}

function handlePreviewDragEnd() {
    state.draggedQueueId = null;
    elements.previewList.querySelectorAll(".preview-card").forEach((node) => node.classList.remove("is-dragging", "is-drop-target"));
}

function removeQueueItem(id) {
    const index = state.queue.findIndex((item) => item.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(state.queue[index].previewUrl);
    state.queue.splice(index, 1);
    renderQueue();
}

function clearQueue() {
    revokeAllPreviewUrls();
    state.queue = [];
    renderQueue();
}

function revokeAllPreviewUrls() {
    state.queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

async function uploadSelectedQueue() {
    if (!supabaseClient) return showMessage("Supabase is not available. Uploads cannot start.", "error");
    const selected = state.queue.filter((item) => item.selected);
    if (!selected.length) return showMessage("Select at least one file to upload.", "info");
    state.isUploading = true;
    elements.browseBtn.disabled = true;
    elements.fileInput.disabled = true;
    elements.progressSection.hidden = false;
    elements.progressSection.classList.add("is-visible");
    elements.progressFill.style.width = "0%";
    elements.progressPercent.textContent = "0%";
    elements.speedText.textContent = "Speed: --";
    elements.etaText.textContent = "ETA: --";
    renderQueue();
    try {
        const jobs = [];
        let savings = 0;
        for (let index = 0; index < selected.length; index += 1) {
            elements.progressText.textContent = `Preparing ${getDisplayName(selected[index].file.name)} (${index + 1}/${selected.length})`;
            const job = await prepareUploadJob(selected[index]);
            jobs.push(job);
            savings += job.savingsBytes;
        }
        const progress = {
            totalBytes: jobs.reduce((sum, job) => sum + job.file.size, 0),
            completedBytes: 0,
            currentLoaded: 0,
            currentName: jobs[0] ? getDisplayName(jobs[0].item.file.name) : "Uploads",
            startedAt: performance.now()
        };
        const successfulIds = [];
        const failures = [];
        for (let index = 0; index < jobs.length; index += 1) {
            const job = jobs[index];
            progress.currentName = getDisplayName(job.item.file.name);
            progress.currentLoaded = 0;
            updateProgress(progress, index, jobs.length);
            try {
                await uploadFileWithProgress(job, (loaded) => {
                    progress.currentLoaded = loaded;
                    updateProgress(progress, index, jobs.length);
                });
                successfulIds.push(job.item.id);
                progress.completedBytes += job.file.size;
                progress.currentLoaded = 0;
                updateProgress(progress, index + 1, jobs.length);
            } catch (error) {
                failures.push(`${getDisplayName(job.item.file.name)}: ${error.message}`);
            }
        }
        if (successfulIds.length) removeQueueItems(successfulIds);
        if (successfulIds.length && state.settings.autoLoad) await loadLibrary({ silent: true, trigger: "refresh" });
        const summary = [`Uploaded ${successfulIds.length} of ${jobs.length} file(s).`];
        if (savings > 0) summary.push(`Saved ${formatBytes(savings)} with compression.`);
        if (failures.length) {
            summary.push(`${failures.length} file(s) failed.`);
            console.error("Upload failures:", failures.join(" | "));
            showMessage(summary.join(" "), "info", 6500);
        } else {
            showMessage(summary.join(" "), "success");
        }
        elements.progressText.textContent = failures.length ? `Upload complete with ${failures.length} failure(s)` : "Upload complete";
        if (!failures.length) window.setTimeout(() => { elements.progressSection.hidden = true; }, 1600);
    } catch (error) {
        console.error(error);
        showMessage(`Upload failed: ${error.message}`, "error", 6500);
    } finally {
        state.isUploading = false;
        elements.browseBtn.disabled = false;
        elements.fileInput.disabled = false;
        renderQueue();
    }
}

async function prepareUploadJob(item) {
    let uploadFile = item.file;
    let savingsBytes = 0;
    if (state.settings.compression && canCompress(item.file)) {
        const compressed = await compressImageFile(item.file);
        if (compressed.size < item.file.size) {
            uploadFile = compressed;
            savingsBytes = item.file.size - compressed.size;
        }
    }
    return { item, file: uploadFile, path: buildStoragePath(item.file.name), savingsBytes };
}

function updateProgress(progress, completedFiles, totalFiles) {
    const transferred = progress.completedBytes + progress.currentLoaded;
    const percent = progress.totalBytes ? Math.min((transferred / progress.totalBytes) * 100, 100) : 0;
    const elapsed = Math.max((performance.now() - progress.startedAt) / 1000, 0.25);
    const speed = transferred / elapsed;
    const remaining = Math.max(progress.totalBytes - transferred, 0);
    const eta = speed > 0 ? remaining / speed : Infinity;
    elements.progressFill.style.width = `${percent.toFixed(2)}%`;
    elements.progressPercent.textContent = `${Math.round(percent)}%`;
    elements.progressText.textContent = completedFiles >= totalFiles
        ? `Upload complete (${totalFiles}/${totalFiles})`
        : `Uploading ${progress.currentName} (${Math.min(completedFiles + 1, totalFiles)}/${totalFiles})`;
    elements.speedText.textContent = `Speed: ${speed > 0 ? `${formatBytes(speed)}/s` : "--"}`;
    elements.etaText.textContent = `ETA: ${Number.isFinite(eta) ? formatDuration(eta) : "--"}`;
}

async function loadLibrary({ silent = false, trigger = "load" } = {}) {
    if (!supabaseClient) return showMessage("Supabase is not available. The library cannot be loaded.", "error");
    setButtonLoading(elements.loadFilesBtn, trigger === "load", "Loading...");
    setButtonLoading(elements.refreshBtn, trigger === "refresh", "Refreshing...");
    try {
        let offset = 0;
        const collected = [];
        while (true) {
            const { data, error } = await supabaseClient.storage.from(CONFIG.bucket).list("", {
                limit: CONFIG.listPageSize,
                offset,
                sortBy: { column: "name", order: "asc" }
            });
            if (error) throw error;
            const batch = (data || []).filter((item) => item?.name && !item.name.endsWith("/"));
            collected.push(...batch);
            if (batch.length < CONFIG.listPageSize) break;
            offset += CONFIG.listPageSize;
        }
        state.files = collected;
        state.filteredFiles = collected.slice();
        state.isLibraryLoaded = true;
        state.visibleCount = CONFIG.pageSize;
        state.selectedUploaded = new Set(Array.from(state.selectedUploaded).filter((name) => collected.some((file) => file.name === name)));
        applyFilters(true);
        if (!silent) showMessage(`Loaded ${collected.length} file(s).`, "success");
    } catch (error) {
        console.error(error);
        showMessage(`Failed to load files: ${error.message}`, "error", 6500);
    } finally {
        setButtonLoading(elements.loadFilesBtn, false);
        setButtonLoading(elements.refreshBtn, false);
    }
}

function applyFilters(resetVisible = false) {
    if (!state.isLibraryLoaded) return renderLibrary();
    const query = elements.searchInput.value.trim().toLowerCase();
    const filter = elements.filterSelect.value;
    const sortKey = elements.sortSelect.value;
    state.filteredFiles = state.files.filter((file) => matchesFileFilter(file, query, filter)).sort((a, b) => compareFiles(a, b, sortKey));
    if (resetVisible) state.visibleCount = CONFIG.pageSize;
    renderLibrary();
}

function renderLibrary() {
    if (!state.isLibraryLoaded) {
        elements.filesList.innerHTML = getEmptyStateMarkup(
            "library",
            "Library not loaded",
            "Use the Load Library button to fetch files from Supabase storage."
        );
        elements.filesCountLabel.textContent = "Library not loaded";
        elements.storageUsageLabel.textContent = "Usage: 0 B";
        elements.loadMoreSentinel.hidden = true;
        updateSelectionToolbar();
        return updateMetrics();
    }
    if (!state.filteredFiles.length) {
        elements.filesList.innerHTML = getEmptyStateMarkup(
            "search",
            "No matching files",
            "Try another search or filter, or upload new media to populate the library."
        );
        elements.filesCountLabel.textContent = "Showing 0 files";
        elements.storageUsageLabel.textContent = `Usage: ${formatBytes(getTotalLibrarySize())} / ${formatBytes(CONFIG.storageQuotaBytes)}`;
        elements.loadMoreSentinel.hidden = true;
        updateSelectionToolbar();
        return updateMetrics();
    }
    const visible = state.filteredFiles.slice(0, state.visibleCount);
    elements.filesList.innerHTML = visible.map(buildFileCardMarkup).join("");
    elements.filesCountLabel.textContent = `Showing ${visible.length} of ${state.filteredFiles.length} file(s)`;
    elements.storageUsageLabel.textContent = `Usage: ${formatBytes(getTotalLibrarySize())} / ${formatBytes(CONFIG.storageQuotaBytes)}`;
    elements.loadMoreSentinel.hidden = visible.length >= state.filteredFiles.length;
    if (!elements.loadMoreSentinel.hidden) elements.loadMoreSentinel.textContent = `Scroll to load ${state.filteredFiles.length - visible.length} more file(s)`;
    observeRevealTargets(elements.filesList);
    updateSelectionToolbar();
    updateMetrics();
}

function buildFileCardMarkup(file) {
    const name = escapeHtml(file.name);
    const display = escapeHtml(getDisplayName(file.name));
    const kind = getFileKind(file);
    const url = getPublicUrl(file.name);
    const selected = state.selectedUploaded.has(file.name);
    const media = kind === "image"
        ? `<img src="${url}" alt="${display}" loading="lazy">`
        : kind === "video"
            ? `<video src="${url}" controls preload="metadata"></video>`
            : `<div class="icon-asset">FILE</div>`;
    const note = kind === "image" ? "Image preview ready" : kind === "video" ? "Video preview ready" : "Public file";
    return `
        <article class="file-card reveal-on-scroll ${selected ? "is-selected" : ""}" data-name="${name}">
            <div class="file-card__top">
                <label class="checkbox-pill">
                    <input class="file-card__check" type="checkbox" data-name="${name}" ${selected ? "checked" : ""}>
                    <span>Select</span>
                </label>
                <span class="file-pill">${kind === "image" ? "Image" : kind === "video" ? "Video" : "File"}</span>
            </div>
            <div class="file-card__media">${media}</div>
            <div class="file-card__body">
                <div>
                    <h3 title="${display}">${display}</h3>
                    <p class="file-card__meta">${formatBytes(getFileSize(file))} - ${formatDate(file.created_at || file.updated_at)}</p>
                </div>
                <p class="file-card__note">${note}</p>
                <div class="file-card__actions">
                    <button class="button ghost compact" type="button" data-action="info" data-name="${name}">Info</button>
                    <button class="button ghost compact" type="button" data-action="rename" data-name="${name}">Rename</button>
                    <button class="button ghost compact" type="button" data-action="download" data-name="${name}">Download</button>
                    <button class="button secondary compact" type="button" data-action="share" data-name="${name}">Share</button>
                    <button class="button danger compact" type="button" data-action="delete" data-name="${name}">Delete</button>
                </div>
            </div>
        </article>
    `;
}

function handleFilesListClick(event) {
    const action = event.target.closest("[data-action]");
    if (!action?.dataset.name) return;
    const name = action.dataset.name;
    if (action.dataset.action === "info") return showFileInfo(name);
    if (action.dataset.action === "rename") return openRenameModal(name);
    if (action.dataset.action === "share") return copyPublicLinks([name]);
    if (action.dataset.action === "download") return downloadFile(name).catch((error) => showMessage(`Download failed: ${error.message}`, "error"));
    if (action.dataset.action === "delete" && window.confirm(`Delete ${getDisplayName(name)}?`)) deleteFiles([name]);
}

function handleFilesListChange(event) {
    const checkbox = event.target.closest(".file-card__check");
    if (!checkbox?.dataset.name) return;
    if (checkbox.checked) state.selectedUploaded.add(checkbox.dataset.name);
    else state.selectedUploaded.delete(checkbox.dataset.name);
    checkbox.closest(".file-card")?.classList.toggle("is-selected", checkbox.checked);
    updateSelectionToolbar();
}

function updateSelectionToolbar() {
    const visible = state.filteredFiles.slice(0, state.visibleCount);
    const allVisible = visible.length > 0 && visible.every((file) => state.selectedUploaded.has(file.name));
    elements.bulkActions.hidden = state.selectedUploaded.size === 0;
    elements.bulkCount.textContent = `${state.selectedUploaded.size} selected`;
    elements.selectVisibleBtn.disabled = !state.isLibraryLoaded || !visible.length;
    elements.selectVisibleBtn.textContent = allVisible ? "Clear Visible" : "Select Visible";
}

function toggleVisibleSelection() {
    const visible = state.filteredFiles.slice(0, state.visibleCount);
    if (!visible.length) return;
    const allVisible = visible.every((file) => state.selectedUploaded.has(file.name));
    visible.forEach((file) => allVisible ? state.selectedUploaded.delete(file.name) : state.selectedUploaded.add(file.name));
    renderLibrary();
}

async function deleteFiles(fileNames) {
    if (!supabaseClient || !fileNames.length) return;
    setButtonLoading(elements.deleteSelectedBtn, true, "Deleting...");
    try {
        const results = await Promise.allSettled(fileNames.map((fileName) => deleteFileWithRequest(fileName)));
        const failed = results
            .map((result, index) => ({ result, fileName: fileNames[index] }))
            .filter(({ result }) => result.status === "rejected");
        const deletedCount = fileNames.length - failed.length;

        if (deletedCount > 0) {
            const deletedNames = new Set(
                results
                    .map((result, index) => ({ result, fileName: fileNames[index] }))
                    .filter(({ result }) => result.status === "fulfilled")
                    .map(({ fileName }) => fileName)
            );

            state.files = state.files.filter((file) => !deletedNames.has(file.name));
            state.filteredFiles = state.filteredFiles.filter((file) => !deletedNames.has(file.name));
            deletedNames.forEach((name) => state.selectedUploaded.delete(name));
            renderLibrary();
            if (state.isLibraryLoaded) {
                await loadLibrary({ silent: true, trigger: "refresh" });
            }
        }

        if (!failed.length) {
            showMessage(`Deleted ${deletedCount} file(s).`, "success");
            return;
        }

        const firstError = failed[0].result.reason;
        throw new Error(buildDeleteFailureMessage(deletedCount, failed.length, firstError));
    } catch (error) {
        console.error(error);
        showMessage(`Delete failed: ${error.message}`, "error", 6500);
    } finally {
        setButtonLoading(elements.deleteSelectedBtn, false);
    }
}

async function downloadSelectedFiles() {
    const names = Array.from(state.selectedUploaded);
    if (!names.length) return showMessage("Select at least one file to download.", "info");
    setButtonLoading(elements.downloadSelectedBtn, true, "Preparing...");
    try {
        for (const name of names) await downloadFile(name);
        showMessage(`Downloaded ${names.length} file(s).`, "success");
    } catch (error) {
        console.error(error);
        showMessage(`Download failed: ${error.message}`, "error", 6500);
    } finally {
        setButtonLoading(elements.downloadSelectedBtn, false);
    }
}

async function downloadFile(fileName) {
    if (!supabaseClient) throw new Error("Supabase is not available.");
    const { data, error } = await supabaseClient.storage.from(CONFIG.bucket).download(fileName);
    if (error) throw error;
    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = getDisplayName(fileName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function copyPublicLinks(fileNames) {
    if (!fileNames.length) return showMessage("Select at least one file first.", "info");
    const text = fileNames.map((name) => getPublicUrl(name)).join("\n");
    try {
        await writeClipboard(text);
        showMessage(`Copied ${fileNames.length} public link(s).`, "success");
    } catch {
        showMessage("Clipboard access was blocked. Try again in a secure browsing context.", "error");
    }
}

function showFileInfo(fileName) {
    const file = state.files.find((entry) => entry.name === fileName);
    if (!file) return showMessage("That file is no longer available in the current library view.", "error");
    const display = escapeHtml(getDisplayName(file.name));
    const url = getPublicUrl(file.name);
    const kind = getFileKind(file);
    const preview = kind === "image"
        ? `<div class="preview-card__media"><img src="${url}" alt="${display}" loading="lazy"></div>`
        : kind === "video"
            ? `<div class="preview-card__media"><video src="${url}" controls preload="metadata"></video></div>`
            : `<div class="preview-card__media"><div class="icon-asset">FILE</div></div>`;
    elements.fileInfoContent.innerHTML = `
        ${preview}
        <div class="info-list">
            <div class="info-item"><strong>Name</strong><span>${display}</span></div>
            <div class="info-item"><strong>Stored Path</strong><span>${escapeHtml(file.name)}</span></div>
            <div class="info-item"><strong>Type</strong><span>${kind === "image" ? "Image" : kind === "video" ? "Video" : "File"}</span></div>
            <div class="info-item"><strong>Size</strong><span>${formatBytes(getFileSize(file))}</span></div>
            <div class="info-item"><strong>Created</strong><span>${formatDate(file.created_at || file.updated_at)}</span></div>
            <div class="info-item"><strong>Public URL</strong><a href="${url}" target="_blank" rel="noreferrer">${url}</a></div>
        </div>
    `;
    openModal(elements.fileInfoModal);
}

function openRenameModal(fileName) {
    const file = state.files.find((entry) => entry.name === fileName);
    if (!file) return showMessage("That file is no longer available in the current library view.", "error");
    const displayName = getDisplayName(file.name);
    const { stem } = splitFileNameParts(displayName);
    state.renameTarget = file.name;
    elements.renameCurrentName.textContent = displayName;
    elements.renameInput.value = stem;
    openModal(elements.renameModal);
    elements.renameInput.focus();
    elements.renameInput.select();
}

async function submitRename() {
    if (!supabaseClient) return showMessage("Supabase is not available. Rename cannot start.", "error");
    if (!state.renameTarget) return;
    const file = state.files.find((entry) => entry.name === state.renameTarget);
    if (!file) {
        closeModal(elements.renameModal);
        return showMessage("That file could not be found. Refresh the library and try again.", "error");
    }

    const requestedBaseName = elements.renameInput.value.trim().replace(/\s+/g, " ");
    if (!requestedBaseName) {
        elements.renameInput.focus();
        return showMessage("Enter a new file name before saving.", "info");
    }

    const originalDisplayName = getDisplayName(file.name);
    const { extension } = splitFileNameParts(originalDisplayName);
    const renamedDisplayName = `${requestedBaseName}${extension}`;
    if (sanitizeFileName(renamedDisplayName) === sanitizeFileName(originalDisplayName)) {
        closeModal(elements.renameModal);
        return showMessage("The file name is already the same.", "info");
    }

    const nextPath = buildStoragePath(renamedDisplayName);
    const wasSelected = state.selectedUploaded.has(file.name);
    setButtonLoading(elements.renameSubmitBtn, true, "Renaming...");

    try {
        const { data, error } = await supabaseClient.storage.from(CONFIG.bucket).download(file.name);
        if (error) throw error;

        const { error: uploadError } = await supabaseClient.storage.from(CONFIG.bucket).upload(nextPath, data, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.metadata?.mimetype || data.type || "application/octet-stream"
        });
        if (uploadError) throw uploadError;

        try {
            await deleteFileWithRequest(file.name);
        } catch (deleteError) {
            state.selectedUploaded.delete(file.name);
            if (wasSelected) state.selectedUploaded.add(nextPath);
            closeModal(elements.renameModal);
            await loadLibrary({ silent: true, trigger: "refresh" });
            showMessage(`Renamed copy created as ${getDisplayName(nextPath)}, but the old file could not be deleted. Remove it manually.`, "error", 7000);
            return;
        }

        state.selectedUploaded.delete(file.name);
        if (wasSelected) state.selectedUploaded.add(nextPath);
        closeModal(elements.renameModal);
        await loadLibrary({ silent: true, trigger: "refresh" });
        showMessage(`Renamed to ${getDisplayName(nextPath)}.`, "success");
    } catch (error) {
        console.error(error);
        showMessage(`Rename failed: ${error.message}`, "error", 6500);
    } finally {
        setButtonLoading(elements.renameSubmitBtn, false);
    }
}

async function showStats() {
    if (!state.isLibraryLoaded) await loadLibrary({ silent: true, trigger: "load" });
    if (!state.isLibraryLoaded) return;
    const totalFiles = state.files.length;
    const totalSize = getTotalLibrarySize();
    const images = state.files.filter((file) => getFileKind(file) === "image").length;
    const videos = state.files.filter((file) => getFileKind(file) === "video").length;
    const average = totalFiles ? totalSize / totalFiles : 0;
    const largest = state.files.reduce((best, file) => getFileSize(file) > getFileSize(best) ? file : best, state.files[0] || {});
    const usagePercent = CONFIG.storageQuotaBytes ? ((totalSize / CONFIG.storageQuotaBytes) * 100).toFixed(2) : "0.00";
    elements.statsContent.innerHTML = `
        <div class="stats-grid">
            <div class="stats-card"><strong>${totalFiles}</strong><span>Total files</span></div>
            <div class="stats-card"><strong>${formatBytes(totalSize)}</strong><span>Total storage used</span></div>
            <div class="stats-card"><strong>${images}</strong><span>Images</span></div>
            <div class="stats-card"><strong>${videos}</strong><span>Videos</span></div>
            <div class="stats-card"><strong>${formatBytes(average)}</strong><span>Average file size</span></div>
            <div class="stats-card"><strong>${usagePercent}%</strong><span>Of the configured ${formatBytes(CONFIG.storageQuotaBytes)} quota</span></div>
        </div>
        <div class="info-list">
            <div class="info-item"><strong>Largest file</strong><span>${largest.name ? `${escapeHtml(getDisplayName(largest.name))} - ${formatBytes(getFileSize(largest))}` : "No files available"}</span></div>
            <div class="info-item"><strong>Queue status</strong><span>${state.queue.filter((item) => item.selected).length} of ${state.queue.length} staged file(s) selected</span></div>
        </div>
    `;
    openModal(elements.statsModal);
}

function exportLibrary() {
    if (!state.isLibraryLoaded || !state.files.length) return showMessage("Load the library before exporting the file list.", "info");
    const rows = [
        ["display_name", "storage_name", "type", "size_bytes", "created_at", "public_url"],
        ...state.files.map((file) => [getDisplayName(file.name), file.name, getFileKind(file), String(getFileSize(file)), file.created_at || file.updated_at || "", getPublicUrl(file.name)])
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    downloadTextFile(csv, `my-cloud-service-export-${Date.now()}.csv`, "text/csv;charset=utf-8");
    showMessage("Library export generated.", "success");
}

function handleKeyboardShortcuts(event) {
    if (event.key === "Escape") return closeAllModals();
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "u") {
        event.preventDefault();
        if (!state.isUploading) elements.fileInput.click();
    }
    if (key === "s") {
        event.preventDefault();
        loadLibrary({ trigger: "load" });
    }
    if (key === "d") {
        event.preventDefault();
        applyTheme(state.theme === "dark" ? "light" : "dark", true);
    }
    if (key === "f") {
        event.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
    }
}

function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector("button, input, select, textarea, [href]")?.focus();
}

function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (modal === elements.renameModal) resetRenameForm();
    if (![elements.settingsModal, elements.fileInfoModal, elements.statsModal, elements.renameModal].some((entry) => entry && !entry.hidden)) {
        document.body.style.overflow = "";
    }
}

function closeAllModals() {
    closeModal(elements.settingsModal);
    closeModal(elements.fileInfoModal);
    closeModal(elements.statsModal);
    closeModal(elements.renameModal);
}

function setupInfiniteScroll() {
    if (!("IntersectionObserver" in window)) return;
    state.observer = new IntersectionObserver((entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!state.isLibraryLoaded || state.visibleCount >= state.filteredFiles.length) return;
        state.visibleCount += CONFIG.pageSize;
        renderLibrary();
    }, { rootMargin: "220px 0px" });
    state.observer.observe(elements.loadMoreSentinel);
}

function setupRevealObserver() {
    disconnectRevealObserver();
    if (state.settings.reduceMotion || !("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal-on-scroll").forEach((node) => node.classList.add("is-visible"));
        return;
    }
    state.revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            state.revealObserver?.unobserve(entry.target);
        });
    }, {
        threshold: 0.16,
        rootMargin: "0px 0px -6% 0px"
    });
    observeRevealTargets();
}

function observeRevealTargets(scope = document) {
    const targets = scope.querySelectorAll ? scope.querySelectorAll(".reveal-on-scroll:not(.is-visible)") : [];
    if (!targets.length) return;
    if (!state.revealObserver) {
        targets.forEach((node) => node.classList.add("is-visible"));
        return;
    }
    targets.forEach((node) => state.revealObserver.observe(node));
}

function disconnectRevealObserver() {
    if (!state.revealObserver) return;
    state.revealObserver.disconnect();
    state.revealObserver = null;
}

function updateMetrics() {
    elements.queueMetric.textContent = `${state.queue.length} file${state.queue.length === 1 ? "" : "s"}`;
    elements.libraryMetric.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"}`;
    elements.usageMetric.textContent = formatBytes(getTotalLibrarySize());
}

function removeQueueItems(ids) {
    const idSet = new Set(ids);
    state.queue = state.queue.filter((item) => {
        if (idSet.has(item.id)) {
            URL.revokeObjectURL(item.previewUrl);
            return false;
        }
        return true;
    });
    renderQueue();
}

function getTotalLibrarySize() {
    return state.files.reduce((sum, file) => sum + getFileSize(file), 0);
}

function getFileSize(file) {
    return Number(file?.metadata?.size) || 0;
}

function getFileKind(file) {
    const name = file?.name || "";
    const mime = file?.metadata?.mimetype || file?.type || "";
    if (mime.startsWith("image/") || /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(name)) return "image";
    if (mime.startsWith("video/") || /\.(m4v|mov|mp4|ogg|webm)$/i.test(name)) return "video";
    return "file";
}

function isSupportedFile(file) {
    const kind = getFileKind(file);
    return kind === "image" || kind === "video";
}

function canCompress(file) {
    return getFileKind(file) === "image" && !/\.gif$/i.test(file.name);
}

async function compressImageFile(file) {
    try {
        const raster = await loadRasterSource(file);
        const maxDimension = 2560;
        const scale = Math.min(1, maxDimension / Math.max(raster.width, raster.height));
        const width = Math.max(1, Math.round(raster.width * scale));
        const height = Math.max(1, Math.round(raster.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
            raster.cleanup();
            return file;
        }
        context.drawImage(raster.source, 0, 0, width, height);
        raster.cleanup();
        const outputType = file.type === "image/png" || file.type === "image/webp" ? "image/webp" : "image/jpeg";
        const quality = file.size > 8 * 1024 * 1024 ? 0.68 : file.size > 3 * 1024 * 1024 ? 0.76 : 0.84;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
        if (!blob || blob.size >= file.size * 0.98) return file;
        return new File([blob], replaceExtension(file.name, mimeToExtension(outputType)), { type: outputType, lastModified: file.lastModified });
    } catch (error) {
        console.warn("Compression skipped:", error);
        return file;
    }
}

async function loadRasterSource(file) {
    if ("createImageBitmap" in window) {
        const bitmap = await createImageBitmap(file);
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            cleanup() {
                if (typeof bitmap.close === "function") bitmap.close();
            }
        };
    }
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image preview could not be loaded."));
        img.src = objectUrl;
    });
    return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup() {
            URL.revokeObjectURL(objectUrl);
        }
    };
}

function buildStoragePath(name) {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}__${sanitizeFileName(name)}`;
}

function sanitizeFileName(name) {
    return name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

function getDisplayName(name) {
    const marker = "__";
    const index = name.indexOf(marker);
    return index === -1 ? name : name.slice(index + marker.length);
}

function splitFileNameParts(name) {
    const trimmed = String(name || "").trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return { stem: trimmed, extension: "" };
    return {
        stem: trimmed.slice(0, lastDot),
        extension: trimmed.slice(lastDot)
    };
}

function compareFiles(a, b, sortKey) {
    if (sortKey === "name") return getDisplayName(a.name).localeCompare(getDisplayName(b.name));
    if (sortKey === "size") return getFileSize(b) - getFileSize(a);
    return new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0);
}

function matchesFileFilter(file, query, filter) {
    const kind = getFileKind(file);
    const matchesQuery = getDisplayName(file.name).toLowerCase().includes(query);
    const matchesFilter = filter === "all" || filter === kind;
    return matchesQuery && matchesFilter;
}

function getPublicUrl(fileName) {
    if (!supabaseClient) return "";
    return supabaseClient.storage.from(CONFIG.bucket).getPublicUrl(fileName).data.publicUrl;
}

function getEmptyStateMarkup(kind, title, description) {
    const icons = {
        queue: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M7 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `,
        library: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4.75 7.75A2.75 2.75 0 0 1 7.5 5h9A2.75 2.75 0 0 1 19.25 7.75v8.5A2.75 2.75 0 0 1 16.5 19h-9a2.75 2.75 0 0 1-2.75-2.75z" stroke="currentColor" stroke-width="1.8"/>
                <path d="M8 14l2.2-2.2a1 1 0 0 1 1.4 0L14 14.2l1.4-1.4a1 1 0 0 1 1.4 0L19 14.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
            </svg>
        `,
        search: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="5.5" stroke="currentColor" stroke-width="1.8"/>
                <path d="M15.2 15.2L19 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `
    };

    return `
        <div class="empty-state">
            <div class="empty-state__icon" aria-hidden="true">${icons[kind] || icons.queue}</div>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

async function deleteFileWithRequest(fileName) {
    const bucket = encodeURIComponent(CONFIG.bucket);
    const path = fileName.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${CONFIG.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
        method: "DELETE",
        headers: {
            apikey: CONFIG.supabaseAnonKey,
            Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
        }
    });

    if (response.ok) {
        return;
    }

    const responseText = await response.text();
    throw new Error(parseSupabaseError(responseText) || `Delete failed with status ${response.status}.`);
}

function buildDeleteFailureMessage(deletedCount, failedCount, error) {
    const rawMessage = error?.message || "Unknown delete error.";
    const needsPolicyHint = /row-level security|permission|not allowed|403|unauthorized|access denied/i.test(rawMessage);
    const summary = deletedCount > 0
        ? `${deletedCount} deleted, ${failedCount} failed.`
        : `Unable to delete ${failedCount} file(s).`;

    if (needsPolicyHint) {
        return `${summary} Supabase is blocking anonymous deletes. Re-run supabase_setup.sql, then try again.`;
    }

    return `${summary} ${rawMessage}`;
}

function uploadFileWithProgress(job, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const bucket = encodeURIComponent(CONFIG.bucket);
        const path = job.path.split("/").map(encodeURIComponent).join("/");
        xhr.open("POST", `${CONFIG.supabaseUrl}/storage/v1/object/${bucket}/${path}`);
        xhr.setRequestHeader("apikey", CONFIG.supabaseAnonKey);
        xhr.setRequestHeader("Authorization", `Bearer ${CONFIG.supabaseAnonKey}`);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("cache-control", "3600");
        xhr.setRequestHeader("content-type", job.file.type || "application/octet-stream");
        xhr.upload.addEventListener("progress", (event) => event.lengthComputable && onProgress(event.loaded));
        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
            reject(new Error(parseSupabaseError(xhr.responseText) || `Upload failed with status ${xhr.status}.`));
        });
        xhr.addEventListener("error", () => reject(new Error("A network error interrupted the upload.")));
        xhr.send(job.file);
    });
}

function parseSupabaseError(text) {
    if (!text) return "";
    try {
        const parsed = JSON.parse(text);
        return parsed.message || parsed.error || parsed.msg || "";
    } catch {
        return text;
    }
}

function writeClipboard(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const ok = document.execCommand("copy");
            textarea.remove();
            ok ? resolve() : reject(new Error("Copy failed."));
        } catch (error) {
            textarea.remove();
            reject(error);
        }
    });
}

function showMessage(text, type = "info", duration = CONFIG.messageMs) {
    clearTimeout(state.messageTimer);
    elements.message.hidden = false;
    elements.message.className = `toast ${type}`;
    elements.message.textContent = text;
    if (duration > 0) {
        state.messageTimer = window.setTimeout(() => {
            elements.message.hidden = true;
            elements.message.className = "toast";
            elements.message.textContent = "";
        }, duration);
    }
}

function resetRenameForm() {
    state.renameTarget = null;
    elements.renameCurrentName.textContent = "-";
    elements.renameInput.value = "";
}

function setButtonLoading(button, isLoading, busyText = "Loading...") {
    if (!button) return;
    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
    if (isLoading) {
        button.style.width = `${Math.ceil(button.getBoundingClientRect().width)}px`;
        button.classList.add("is-loading");
        button.setAttribute("aria-busy", "true");
        button.setAttribute("aria-label", busyText);
        button.disabled = true;
        button.textContent = button.dataset.defaultText;
        return;
    }
    button.disabled = false;
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-label");
    button.textContent = button.dataset.defaultText;
    button.style.width = "";
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exp);
    return `${value.toFixed(value >= 100 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    const total = Math.ceil(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function formatDate(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeCsv(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTextFile(text, fileName, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function replaceExtension(name, ext) {
    return `${name.replace(/\.[^.]+$/, "")}.${ext}`;
}

function mimeToExtension(mime) {
    if (mime === "image/webp") return "webp";
    if (mime === "image/jpeg") return "jpg";
    return "bin";
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.location.protocol.startsWith("http")) return;
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

