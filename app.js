/* ==========================================================================
   PicToPDF Application Script (State, UI Mechanics, & PDF Generation)
   ========================================================================== */

// Make jsPDF & PDF.js worker available via standard ES global or UMD
const { jsPDF } = window.jspdf;

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
}

// App State Management
const STATE = {
    files: [],            // List of uploaded image structures
    activePageIdx: 0,     // Selected page for the virtual preview canvas
    theme: 'dark',        // Application color theme (dark or light)
    compiling: false,     // Conversion status tracker
    compiledCache: null,  // Cached compiled document block
    settings: {
        pageSize: 'original',    // 'original', 'a4', 'letter', 'legal', 'a3'
        orientation: 'auto',     // 'auto', 'portrait', 'landscape'
        margin: 'none',          // 'none', 'thin', 'normal'
        imageFitting: 'fit',     // 'fit', 'fill', 'stretch'
        imageQuality: 100,       // Default 100% (Original lossless quality, zero upload compression)
        mergeMode: 'single',     // 'single' (one combined PDF) or 'separate' (separate files)
        enablePassword: false,   // Whether password protection is enabled
        pdfPassword: '',         // The password for encryption
        watermarkText: ''        // Custom text to stamp diagonally on every page
    }
};

// DOM Cache Elements
const DOM = {
    body: document.body,
    dropZone: document.getElementById('dropZone'),
    globalDropOverlay: document.getElementById('globalDropOverlay'),
    fileInput: document.getElementById('fileInput'),
    btnBrowse: document.getElementById('btnBrowse'),
    btnPaste: document.getElementById('btnPaste'),
    imageListCard: document.getElementById('imageListCard'),
    imageListContainer: document.getElementById('imageListContainer'),
    fileCount: document.getElementById('fileCount'),
    btnClearAll: document.getElementById('btnClearAll'),
    pageSize: document.getElementById('pageSize'),
    orientationGroup: document.getElementById('orientationGroup'),
    imageFittingGroup: document.getElementById('imageFittingGroup'),
    virtualPreviewCanvas: document.getElementById('virtualPreviewCanvas'),
    previewPlaceholder: document.getElementById('previewPlaceholder'),
    previewPagination: document.getElementById('previewPagination'),
    currentPreviewPage: document.getElementById('currentPreviewPage'),
    totalPreviewPages: document.getElementById('totalPreviewPages'),
    prevPreview: document.getElementById('prevPreview'),
    nextPreview: document.getElementById('nextPreview'),
    btnConvert: document.getElementById('btnConvert'),
    sizeIndicatorGroup: document.getElementById('sizeIndicatorGroup'),
    estimatedPdfSize: document.getElementById('estimatedPdfSize'),
    settingsHeader: document.getElementById('settingsHeader'),
    settingsCard: document.querySelector('.settings-card'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    enablePassword: document.getElementById('enablePassword'),
    passwordInputContainer: document.getElementById('passwordInputContainer'),
    pdfPassword: document.getElementById('pdfPassword'),
    watermarkText: document.getElementById('watermarkText'),

    // Bottom Sticky Action Bar Elements
    bottomStickyBar: document.getElementById('bottomStickyBar'),
    stickyFileCount: document.getElementById('stickyFileCount'),
    stickyStatusBadge: document.getElementById('stickyStatusBadge'),
    stickyProgressContainer: document.getElementById('stickyProgressContainer'),
    stickyProgressText: document.getElementById('stickyProgressText'),
    stickyPdfDropdown: document.getElementById('stickyPdfDropdown'),
    btnStickyExportPdf: document.getElementById('btnStickyExportPdf'),
    btnStickySeparatePdf: document.getElementById('btnStickySeparatePdf'),
    btnStickySinglePdf: document.getElementById('btnStickySinglePdf'),
    stickyImgDropdown: document.getElementById('stickyImgDropdown'),
    btnStickySaveImages: document.getElementById('btnStickySaveImages'),
    btnStickySeparateImages: document.getElementById('btnStickySeparateImages'),
    btnStickyZipImages: document.getElementById('btnStickyZipImages'),

    // Edit Modal Elements
    editModal: document.getElementById('editModal'),
    closeEditModal: document.getElementById('closeEditModal'),
    toggleFullScreenEdit: document.getElementById('toggleFullScreenEdit'),
    cropSourceImage: document.getElementById('cropSourceImage'),
    cropWorkspace: document.getElementById('cropWorkspace'),
    cropBox: document.getElementById('cropBox'),
    cropAspectRatio: document.getElementById('cropAspectRatio'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnApplyEdit: document.getElementById('btnApplyEdit'),
    cropResizeHandle: document.getElementById('cropResizeHandle'),

    // Perspective Crop Elements
    togglePerspective: document.getElementById('togglePerspective'),
    perspectiveSvg: document.getElementById('perspectiveSvg'),
    perspectivePolygon: document.getElementById('perspectivePolygon'),
    perspectiveHandles: document.getElementById('perspectiveHandles'),
    phTl: document.getElementById('ph-tl'),
    phTr: document.getElementById('ph-tr'),
    phBr: document.getElementById('ph-br'),
    phBl: document.getElementById('ph-bl'),

    // Edit Modal Additional Tools
    tabCrop: document.getElementById('tab-crop'),
    tabFilters: document.getElementById('tab-filters'),
    tabLayout: document.getElementById('tab-layout'),
    btnRotateLeft: document.getElementById('btnRotateLeft'),
    btnRotateRight: document.getElementById('btnRotateRight'),

    // Filters
    filterBrightness: document.getElementById('filterBrightness'),
    filterContrast: document.getElementById('filterContrast'),
    filterGrayscale: document.getElementById('filterGrayscale'),
    filterSepia: document.getElementById('filterSepia'),
    valBrightness: document.getElementById('valBrightness'),
    valContrast: document.getElementById('valContrast'),
    valGrayscale: document.getElementById('valGrayscale'),
    valSepia: document.getElementById('valSepia'),
    btnResetFilters: document.getElementById('btnResetFilters'),

    // Per-image Layout Overrides
    overridePageSize: document.getElementById('overridePageSize'),
    overrideMargin: document.getElementById('overrideMargin')
};

// Standard Paper Presets Dimensions in Points (72 points = 1 inch)
const PAGE_PRESETS = {
    a4: { name: 'A4', width: 595.28, height: 841.89 },
    letter: { name: 'US Letter', width: 612.00, height: 792.00 },
    legal: { name: 'US Legal', width: 612.00, height: 1008.00 },
    a3: { name: 'A3', width: 841.89, height: 1190.55 }
};

// Standard Margin Sizes in Points
const MARGIN_SIZES = {
    none: 0,
    thin: 36,     // 0.5 inches
    normal: 72    // 1.0 inch
};

/* ==========================================================================
   Initialize & Theme Setup
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    updateUIState();
});

function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    STATE.theme = prefersDark ? 'dark' : 'light';
    applyTheme();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        STATE.theme = e.matches ? 'dark' : 'light';
        applyTheme();
    });
}

function applyTheme() {
    if (STATE.theme === 'dark') {
        DOM.body.classList.remove('light-theme');
        DOM.body.classList.add('dark-theme');
    } else {
        DOM.body.classList.remove('dark-theme');
        DOM.body.classList.add('light-theme');
    }
}

/* ==========================================================================
   Event Bindings
   ========================================================================== */
function hasFiles(types) {
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files' || types[i] === 'application/x-moz-file') return true;
    }
    return false;
}

function initEventListeners() {
    if (DOM.settingsHeader && DOM.settingsCard) {
        DOM.settingsHeader.addEventListener('click', () => {
            DOM.settingsCard.classList.toggle('collapsed');
        });
    }

    DOM.fileInput.addEventListener('change', handleFileSelection);

    if (DOM.btnBrowse) {
        DOM.btnBrowse.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.fileInput.click();
        });
    }

    if (DOM.btnPaste) {
        DOM.btnPaste.addEventListener('click', handlePasteButtonClick);
    }

    document.addEventListener('paste', handlePasteEvent);

    if (DOM.dropZone) {
        DOM.dropZone.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            DOM.fileInput.click();
        });
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            DOM.dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            DOM.dropZone.classList.remove('dragover');
        }, false);
    });

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
            dragCounter++;
            if (DOM.globalDropOverlay) {
                DOM.globalDropOverlay.style.display = 'flex';
                requestAnimationFrame(() => {
                    DOM.globalDropOverlay.classList.add('active');
                });
            }
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                if (DOM.globalDropOverlay) {
                    DOM.globalDropOverlay.classList.remove('active');
                    setTimeout(() => {
                        if (dragCounter <= 0) {
                            DOM.globalDropOverlay.style.display = 'none';
                        }
                    }, 300);
                }
            }
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;

        if (DOM.globalDropOverlay) {
            DOM.globalDropOverlay.classList.remove('active');
            DOM.globalDropOverlay.style.display = 'none';
        }

        if (DOM.dropZone) {
            DOM.dropZone.classList.remove('dragover');
        }

        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processFiles(files);
        }
    });

    DOM.btnClearAll.addEventListener('click', clearAllFiles);

    DOM.pageSize.addEventListener('change', (e) => {
        STATE.settings.pageSize = e.target.value;

        if (STATE.settings.pageSize === 'original') {
            DOM.orientationGroup.style.display = 'none';
            DOM.imageFittingGroup.style.display = 'none';
        } else {
            DOM.orientationGroup.style.display = 'flex';
            DOM.imageFittingGroup.style.display = 'flex';
        }

        updateUIState();
    });

    setupTabSelectors();

    const imageFittingSelect = document.getElementById('imageFitting');
    if (imageFittingSelect) {
        imageFittingSelect.addEventListener('change', (e) => {
            STATE.settings.imageFitting = e.target.value;
            updateUIState();
        });
    }

    setupSwitchSelectors();

    if (DOM.togglePasswordBtn && DOM.enablePassword && DOM.passwordInputContainer && DOM.pdfPassword) {
        DOM.togglePasswordBtn.addEventListener('click', (e) => {
            if (e.target !== DOM.enablePassword) {
                DOM.enablePassword.checked = !DOM.enablePassword.checked;
                const event = new Event('change');
                DOM.enablePassword.dispatchEvent(event);
            }
        });

        DOM.enablePassword.addEventListener('change', (e) => {
            STATE.settings.enablePassword = e.target.checked;
            if (e.target.checked) {
                DOM.passwordInputContainer.style.display = 'block';
                DOM.pdfPassword.focus();
            } else {
                DOM.passwordInputContainer.style.display = 'none';
                DOM.pdfPassword.value = '';
                STATE.settings.pdfPassword = '';
            }
            updateUIState();
        });

        DOM.pdfPassword.addEventListener('input', (e) => {
            STATE.settings.pdfPassword = e.target.value;
            updateUIState();
        });
    }

    if (DOM.watermarkText) {
        DOM.watermarkText.addEventListener('input', (e) => {
            STATE.settings.watermarkText = e.target.value;
            updateUIState();
        });
    }

    DOM.prevPreview.addEventListener('click', () => navigatePreview(-1));
    DOM.nextPreview.addEventListener('click', () => navigatePreview(1));

    DOM.btnConvert.addEventListener('click', convertImagesToPDF);

    // Bottom Sticky Action Bar Events
    if (DOM.btnStickyExportPdf) {
        DOM.btnStickyExportPdf.addEventListener('click', (e) => {
            e.stopPropagation();
            if (STATE.files.length === 0 || STATE.compiling) return;
            toggleStickyDropdown(DOM.stickyPdfDropdown);
        });
    }

    if (DOM.btnStickySaveImages) {
        DOM.btnStickySaveImages.addEventListener('click', (e) => {
            e.stopPropagation();
            if (STATE.files.length === 0 || STATE.compiling) return;
            toggleStickyDropdown(DOM.stickyImgDropdown);
        });
    }

    if (DOM.btnStickySeparatePdf) {
        DOM.btnStickySeparatePdf.addEventListener('click', (e) => {
            e.stopPropagation();
            exportSeparatePDFs();
        });
    }

    if (DOM.btnStickySinglePdf) {
        DOM.btnStickySinglePdf.addEventListener('click', (e) => {
            e.stopPropagation();
            exportSinglePDF();
        });
    }

    if (DOM.btnStickySeparateImages) {
        DOM.btnStickySeparateImages.addEventListener('click', (e) => {
            e.stopPropagation();
            saveSeparateImages();
        });
    }

    if (DOM.btnStickyZipImages) {
        DOM.btnStickyZipImages.addEventListener('click', (e) => {
            e.stopPropagation();
            saveZipImages();
        });
    }

    // Dismiss sticky dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sticky-dropdown-wrapper')) {
            closeAllStickyDropdowns();
        }
    });

    // Dismiss sticky dropdowns on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllStickyDropdowns();
        }
    });
}

function setupTabSelectors() {
    const tabGroups = document.querySelectorAll('.tab-selector');
    tabGroups.forEach(group => {
        const buttons = group.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const value = btn.getAttribute('data-value');
                if (group.classList.contains('margin-selector')) {
                    STATE.settings.margin = value;
                } else {
                    STATE.settings.orientation = value;
                }
                updateUIState();
            });
        });
    });
}

function setupSwitchSelectors() {
    const options = document.querySelectorAll('.switch-option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            STATE.settings.mergeMode = opt.getAttribute('data-value');
            updateUIState();
        });
    });
}

/* ==========================================================================
   File Reading & Loading State Mechanics
   ========================================================================== */
function handleFileSelection(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        processFiles(files);
    }
}

function applyLargeUploadDefaults() {
    STATE.settings.pageSize = 'original';
    STATE.settings.imageQuality = 100;

    if (DOM.pageSize) DOM.pageSize.value = 'original';
    if (DOM.orientationGroup) DOM.orientationGroup.style.display = 'none';
    if (DOM.imageFittingGroup) DOM.imageFittingGroup.style.display = 'none';

    STATE.files.forEach(fileObj => {
        fileObj.quality = 100;
        fileObj.exactPdfSize = (fileObj.currentBytes || fileObj.originalBytes) + 1500;
        fileObj.sizeFingerprint = getFileSizeFingerprint(fileObj);
    });

    DOM.imageListContainer.querySelectorAll('.inline-quality-slider').forEach(slider => {
        slider.value = 100;
    });
    DOM.imageListContainer.querySelectorAll('.inline-quality-badge').forEach(badge => {
        badge.textContent = 'Original';
    });
}

/* ==========================================================================
   Clipboard & Paste Mechanics
   ========================================================================== */
async function handlePasteEvent(e) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        if (activeEl.type === 'text' || activeEl.type === 'password' || activeEl.type === 'textarea' || activeEl.isContentEditable) {
            return;
        }
    }

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const filesToProcess = [];

    if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
            filesToProcess.push(clipboardData.files[i]);
        }
    }

    if (filesToProcess.length === 0 && clipboardData.items) {
        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                if (blob) {
                    const ext = blob.type ? (blob.type.includes('pdf') ? 'pdf' : blob.type.split('/')[1]) : 'png';
                    const fileName = blob.name && blob.name !== 'image.png' && blob.name !== 'blob'
                        ? blob.name
                        : `Pasted-Item-${Date.now()}-${i + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
                    const file = new File([blob], fileName, { type: blob.type || (ext === 'pdf' ? 'application/pdf' : 'image/png') });
                    filesToProcess.push(file);
                }
            } else if (item.kind === 'string' && item.type === 'text/plain') {
                item.getAsString((text) => {
                    const trimmed = text.trim();
                    if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/pdf')) {
                        try {
                            const isPdf = trimmed.includes('data:application/pdf');
                            const ext = isPdf ? 'pdf' : 'png';
                            const file = dataURLtoFile(trimmed, `Pasted-DataUrl-${Date.now()}.${ext}`);
                            if (file) {
                                triggerPasteFeedback(1);
                                processFiles([file]);
                            }
                        } catch (err) {
                            console.warn("Failed to parse pasted base64 data URL:", err);
                        }
                    }
                });
            }
        }
    }

    if (filesToProcess.length > 0) {
        e.preventDefault();
        triggerPasteFeedback(filesToProcess.length);
        processFiles(filesToProcess);
    }
}

async function handlePasteButtonClick(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const pastedFiles = [];

            for (let i = 0; i < clipboardItems.length; i++) {
                const item = clipboardItems[i];
                for (const type of item.types) {
                    if (type.startsWith('image/') || type === 'application/pdf') {
                        const blob = await item.getType(type);
                        const isPdf = type === 'application/pdf';
                        const ext = isPdf ? 'pdf' : type.split('/')[1];
                        const fileName = `Pasted-Item-${Date.now()}-${i + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
                        const file = new File([blob], fileName, { type });
                        pastedFiles.push(file);
                        break;
                    }
                }
            }

            if (pastedFiles.length > 0) {
                triggerPasteFeedback(pastedFiles.length);
                processFiles(pastedFiles);
                return;
            } else {
                showToast("No images or PDFs found in clipboard. Press Ctrl+V to paste your clipboard!");
                return;
            }
        } catch (err) {
            console.warn("Async clipboard read blocked or unavailable:", err);
            showToast("Press Ctrl+V (or Cmd+V) anywhere to paste your copied image or PDF!");
        }
    } else {
        showToast("Press Ctrl+V (or Cmd+V) anywhere to paste your copied image or PDF!");
    }
}

function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function triggerPasteFeedback(count) {
    if (DOM.dropZone) {
        DOM.dropZone.classList.add('dragover');
        setTimeout(() => {
            DOM.dropZone.classList.remove('dragover');
        }, 600);
    }
    showToast(`Pasted ${count} item${count > 1 ? 's' : ''} from clipboard!`);
}

function showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');

    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

// Render every page of an imported PDF document into crisp, high-resolution image records
async function processPdfFile(file) {
    if (typeof pdfjsLib === 'undefined') {
        alert("PDF import failed: PDF.js library is not loaded.");
        return [];
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageRecords = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 2.0;
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.98);

            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();

            const base64Length = dataUrl.length;
            const headerIndex = dataUrl.indexOf(',');
            const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
            const approxBytes = Math.round(dataLength * 0.75);

            const pageRecord = {
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                file: file,
                dataUrl: dataUrl,
                originalDataUrl: dataUrl,
                previewUrl: dataUrl,
                originalPreviewUrl: dataUrl,
                quality: 100,
                width: Math.round(viewport.width / scale),
                height: Math.round(viewport.height / scale),
                name: file.name,
                originalBytes: approxBytes,
                currentBytes: approxBytes,
                exactPdfSize: approxBytes + 1500,
                sizeText: formatFileSize(approxBytes),
                type: 'image/jpeg',
                isPdfPage: true,
                pdfPageNum: pageNum,
                pdfTotalPages: pdf.numPages
            };
            pageRecord.sizeFingerprint = getFileSizeFingerprint(pageRecord);

            pageRecords.push(pageRecord);
        }

        pdf.destroy();
        return pageRecords;
    } catch (err) {
        console.error("Failed to parse PDF file:", file.name, err);
        alert(`Failed to import PDF "${file.name}". The file might be password-protected or corrupted.`);
        return [];
    }
}

// Fast <1ms binary JPEG header parser (reads width/height without decoding the full image)
async function getFastImageDimensions(blob, previewUrl) {
    if (blob && (blob.type === 'image/jpeg' || blob.type === 'image/jpg')) {
        try {
            const slice = blob.slice(0, 65536);
            const buffer = await slice.arrayBuffer();
            const view = new DataView(buffer);
            if (view.byteLength >= 4 && view.getUint16(0, false) === 0xFFD8) {
                let offset = 2;
                while (offset + 9 < view.byteLength) {
                    if (view.getUint8(offset) !== 0xFF) break;
                    const marker = view.getUint8(offset + 1);
                    if (marker === 0xFF) {
                        offset++;
                        continue;
                    }
                    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                        const height = view.getUint16(offset + 5, false);
                        const width = view.getUint16(offset + 7, false);
                        if (width > 0 && height > 0) {
                            return { width, height };
                        }
                        break;
                    }
                    const segLength = view.getUint16(offset + 2, false);
                    if (segLength < 2) break;
                    offset += 2 + segLength;
                }
            }
        } catch (_) { }
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
        });
        img.onerror = () => resolve(null);
        img.src = previewUrl;
    });
}

async function createMicroThumbnail(blob, maxSize = 160) {
    try {
        const bmp = await createImageBitmap(blob);
        const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
        return URL.createObjectURL(thumbBlob);
    } catch (_) {
        return null;
    }
}

/**
 * Fast WebAssembly HEIC/HEIF Decoder via Dedicated Web Worker
 * Runs libheif + libde265 compiled to native WebAssembly in an isolated background thread.
 * Decodes 12MP-48MP HEVC bitstreams in ~1.5 - 2.5s on Windows Chrome.
 */
function decodeHeicWithWasmWorker(file, quality = 0.85) {
    return new Promise(async (resolve, reject) => {
        let worker = null;
        let timeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (worker) {
                try {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    worker.terminate();
                } catch (_) { }
                worker = null;
            }
        };

        const handleMessage = async (e) => {
            const data = e.data;
            if (!data) return;
            cleanup();

            if (!data.success) {
                return reject(new Error(data.error || 'WASM HEIC decoding failed'));
            }

            if (data.blob) {
                return resolve(data.blob);
            }

            // In case convertToBlob is not supported in the worker's OffscreenCanvas
            if (data.rawData) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = data.width;
                    canvas.height = data.height;
                    const ctx = canvas.getContext('2d');
                    const imgData = new ImageData(data.rawData, data.width, data.height);
                    ctx.putImageData(imgData, 0, 0);
                    canvas.toBlob((blob) => {
                        canvas.width = 0;
                        canvas.height = 0;
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas toBlob failed'));
                    }, 'image/jpeg', quality);
                } catch (canvasErr) {
                    reject(canvasErr);
                }
                return;
            }

            reject(new Error('Worker returned empty image data'));
        };

        const handleError = (err) => {
            cleanup();
            reject(new Error(err && err.message ? err.message : 'WASM Worker execution error'));
        };

        try {
            const buffer = await file.arrayBuffer();
            worker = new Worker('heic-worker.js?v=46');
            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('WASM HEIC worker timed out (45s)'));
            }, 45000);

            worker.postMessage({ id: 1, buffer, quality }, [buffer]);
        } catch (setupErr) {
            cleanup();
            reject(setupErr);
        }
    });
}

/**
 * Main-Thread WebAssembly HEIC Decoder (Tier 2 fallback if worker creation is blocked by file:// protocol)
 */
let _mainThreadWasmLock = Promise.resolve();
let _mainThreadLibheif = null;

function decodeHeicWithMainThreadWasm(buffer, quality = 0.85) {
    const run = async () => {
        if (!_mainThreadLibheif) {
            const factory = typeof libheif !== 'undefined' ? libheif : (typeof window !== 'undefined' ? window.libheif : null);
            if (typeof factory !== 'function') {
                throw new Error('libheif WebAssembly is not available on window');
            }
            _mainThreadLibheif = factory();
        }

        let decoder = null;
        let images = null;

        try {
            decoder = new _mainThreadLibheif.HeifDecoder();
            images = decoder.decode(new Uint8Array(buffer));

            if (!images || !images.length) {
                throw new Error('No HEIC/HEIF images found');
            }

            const img = images[0];
            const width = img.get_width();
            const height = img.get_height();

            if (!width || !height || width <= 0 || height <= 0) {
                throw new Error(`Invalid HEIC dimensions: ${width}x${height}`);
            }

            const rawData = new Uint8ClampedArray(width * height * 4);

            await new Promise((resolve, reject) => {
                img.display({ data: rawData, width, height }, (displayData) => {
                    if (!displayData) return reject(new Error('HEIC bitstream display failed'));
                    resolve(displayData);
                });
            });

            img.free();
            for (let i = 1; i < images.length; i++) {
                try { images[i].free(); } catch (_) { }
            }
            images = null;

            if (decoder.decoder && _mainThreadLibheif.heif_context_free) {
                try { _mainThreadLibheif.heif_context_free(decoder.decoder); } catch (_) { }
                decoder.decoder = null;
            }
            decoder = null;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imgData = new ImageData(rawData, width, height);
            ctx.putImageData(imgData, 0, 0);

            return await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    canvas.width = 0;
                    canvas.height = 0;
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                }, 'image/jpeg', quality);
            });
        } finally {
            if (images && images.length) {
                for (let i = 0; i < images.length; i++) {
                    try { images[i].free(); } catch (_) { }
                }
            }
            if (decoder && decoder.decoder && _mainThreadLibheif && _mainThreadLibheif.heif_context_free) {
                try { _mainThreadLibheif.heif_context_free(decoder.decoder); } catch (_) { }
            }
        }
    };

    const task = _mainThreadWasmLock.then(run, run);
    _mainThreadWasmLock = task.catch(() => {});
    return task;
}

// Optimized Modern Image Processing Pipeline (Native WebAssembly SIMD/HEVC pipeline)
async function processSingleImageFile(file) {
    let fileToProcess = file;
    let resolvedType = file.type;
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
    const isHeic = ext === 'heic' || ext === 'heif' || (resolvedType && (resolvedType.includes('heic') || resolvedType.includes('heif')));

    if (isHeic) {
        let convertedBlob = null;
        let isHeicConverted = false;
        const t0 = performance.now();

        // Tier 0: Safari / Apple hardware native decode (<30ms)
        try {
            const bmp = await createImageBitmap(file);
            if (bmp && bmp.width > 0 && bmp.height > 0) {
                const oc = typeof OffscreenCanvas !== 'undefined'
                    ? new OffscreenCanvas(bmp.width, bmp.height)
                    : document.createElement('canvas');
                oc.width = bmp.width;
                oc.height = bmp.height;
                const ctx = oc.getContext('2d');
                ctx.drawImage(bmp, 0, 0);
                bmp.close();
                if (oc.convertToBlob) {
                    convertedBlob = await oc.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
                } else if (oc.toBlob) {
                    convertedBlob = await new Promise(r => oc.toBlob(r, 'image/jpeg', 0.85));
                }
                if (convertedBlob) isHeicConverted = true;
            }
        } catch (_) { }

        // Tier 1: Dedicated Off-Main-Thread WebAssembly Worker (~2s in Chrome / Firefox)
        if (!isHeicConverted) {
            try {
                convertedBlob = await decodeHeicWithWasmWorker(file, 0.85);
                if (convertedBlob) isHeicConverted = true;
            } catch (wasmWorkerErr) {
                console.warn('[HEIC] Dedicated WASM worker unavailable, falling back:', wasmWorkerErr);
            }
        }

        // Tier 2: Main-Thread WebAssembly via libheif-bundle.js (if worker blocked by file://)
        if (!isHeicConverted) {
            try {
                const buf = await file.arrayBuffer();
                convertedBlob = await decodeHeicWithMainThreadWasm(buf, 0.85);
                if (convertedBlob) isHeicConverted = true;
            } catch (wasmMainErr) {
                console.warn('[HEIC] Main-thread WASM decode unavailable, falling back to heic-to.js:', wasmMainErr);
            }
        }

        // Tier 3: Universal fallback to heic-to.js
        if (!isHeicConverted) {
            const heicToFn = window.HeicTo?.heicTo || window.HeicTo || window.heicTo;
            if (!heicToFn) {
                alert("HEIC Conversion Failed: The transcoding library failed to load.");
                throw new Error("HEIC transcoder library is not loaded.");
            }

            try {
                const rawResult = await heicToFn({
                    blob: file,
                    type: 'image/jpeg',
                    quality: 0.85
                });
                convertedBlob = Array.isArray(rawResult) ? rawResult[0] : rawResult;
                if (convertedBlob) isHeicConverted = true;
            } catch (heicErr) {
                console.error('HEIC fallback conversion failed for:', file.name, heicErr);
                alert(`HEIC Transcoding Failed for "${file.name}": ${heicErr.message || heicErr}`);
                throw heicErr;
            }
        }

        if (convertedBlob) {
            const newName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
            fileToProcess = new File([convertedBlob], newName, { type: 'image/jpeg' });
            resolvedType = 'image/jpeg';
        }

        const t1 = performance.now();
        const secs = ((t1 - t0) / 1000).toFixed(1);
        console.log(`[HEIC] Transcoded "${file.name}" in ${secs}s`);
        if (typeof showToast === 'function') {
            showToast(`HEIC converted in ${secs}s`);
        }
    }

    if (!resolvedType || resolvedType === 'application/octet-stream') {
        const fileExt = fileToProcess.name ? fileToProcess.name.split('.').pop().toLowerCase() : '';
        if (fileExt === 'png') resolvedType = 'image/png';
        else if (fileExt === 'webp') resolvedType = 'image/webp';
        else if (fileExt === 'svg') resolvedType = 'image/svg+xml';
        else if (fileExt === 'gif') resolvedType = 'image/gif';
        else resolvedType = 'image/jpeg';
    }

    const previewUrl = URL.createObjectURL(fileToProcess);

    // <1ms binary header dimension reader (avoids full 24MP bitmap decode)
    let dims = await getFastImageDimensions(fileToProcess, previewUrl);
    if (!dims) {
        try {
            const bmp = await createImageBitmap(fileToProcess);
            dims = { width: bmp.width, height: bmp.height };
            bmp.close();
        } catch (_) { }
    }

    if (!dims) {
        URL.revokeObjectURL(previewUrl);
        alert("Unable to decode '" + fileToProcess.name + "'.");
        return [];
    }

    const approxBytes = fileToProcess.size;
    const thumbUrl = previewUrl;

    const fileRecord = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        file: fileToProcess,
        dataUrl: previewUrl,
        originalDataUrl: previewUrl,
        previewUrl: previewUrl,
        originalPreviewUrl: previewUrl,
        thumbUrl: thumbUrl,
        quality: 100,
        width: dims.width,
        height: dims.height,
        name: fileToProcess.name,
        originalBytes: approxBytes,
        currentBytes: approxBytes,
        exactPdfSize: approxBytes + 1500,
        sizeText: formatFileSize(approxBytes),
        type: resolvedType
    };
    fileRecord.sizeFingerprint = getFileSizeFingerprint(fileRecord);

    return [fileRecord];
}

// Parse uploaded assets (Images, HEIC, and PDFs)
async function processFiles(files) {
    const validFiles = Array.from(files).filter(f => {
        if (f.type && (f.type.startsWith('image/') || f.type === 'application/pdf')) {
            return true;
        }
        if (f.name) {
            const ext = f.name.split('.').pop().toLowerCase();
            const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif', 'bmp', 'tiff', 'pdf'];
            return validExtensions.includes(ext);
        }
        return false;
    });

    if (validFiles.length === 0) {
        alert('Please drop or select valid image files (JPEG, PNG, WebP, HEIC) or PDF documents.');
        return;
    }

    DOM.btnConvert.disabled = true;
    const btnTextEl = DOM.btnConvert.querySelector('.btn-text');
    const btnLoadEl = DOM.btnConvert.querySelector('.btn-loading');
    const spinnerEl = btnLoadEl ? btnLoadEl.querySelector('.spinner') : null;
    const progressEl = document.getElementById('compilationProgress');
    const glowBgEl = document.getElementById('glowBg');

    let hasHeicOrPdf = false;
    validFiles.forEach(file => {
        const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
        if (ext === 'heic' || ext === 'heif' || ext === 'pdf' || (file.type && (file.type.includes('heic') || file.type.includes('heif') || file.type.includes('pdf')))) {
            hasHeicOrPdf = true;
        }
    });

    // Disable continuous 60 FPS compositor triggers while decoding HEIC/PDF
    if (hasHeicOrPdf) {
        if (btnTextEl) btnTextEl.style.display = 'none';
        if (btnLoadEl) btnLoadEl.style.display = 'inline-flex';
        if (spinnerEl) spinnerEl.style.display = 'none'; // Stop SVG keyframe rotation
        if (glowBgEl) glowBgEl.style.display = 'none';   // Disable blur(120px) background passes
        DOM.btnConvert.classList.remove('btn-glow-active'); // Stop pulse shadow calculations
        if (progressEl) progressEl.textContent = 'Processing files...';
        await new Promise(r => setTimeout(r, 16));
    }

    async function runParallelPool(items, worker, concurrency) {
        const results = new Array(items.length);
        let nextIndex = 0;
        let completedCount = 0;
        const total = items.length;
        const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
            while (nextIndex < total) {
                const index = nextIndex++;
                if (progressEl && total > 1) {
                    progressEl.textContent = `Processing image ${index + 1} of ${total}...`;
                }
                try {
                    results[index] = await worker(items[index], index);
                } catch (poolErr) {
                    console.error("Pool processing error for item", index, poolErr);
                    results[index] = [];
                }
                completedCount++;
                if (progressEl && total > 1) {
                    progressEl.textContent = `Processed ${completedCount} of ${total}`;
                }
            }
        });
        await Promise.all(workers);
        return results;
    }

    try {
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        const fileConcurrency = hasHeicOrPdf
            ? Math.min(3, Math.max(2, hardwareConcurrency - 1))
            : Math.max(4, Math.min(8, hardwareConcurrency));

        const resultsArray = await runParallelPool(validFiles, async (file) => {
            const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
            const isPdf = ext === 'pdf' || (file.type && file.type === 'application/pdf');

            if (isPdf) {
                return await processPdfFile(file);
            } else {
                return await processSingleImageFile(file).catch(err => {
                    console.error("Skipping failed image file during extraction:", file.name, err);
                    return [];
                });
            }
        }, fileConcurrency);

        const allRecords = resultsArray.flat().filter(rec => rec !== null && rec !== undefined);

        if (allRecords.length > 0) {
            STATE.files.push(...allRecords);
            STATE.activePageIdx = STATE.files.length - 1;
            if (STATE.files.length > 50) {
                applyLargeUploadDefaults();
            }
            updateUIState();
        }
    } finally {
        DOM.fileInput.value = '';
        if (spinnerEl) spinnerEl.style.display = '';
        if (glowBgEl) glowBgEl.style.display = '';
        DOM.btnConvert.classList.add('btn-glow-active');
        if (btnTextEl && btnLoadEl) {
            btnTextEl.style.display = 'inline-flex';
            btnLoadEl.style.display = 'none';
        }
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updateSizeBadge(badge, label, bytes) {
    if (!badge) return;

    const isWaiting = typeof bytes === 'string' && bytes.toLowerCase() === 'wait';
    const formatted = isWaiting ? 'wait' : (typeof bytes === 'number' ? formatFileSize(bytes) : String(bytes || ''));
    const match = formatted.match(/^([\d.]+)\s*(Bytes|KB|MB)$/i);
    const number = isWaiting ? 'wait' : (match ? match[1] : formatted);
    const unit = isWaiting ? '' : (match ? match[2] : '');

    let labelEl = badge.querySelector('.size-label');
    let numberEl = badge.querySelector('.size-number');
    let unitEl = badge.querySelector('.size-unit');

    if (!labelEl || !numberEl || !unitEl) {
        badge.innerHTML = `
            <span class="size-label">${label}</span>
            <span class="size-number">${number}</span>
            <span class="size-unit">${unit}</span>
        `;
        labelEl = badge.querySelector('.size-label');
        numberEl = badge.querySelector('.size-number');
        unitEl = badge.querySelector('.size-unit');
    } else {
        labelEl.textContent = `${label}:`;
        const valueChanged = numberEl.textContent !== number || unitEl.textContent !== unit;
        numberEl.textContent = number;
        unitEl.textContent = unit;
        if (!valueChanged) return;
    }

    if (badge._sizeAnimationTimer) {
        clearTimeout(badge._sizeAnimationTimer);
    }
    numberEl.classList.remove('size-number-updating');
    void numberEl.offsetWidth;
    numberEl.classList.add('size-number-updating');
    badge._sizeAnimationTimer = setTimeout(() => {
        numberEl.classList.remove('size-number-updating');
    }, 180);
}

function revokeFileObjectUrls(fileObj) {
    if (!fileObj) return;
    if (fileObj.previewUrl && fileObj.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileObj.previewUrl);
    }
    if (fileObj.originalPreviewUrl && fileObj.originalPreviewUrl.startsWith('blob:') && fileObj.originalPreviewUrl !== fileObj.previewUrl) {
        URL.revokeObjectURL(fileObj.originalPreviewUrl);
    }
    if (fileObj.thumbUrl && fileObj.thumbUrl.startsWith('blob:') && fileObj.thumbUrl !== fileObj.previewUrl) {
        URL.revokeObjectURL(fileObj.thumbUrl);
    }
}

function clearAllFiles() {
    STATE.files.forEach(revokeFileObjectUrls);
    STATE.files = [];
    STATE.activePageIdx = 0;
    updateUIState();
}

/* ==========================================================================
   UI Redrawing & Canvas Generation
   ========================================================================== */
function updateUIState() {
    const fileCount = STATE.files.length;
    DOM.fileCount.textContent = fileCount;

    if (fileCount === 0) {
        DOM.imageListCard.style.display = 'none';
        DOM.btnConvert.disabled = true;

        if (DOM.btnStickyExportPdf) DOM.btnStickyExportPdf.disabled = true;
        if (DOM.btnStickySaveImages) DOM.btnStickySaveImages.disabled = true;
        if (DOM.stickyFileCount) DOM.stickyFileCount.textContent = '0 items';
        if (DOM.bottomStickyBar) DOM.bottomStickyBar.classList.add('is-empty');
        closeAllStickyDropdowns();

        DOM.previewPlaceholder.style.display = 'flex';
        const existingSheet = DOM.virtualPreviewCanvas.querySelector('.virtual-pdf-sheet');
        if (existingSheet) existingSheet.remove();

        DOM.previewPagination.style.display = 'none';

        if (DOM.sizeIndicatorGroup) {
            DOM.sizeIndicatorGroup.style.display = 'none';
        }
    } else {
        DOM.imageListCard.style.display = 'flex';
        DOM.btnConvert.disabled = STATE.compiling;
        DOM.previewPlaceholder.style.display = 'none';

        if (!STATE.compiling) {
            if (DOM.btnStickyExportPdf) DOM.btnStickyExportPdf.disabled = false;
            if (DOM.btnStickySaveImages) DOM.btnStickySaveImages.disabled = false;
        }
        if (DOM.stickyFileCount) DOM.stickyFileCount.textContent = `${fileCount} item${fileCount > 1 ? 's' : ''}`;
        if (DOM.bottomStickyBar) DOM.bottomStickyBar.classList.remove('is-empty');

        if (STATE.activePageIdx >= fileCount) {
            STATE.activePageIdx = fileCount - 1;
        }
        if (STATE.activePageIdx < 0) {
            STATE.activePageIdx = 0;
        }

        recalculateEstimatedPDFSize();
        renderUploadedGrid();
        renderVirtualLayoutPreview();
    }
}

function renderUploadedGrid() {
    DOM.imageListContainer.innerHTML = '';
    const gridFragment = document.createDocumentFragment();

    STATE.files.forEach((fileObj, index) => {
        const item = document.createElement('div');
        item.className = 'image-item-node animate-fade-in-up';
        item.style.animationDelay = `${Math.min(index * 0.02, 0.3)}s`;
        item.setAttribute('draggable', 'true');
        item.dataset.index = index;

        const isFirst = index === 0;
        const isLast = index === STATE.files.length - 1;

        const isEdited = fileObj.dataUrl !== fileObj.originalDataUrl || fileObj.filters || fileObj.rotation || fileObj.pageSizeOverride || fileObj.marginOverride;
        const sizeIsCurrent = fileObj.exactPdfSize &&
            fileObj.sizeFingerprint === getFileSizeFingerprint(fileObj);
        const individualSize = sizeIsCurrent ? fileObj.exactPdfSize : 0;

        const currentQuality = fileObj.quality || 100;
        const qualityLabel = currentQuality === 100 ? 'Original' : `${currentQuality}%`;
        const thumbSrc = fileObj.thumbUrl || fileObj.previewUrl || fileObj.dataUrl;

        item.innerHTML = `
            <img src="${thumbSrc}" alt="${fileObj.name}" class="node-thumbnail" loading="lazy" decoding="async">
            <div class="node-details">
                <h4><span class="node-order" title="Upload order">${index + 1}</span>${fileObj.name}</h4>
                <div class="node-meta" style="margin-bottom: 6px;">
                    <span class="badge-dim">${fileObj.width} x ${fileObj.height} px</span>
                    ${isEdited ? '<span class="badge cropped-badge">Edited</span>' : ''}
                    <span class="meta-divider"></span>
                    <span class="meta-text" title="Original File Size">${fileObj.sizeText}</span>
                    <span class="meta-divider"></span>
                    <span class="badge individual-pdf-size-badge" data-index="${index}" style="background-color: rgba(139, 92, 246, 0.08); color: var(--accent-solid); font-weight: 600;" title="Estimated PDF size for this page">
                        <span class="size-label">Size:</span>
                        <span class="size-number">${individualSize ? formatFileSize(individualSize).split(' ')[0] : '0'}</span>
                        <span class="size-unit">${individualSize ? formatFileSize(individualSize).split(' ')[1] : 'KB'}</span>
                    </span>
                </div>
                
                <!-- Per-Image Compression Slider -->
                <div class="inline-quality-control" style="margin-bottom: 8px; display: flex; align-items: center; gap: 0.5rem; max-width: 250px;">
                    <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; min-width: 50px;">Quality:</span>
                    <input type="range" class="inline-quality-slider" data-index="${index}" min="10" max="100" value="${currentQuality}" style="flex: 1; height: 4px; cursor: pointer;">
                    <span class="badge inline-quality-badge" data-index="${index}" style="font-size: 0.72rem; padding: 0.1rem 0.35rem; font-weight: 700; background-color: var(--border-color);">${qualityLabel}</span>
                </div>
                
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                    <button type="button" class="btn btn-secondary btn-crop-node" onclick="openEditInterface(${index})">
                        <i data-lucide="sliders" style="width: 11px; height: 11px;"></i> Edit
                    </button>
                    <button type="button" class="btn btn-secondary btn-crop-node" onclick="downloadSingleImage(${index})" title="Save page as image file">
                        <i data-lucide="image" style="width: 11px; height: 11px;"></i> Save Image
                    </button>
                    <button type="button" class="btn btn-secondary btn-crop-node" onclick="downloadSinglePDF(${index})" title="Save page as PDF file">
                        <i data-lucide="file-text" style="width: 11px; height: 11px;"></i> Save PDF
                    </button>
                    ${isEdited ? `
                    <button type="button" class="btn btn-tertiary btn-crop-node" style="color: #ef4444; padding: 0.25rem 0.4rem;" onclick="resetEdits(${index})">
                        <i data-lucide="rotate-ccw" style="width: 11px; height: 11px;"></i> Reset
                    </button>` : ''}
                </div>
            </div>
            <div class="node-controls">
                <button type="button" class="btn-circle" title="Move Up" ${isFirst ? 'disabled' : ''} onclick="swapFiles(${index}, ${index - 1})">
                    <i data-lucide="chevron-up"></i>
                </button>
                <button type="button" class="btn-circle btn-circle-delete" title="Remove image" onclick="removeFile(${index})">
                    <i data-lucide="trash-2"></i>
                </button>
                <button type="button" class="btn-circle" title="Move Down" ${isLast ? 'disabled' : ''} onclick="swapFiles(${index}, ${index + 1})">
                    <i data-lucide="chevron-down"></i>
                </button>
            </div>
        `;

        const inlineSlider = item.querySelector('.inline-quality-slider');
        const inlineBadge = item.querySelector('.inline-quality-badge');
        const inlineControlRow = item.querySelector('.inline-quality-control');
        let inlineQualityPreviewFrame = null;

        inlineSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            fileObj.quality = val;
            inlineBadge.textContent = val === 100 ? 'Original' : `${val}%`;
            fileObj.exactPdfSize = null;
            fileObj.sizeFingerprint = null;
            STATE.compiledCache = null;
            if (inlineQualityPreviewFrame !== null) cancelAnimationFrame(inlineQualityPreviewFrame);
            inlineQualityPreviewFrame = requestAnimationFrame(() => {
                inlineQualityPreviewFrame = null;
                updateIndividualSizeBadges();
                updateEstimatedTotalFromIndividualSizes();
            });
        });

        inlineSlider.addEventListener('change', () => {
            if (inlineQualityPreviewFrame !== null) {
                cancelAnimationFrame(inlineQualityPreviewFrame);
                inlineQualityPreviewFrame = null;
            }
            recalculateEstimatedPDFSize(parseInt(inlineSlider.getAttribute('data-index')));
        });

        const preventDrag = () => { item.draggable = false; };
        const restoreDrag = () => { item.draggable = true; };
        inlineSlider.addEventListener('pointerdown', preventDrag);
        inlineSlider.addEventListener('pointerup', restoreDrag);
        inlineSlider.addEventListener('pointercancel', restoreDrag);
        inlineSlider.addEventListener('pointerleave', restoreDrag);

        inlineControlRow.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        if (index === STATE.activePageIdx) {
            item.style.borderColor = 'var(--accent-solid)';
            item.style.backgroundColor = 'rgba(139, 92, 246, 0.04)';
        }

        item.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('i') || e.target.closest('input')) return;
            STATE.activePageIdx = index;
            updateUIState();
        });

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
            item.classList.add('dragging');
            setTimeout(() => { item.style.opacity = '0.4'; }, 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            item.style.opacity = '1';

            document.querySelectorAll('.image-item-node').forEach(node => {
                node.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });

        item.addEventListener('dragover', (e) => {
            if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
                return;
            }

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const rect = item.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            if (relY < rect.height / 2) {
                item.classList.add('drag-over-top');
                item.classList.remove('drag-over-bottom');
            } else {
                item.classList.add('drag-over-bottom');
                item.classList.remove('drag-over-top');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        item.addEventListener('drop', (e) => {
            if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
                return;
            }

            e.stopPropagation();
            e.preventDefault();

            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const dropIndex = index;

            item.classList.remove('drag-over-top', 'drag-over-bottom');

            if (dragIndex === dropIndex || isNaN(dragIndex)) return;

            const movedItem = STATE.files.splice(dragIndex, 1)[0];

            const rect = item.getBoundingClientRect();
            const relY = e.clientY - rect.top;

            let finalIndex = dropIndex;
            if (dragIndex < dropIndex) {
                finalIndex = relY < rect.height / 2 ? dropIndex - 1 : dropIndex;
            } else {
                finalIndex = relY < rect.height / 2 ? dropIndex : dropIndex + 1;
            }

            STATE.files.splice(finalIndex, 0, movedItem);

            if (STATE.activePageIdx === dragIndex) {
                STATE.activePageIdx = finalIndex;
            } else {
                if (STATE.activePageIdx > dragIndex && STATE.activePageIdx <= finalIndex) {
                    STATE.activePageIdx--;
                } else if (STATE.activePageIdx < dragIndex && STATE.activePageIdx >= finalIndex) {
                    STATE.activePageIdx++;
                }
            }

            updateUIState();
        });

        gridFragment.appendChild(item);
    });
    DOM.imageListContainer.appendChild(gridFragment);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function swapFiles(idxA, idxB) {
    const temp = STATE.files[idxA];
    STATE.files[idxA] = STATE.files[idxB];
    STATE.files[idxB] = temp;

    if (STATE.activePageIdx === idxA) {
        STATE.activePageIdx = idxB;
    } else if (STATE.activePageIdx === idxB) {
        STATE.activePageIdx = idxA;
    }

    updateUIState();
}

function removeFile(index) {
    const removed = STATE.files.splice(index, 1)[0];
    revokeFileObjectUrls(removed);
    if (STATE.activePageIdx >= STATE.files.length) {
        STATE.activePageIdx = Math.max(0, STATE.files.length - 1);
    }
    updateUIState();
}

function renderVirtualLayoutPreview() {
    const oldSheet = DOM.virtualPreviewCanvas.querySelector('.virtual-pdf-sheet');
    if (oldSheet) oldSheet.remove();

    const activeFile = STATE.files[STATE.activePageIdx];
    if (!activeFile) return;

    const sheet = document.createElement('div');
    sheet.className = 'virtual-pdf-sheet';

    let pageW = 1;
    let pageH = 1.414;

    const usedPageSize = (activeFile.pageSizeOverride && activeFile.pageSizeOverride !== 'global') ? activeFile.pageSizeOverride : STATE.settings.pageSize;
    const usedMargin = (activeFile.marginOverride && activeFile.marginOverride !== 'global') ? activeFile.marginOverride : STATE.settings.margin;

    if (usedPageSize === 'original') {
        pageW = activeFile.width;
        pageH = activeFile.height;
    } else {
        const preset = PAGE_PRESETS[usedPageSize];
        let orient = STATE.settings.orientation;

        if (orient === 'auto') {
            orient = activeFile.width >= activeFile.height ? 'landscape' : 'portrait';
        }

        if (orient === 'portrait') {
            pageW = preset.width;
            pageH = preset.height;
        } else {
            pageW = preset.height;
            pageH = preset.width;
        }
    }

    sheet.style.aspectRatio = `${pageW} / ${pageH}`;

    let marginPercent = 0;
    if (usedMargin === 'thin') {
        marginPercent = 5;
    } else if (usedMargin === 'normal') {
        marginPercent = 10;
    }

    sheet.style.setProperty('--guide-margin', `${marginPercent}%`);

    if (marginPercent > 0) {
        const guide = document.createElement('div');
        guide.className = 'virtual-margin-guide';
        sheet.appendChild(guide);
    }

    const imgElement = document.createElement('img');
    imgElement.src = activeFile.previewUrl || activeFile.dataUrl;
    imgElement.className = 'virtual-sheet-image';
    imgElement.decoding = 'async';

    sheet.style.padding = `${marginPercent}%`;

    if (usedPageSize === 'original') {
        imgElement.style.objectFit = 'fill';
    } else {
        const fitting = STATE.settings.imageFitting;

        if (fitting === 'fit') {
            imgElement.style.objectFit = 'contain';
        } else if (fitting === 'fill') {
            imgElement.style.objectFit = 'cover';
        } else {
            imgElement.style.objectFit = 'fill';
        }
    }

    sheet.appendChild(imgElement);
    DOM.virtualPreviewCanvas.appendChild(sheet);

    if (STATE.files.length > 1) {
        DOM.previewPagination.style.display = 'flex';
        DOM.currentPreviewPage.textContent = STATE.activePageIdx + 1;
        DOM.totalPreviewPages.textContent = STATE.files.length;
    } else {
        DOM.previewPagination.style.display = 'none';
    }
}

function navigatePreview(dir) {
    STATE.activePageIdx += dir;
    updateUIState();
}

/* ==========================================================================
   Sticky Bottom Bar & Export Actions (PDFs & Images)
   ========================================================================== */
function toggleStickyDropdown(dropdownEl) {
    if (!dropdownEl) return;
    const wasOpen = dropdownEl.classList.contains('is-open');
    closeAllStickyDropdowns();
    if (!wasOpen) {
        dropdownEl.classList.add('is-open');
        const trigger = dropdownEl.querySelector('.sticky-action-btn');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
}

function closeAllStickyDropdowns() {
    document.querySelectorAll('.sticky-dropdown-wrapper').forEach(wrapper => {
        wrapper.classList.remove('is-open');
        const trigger = wrapper.querySelector('.sticky-action-btn');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
}

function updateStickyProgress(show, text = '') {
    const glowBgEl = document.getElementById('glowBg');
    const spinnerEl = DOM.btnConvert ? DOM.btnConvert.querySelector('.spinner') : null;

    if (DOM.stickyProgressContainer) {
        DOM.stickyProgressContainer.style.display = show ? 'inline-flex' : 'none';
    }
    if (DOM.stickyProgressText && text) {
        DOM.stickyProgressText.textContent = text;
    }
    if (DOM.stickyStatusBadge) {
        DOM.stickyStatusBadge.style.display = show ? 'none' : 'inline-flex';
    }

    if (DOM.btnConvert) {
        const btnTextEl = DOM.btnConvert.querySelector('.btn-text');
        const btnLoadEl = DOM.btnConvert.querySelector('.btn-loading');
        const progressEl = document.getElementById('compilationProgress');

        if (show) {
            DOM.btnConvert.disabled = true;
            if (btnTextEl) btnTextEl.style.display = 'none';
            if (btnLoadEl) btnLoadEl.style.display = 'inline-flex';
            if (progressEl) progressEl.textContent = text;

            // Kill heavy GPU compositor filters while compiling
            if (glowBgEl) glowBgEl.style.display = 'none';
            DOM.btnConvert.classList.remove('btn-glow-active');
        } else {
            DOM.btnConvert.disabled = STATE.files.length === 0;
            if (btnTextEl) btnTextEl.style.display = 'inline-flex';
            if (btnLoadEl) btnLoadEl.style.display = 'none';

            // Restore effects when idle
            if (glowBgEl) glowBgEl.style.display = '';
            DOM.btnConvert.classList.add('btn-glow-active');
        }
    }
}
function setStickyActionsDisabled(disabled) {
    if (DOM.btnStickyExportPdf) DOM.btnStickyExportPdf.disabled = disabled;
    if (DOM.btnStickySaveImages) DOM.btnStickySaveImages.disabled = disabled;
    if (DOM.btnConvert) DOM.btnConvert.disabled = disabled || STATE.files.length === 0;
}

// 1st: Export PDF -> Single PDF (Multi-page)
async function exportSinglePDF() {
    if (STATE.files.length === 0 || STATE.compiling) return;
    closeAllStickyDropdowns();
    STATE.compiling = true;
    setStickyActionsDisabled(true);
    updateStickyProgress(true, 'Compiling Single PDF (0%)...');

    try {
        const fingerprint = STATE.files.map(f => f.id).join(',');
        const qFingerprint = STATE.files.map(f => f.quality || 100).join(',');

        let compiledResult = null;
        const compiledCacheMatches = STATE.compiledCache &&
            STATE.compiledCache.pageSize === STATE.settings.pageSize &&
            STATE.compiledCache.orientation === STATE.settings.orientation &&
            STATE.compiledCache.margin === STATE.settings.margin &&
            STATE.compiledCache.imageFitting === STATE.settings.imageFitting &&
            STATE.compiledCache.mergeMode === 'single' &&
            STATE.compiledCache.filesLength === STATE.files.length &&
            STATE.compiledCache.filesFingerprint === fingerprint &&
            STATE.compiledCache.qualitiesFingerprint === qFingerprint &&
            STATE.compiledCache.enablePassword === STATE.settings.enablePassword &&
            STATE.compiledCache.pdfPassword === STATE.settings.pdfPassword &&
            STATE.compiledCache.watermarkText === STATE.settings.watermarkText &&
            STATE.compiledCache.data;

        if (compiledCacheMatches) {
            compiledResult = STATE.compiledCache.data;
            updateStickyProgress(true, 'Saving Single PDF...');
        } else {
            compiledResult = await compilePDFDocument(async (curr, tot) => {
                const percent = Math.round((curr / tot) * 100);
                updateStickyProgress(true, `Compiling Single PDF (${percent}%)...`);
                if (curr % 4 === 0 || curr === tot) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }, null, 'single');
        }

        if (compiledResult && compiledResult.doc) {
            compiledResult.doc.save('pictopdf_compiled.pdf');
            showToast('Single PDF exported successfully!');
        }
    } catch (err) {
        console.error('Export Single PDF failed:', err);
        alert('An error occurred while compiling your Single PDF.');
    } finally {
        STATE.compiling = false;
        updateStickyProgress(false);
        setStickyActionsDisabled(false);
        updateUIState();
    }
}

// 1st: Export PDF -> Separate PDFs (Batch individual PDFs)
async function exportSeparatePDFs() {
    if (STATE.files.length === 0 || STATE.compiling) return;
    closeAllStickyDropdowns();
    STATE.compiling = true;
    setStickyActionsDisabled(true);
    updateStickyProgress(true, 'Compiling PDFs (0%)...');

    try {
        const compiledResult = await compilePDFDocument(async (curr, tot) => {
            const percent = Math.round((curr / tot) * 100);
            updateStickyProgress(true, `Compiling PDFs (${percent}%)...`);
            if (curr % 4 === 0 || curr === tot) {
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }, null, 'separate');

        if (compiledResult && compiledResult.docs) {
            const total = compiledResult.docs.length;
            for (let i = 0; i < total; i++) {
                const imgData = STATE.files[i];
                const cleanName = (imgData.name || `page_${i + 1}`).replace(/\.[^/.]+$/, "").replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, "_") || `page_${i + 1}`;
                const fileName = total > 1 ? `${cleanName}_page_${i + 1}.pdf` : `${cleanName}_converted.pdf`;
                updateStickyProgress(true, `Saving PDF ${i + 1} of ${total}...`);
                compiledResult.docs[i].save(fileName);
                if (i < total - 1) {
                    await delay(350);
                }
            }
            showToast(`Exported ${total} separate PDF${total > 1 ? 's' : ''}!`);
        }
    } catch (err) {
        console.error('Export Separate PDFs failed:', err);
        alert('An error occurred while compiling separate PDFs.');
    } finally {
        STATE.compiling = false;
        updateStickyProgress(false);
        setStickyActionsDisabled(false);
        updateUIState();
    }
}

// Converts non-JPEG or transparent data URLs to pristine standard JPEG without double recompressing
async function ensureJpegDataUrl(dataUrl) {
    if (dataUrl && (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('blob:'))) {
        return dataUrl;
    }
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.98);
            canvas.width = 0;
            canvas.height = 0;
            resolve(jpegUrl);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// Save Images -> Separate Images (Batch JPG downloads using cache directly),stricly jpg
async function saveSeparateImages() {
    if (STATE.files.length === 0 || STATE.compiling) return;
    closeAllStickyDropdowns();
    STATE.compiling = true;
    setStickyActionsDisabled(true);
    updateStickyProgress(true, 'Preparing JPG images...');

    try {
        const total = STATE.files.length;
        for (let i = 0; i < total; i++) {
            const fileObj = STATE.files[i];
            updateStickyProgress(true, `Saving image ${i + 1} of ${total}...`);

            const quality = fileObj.quality || 100;
            const cleanName = (fileObj.name || `image_${i + 1}`).replace(/\.[^/.]+$/, "").replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, "_") || `image_${i + 1}`;
            const fileName = total > 1 ? `${cleanName}_${i + 1}.jpg` : `${cleanName}_extracted.jpg`;

            let downloadUrl = null;
            let revokeNeeded = false;

            // 1. Quality 100% and unedited: use original file/preview directly
            const isNativeJpeg = fileObj.type === 'image/jpeg' || fileObj.type === 'image/jpg';
            if (quality === 100 && isNativeJpeg && (!fileObj.editCount || fileObj.editCount === 0)) {
                downloadUrl = fileObj.previewUrl || fileObj.dataUrl;
            } else {
                // 2. Check if already compressed by slider in cache
                const qualityCache = qualityRatioCache.get(fileObj.previewUrl || fileObj.dataUrl);
                const cacheKey = `${quality}|${fileObj.type}`;

                if (qualityCache && qualityCache.has(cacheKey)) {
                    const cached = await qualityCache.get(cacheKey);
                    downloadUrl = cached.blob ? URL.createObjectURL(cached.blob) : cached.url;
                    if (cached.blob) revokeNeeded = true;
                } else {
                    const processed = await processQualityRatio(
                        fileObj.previewUrl || fileObj.dataUrl,
                        fileObj.type,
                        quality,
                        fileObj.currentBytes || fileObj.originalBytes
                    );
                    downloadUrl = processed.blob ? URL.createObjectURL(processed.blob) : processed.url;
                    if (processed.blob) revokeNeeded = true;
                }
            }

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (revokeNeeded) {
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
            }

            if (i < total - 1) {
                await delay(350);
            }
        }
        showToast(`Saved ${total} separate JPG image${total > 1 ? 's' : ''}!`);
    } catch (err) {
        console.error('Save Separate Images failed:', err);
        alert('An error occurred while saving JPG images.');
    } finally {
        STATE.compiling = false;
        updateStickyProgress(false);
        setStickyActionsDisabled(false);
        updateUIState();
    }
}

// 2nd: Save Images -> Zip Images (All images packaged into .zip)
// Save Images -> Zip Images (Uses already-compressed cache directly, 0% extra GPU)
async function saveZipImages() {
    if (STATE.files.length === 0 || STATE.compiling) return;
    closeAllStickyDropdowns();

    if (typeof JSZip === 'undefined') {
        alert('JSZip library is not loaded. Please refresh the page and try again.');
        return;
    }

    STATE.compiling = true;
    setStickyActionsDisabled(true);
    updateStickyProgress(true, 'Preparing images for ZIP...');

    try {
        const zip = new JSZip();
        const total = STATE.files.length;

        for (let i = 0; i < total; i++) {
            updateStickyProgress(true, `Adding image ${i + 1} of ${total}...`);
            const fileObj = STATE.files[i];
            const quality = fileObj.quality || 100;
            const cleanName = (fileObj.name || `image_${i + 1}`).replace(/\.[^/.]+$/, "").replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, "_") || `image_${i + 1}`;

            let finalBlob = null;

            // 1. If 100% and unedited, take the existing file directly (0ms)
            if (quality === 100 && fileObj.file && (!fileObj.editCount || fileObj.editCount === 0)) {
                finalBlob = fileObj.file;
            } else {
                // 2. Already compressed when slider moved? Instant cache hit!
                const qualityCache = qualityRatioCache.get(fileObj.previewUrl || fileObj.dataUrl);
                const cacheKey = `${quality}|${fileObj.type}`;

                if (qualityCache && qualityCache.has(cacheKey)) {
                    const cached = await qualityCache.get(cacheKey);
                    finalBlob = cached.blob;
                }

                // 3. Fallback only if not in cache yet
                if (!finalBlob) {
                    const processed = await processQualityRatio(
                        fileObj.previewUrl || fileObj.dataUrl,
                        fileObj.type,
                        quality,
                        fileObj.currentBytes || fileObj.originalBytes
                    );
                    finalBlob = processed.blob || await (await fetch(processed.url)).blob();
                }
            }

            const ext = (fileObj.type && fileObj.type.includes('png')) ? 'png' : 'jpg';
            const fileName = total > 1 ? `${cleanName}_${i + 1}.${ext}` : `${cleanName}.${ext}`;

            zip.file(fileName, finalBlob);
        }

        updateStickyProgress(true, 'Compressing ZIP archive (0%)...');
        const zipBlob = await zip.generateAsync(
            { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
            (meta) => {
                if (meta.percent) {
                    updateStickyProgress(true, `Compressing ZIP (${Math.round(meta.percent)}%)...`);
                }
            }
        );

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'pictopdf_images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 15000);

        showToast(`Saved all ${total} images in pictopdf_images.zip!`);
    } catch (err) {
        console.error('Save Zip Images failed:', err);
        alert('An error occurred while creating the ZIP archive.');
    } finally {
        STATE.compiling = false;
        updateStickyProgress(false);
        setStickyActionsDisabled(false);
        updateUIState();
    }
}

async function convertImagesToPDF() {
    if (STATE.files.length === 0 || STATE.compiling) return;
    if (STATE.settings.mergeMode === 'single') {
        await exportSinglePDF();
    } else {
        await exportSeparatePDFs();
    }
}

/* ==========================================================================
   Image Extraction & Saving
   ========================================================================== */
// Per-card "Save Image" button: uses cache directly
async function downloadSingleImage(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    try {
        const quality = fileObj.quality || 100;
        const cleanName = fileObj.name.replace(/\.[^/.]+$/, "").replace(/[^\w\s-]/gi, '').replace(/\s+/g, "_");
        const fileName = `${cleanName}_extracted.jpg`;

        let downloadUrl = null;
        let revokeNeeded = false;

        const isNativeJpeg = fileObj.type === 'image/jpeg' || fileObj.type === 'image/jpg';
        if (quality === 100 && isNativeJpeg && (!fileObj.editCount || fileObj.editCount === 0)) {
            downloadUrl = fileObj.previewUrl || fileObj.dataUrl;
        } else {
            const qualityCache = qualityRatioCache.get(fileObj.previewUrl || fileObj.dataUrl);
            const cacheKey = `${quality}|${fileObj.type}`;

            if (qualityCache && qualityCache.has(cacheKey)) {
                const cached = await qualityCache.get(cacheKey);
                downloadUrl = cached.blob ? URL.createObjectURL(cached.blob) : cached.url;
                if (cached.blob) revokeNeeded = true;
            } else {
                const processed = await processQualityRatio(
                    fileObj.previewUrl || fileObj.dataUrl,
                    fileObj.type,
                    quality,
                    fileObj.currentBytes || fileObj.originalBytes
                );
                downloadUrl = processed.blob ? URL.createObjectURL(processed.blob) : processed.url;
                if (processed.blob) revokeNeeded = true;
            }
        }

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (revokeNeeded) {
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
        }
    } catch (err) {
        console.error("Failed to download image:", err);
        alert("Failed to download image. Check console details.");
    }
}

async function compilePDFDocument(progressCallback, cancellationToken = null, forceMode = null) {
    const count = STATE.files.length;
    if (count === 0) return null;

    const mode = forceMode || STATE.settings.mergeMode;

    if (mode === 'single') {
        let doc = null;

        const processingPromises = STATE.files.map(imgData => {
            const quality = imgData.quality || 100;
            return processQualityRatio(
                imgData.previewUrl || imgData.dataUrl,
                imgData.type,
                quality,
                imgData.currentBytes || imgData.originalBytes
            );
        });

        for (let i = 0; i < count; i++) {
            if (cancellationToken && cancellationToken.cancelled) return null;
            if (progressCallback) await progressCallback(i, count);

            const imgData = STATE.files[i];
            const processedImage = await processingPromises[i];

            const imageBytes = processedImage.byteSize || imgData.currentBytes || imgData.originalBytes;
            imgData.exactPdfSize = imageBytes + 1500;
            imgData.sizeFingerprint = getFileSizeFingerprint(imgData);

            const usedPageSize = (imgData.pageSizeOverride && imgData.pageSizeOverride !== 'global') ? imgData.pageSizeOverride : STATE.settings.pageSize;
            const usedMargin = (imgData.marginOverride && imgData.marginOverride !== 'global') ? imgData.marginOverride : STATE.settings.margin;

            const pageConfig = getPageDimensionsAndImageBounds(
                imgData.width,
                imgData.height,
                usedPageSize,
                STATE.settings.orientation,
                usedMargin,
                STATE.settings.imageFitting
            );

            const docConfig = {
                orientation: pageConfig.pageW > pageConfig.pageH ? 'l' : 'p',
                unit: 'pt',
                format: [pageConfig.pageW, pageConfig.pageH]
            };

            if (STATE.settings.enablePassword && STATE.settings.pdfPassword) {
                docConfig.encryption = {
                    userPermissions: ["print", "modify", "copy", "annot-forms"],
                    userPassword: STATE.settings.pdfPassword,
                    ownerPassword: STATE.settings.pdfPassword
                };
            }

            if (i === 0) {
                doc = new jsPDF(docConfig);
            } else {
                doc.addPage([pageConfig.pageW, pageConfig.pageH], pageConfig.pageW > pageConfig.pageH ? 'l' : 'p');
            }

            doc.addImage(
                processedImage.url,
                processedImage.format,
                pageConfig.imgX,
                pageConfig.imgY,
                pageConfig.imgW,
                pageConfig.imgH
            );

            if (STATE.settings.watermarkText) {
                applyWatermark(doc, pageConfig, STATE.settings.watermarkText);
            }
        }

        if (progressCallback) await progressCallback(count, count);
        const blob = doc.output('blob');
        return { doc, blob, size: blob.size };
    } else {
        const docs = [];
        const blobs = [];
        let totalSize = 0;

        for (let i = 0; i < count; i++) {
            if (cancellationToken && cancellationToken.cancelled) return null;
            if (progressCallback) await progressCallback(i, count);

            const imgData = STATE.files[i];
            const quality = imgData.quality || 100;

            let processedUrl = null;
            let processedFormat = (imgData.type && imgData.type.includes('png')) ? 'PNG' : 'JPEG';

            // Check if slider already compressed this in cache
            const qualityCache = qualityRatioCache.get(imgData.previewUrl || imgData.dataUrl);
            const cacheKey = `${quality}|${imgData.type}`;

            if (quality === 100) {
                processedUrl = imgData.previewUrl || imgData.dataUrl;
            } else if (qualityCache && qualityCache.has(cacheKey)) {
                const cached = await qualityCache.get(cacheKey);
                processedUrl = cached.url;
                processedFormat = cached.format || 'JPEG';
            } else {
                const processed = await processQualityRatio(
                    imgData.previewUrl || imgData.dataUrl,
                    imgData.type,
                    quality,
                    imgData.currentBytes || imgData.originalBytes
                );
                processedUrl = processed.url;
                processedFormat = processed.format || 'JPEG';
            }

            const usedPageSize = (imgData.pageSizeOverride && imgData.pageSizeOverride !== 'global') ? imgData.pageSizeOverride : STATE.settings.pageSize;
            const usedMargin = (imgData.marginOverride && imgData.marginOverride !== 'global') ? imgData.marginOverride : STATE.settings.margin;

            const pageConfig = getPageDimensionsAndImageBounds(
                imgData.width,
                imgData.height,
                usedPageSize,
                STATE.settings.orientation,
                usedMargin,
                STATE.settings.imageFitting
            );

            const docConfig = {
                orientation: pageConfig.pageW > pageConfig.pageH ? 'l' : 'p',
                unit: 'pt',
                format: [pageConfig.pageW, pageConfig.pageH]
            };

            if (STATE.settings.enablePassword && STATE.settings.pdfPassword) {
                docConfig.encryption = {
                    userPermissions: ["print", "modify", "copy", "annot-forms"],
                    userPassword: STATE.settings.pdfPassword,
                    ownerPassword: STATE.settings.pdfPassword
                };
            }

            const itemDoc = new jsPDF(docConfig);

            itemDoc.addImage(
                processedUrl,
                processedFormat,
                pageConfig.imgX,
                pageConfig.imgY,
                pageConfig.imgW,
                pageConfig.imgH
            );

            if (STATE.settings.watermarkText) {
                applyWatermark(itemDoc, pageConfig, STATE.settings.watermarkText);
            }

            const itemBlob = itemDoc.output('blob');
            totalSize += itemBlob.size;

            imgData.exactPdfSize = itemBlob.size;
            imgData.sizeFingerprint = getFileSizeFingerprint(imgData);

            docs.push(itemDoc);
            blobs.push(itemBlob);
        }

        if (progressCallback) await progressCallback(count, count);
        return { docs, blobs, size: totalSize };
    }

}
function applyWatermark(doc, pageConfig, text) {
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(42);
    doc.text(text, pageConfig.pageW / 2, pageConfig.pageH / 2, {
        align: 'center',
        angle: 45
    });
}

// Built-in client-side compression
let activeCanvasTasks = 0;
const canvasTaskWaiters = [];
const qualityRatioCache = new Map();

function getCanvasConcurrency() {
    return Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4));
}

async function runCanvasTask(task) {
    const concurrency = getCanvasConcurrency();

    activeCanvasTasks++;
    if (activeCanvasTasks > concurrency) {
        await new Promise(resolve => canvasTaskWaiters.push(resolve));
    }

    try {
        return await task();
    } finally {
        activeCanvasTasks--;
        const next = canvasTaskWaiters.shift();
        if (next) next();
    }
}

// Fast Hardware-Accelerated Quality Compressor (Exact Original Dimensions, Single-Pass)
async function processQualityRatio(sourceData, mimeType, quality, knownByteSize = null) {
    if (quality === 100 || mimeType === 'image/svg+xml') {
        const format = (mimeType && mimeType.includes('png')) ? 'PNG' : 'JPEG';
        let byteSize = knownByteSize;
        if (byteSize === null && typeof sourceData === 'string') {
            const headerIndex = sourceData.indexOf(',');
            const dataLength = headerIndex !== -1 ? sourceData.length - headerIndex - 1 : sourceData.length;
            byteSize = Math.round(dataLength * 0.75);
        }
        return {
            url: sourceData,
            format,
            byteSize
        };
    }

    let qualityCache = qualityRatioCache.get(sourceData);
    if (!qualityCache) {
        qualityCache = new Map();
        qualityRatioCache.set(sourceData, qualityCache);
        if (qualityRatioCache.size > 500) {
            qualityRatioCache.delete(qualityRatioCache.keys().next().value);
        }
    }
    const cacheKey = `${quality}|${mimeType}`;
    if (qualityCache.has(cacheKey)) {
        return qualityCache.get(cacheKey);
    }

    const processingPromise = runCanvasTask(async () => {
        if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
            try {
                let blob = null;
                if (typeof sourceData === 'string') {
                    const response = await fetch(sourceData);
                    blob = await response.blob();
                } else {
                    blob = sourceData;
                }

                const bitmap = await createImageBitmap(blob);
                const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, bitmap.width, bitmap.height);
                ctx.drawImage(bitmap, 0, 0);
                bitmap.close();

                const jpegBlob = await canvas.convertToBlob({
                    type: 'image/jpeg',
                    quality: quality / 100
                });

                const url = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(jpegBlob);
                });

                return {
                    url,
                    blob: jpegBlob,
                    format: 'JPEG',
                    byteSize: jpegBlob.size
                };
            } catch (_) { }
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                const compressedUrl = canvas.toDataURL('image/jpeg', quality / 100);
                canvas.width = 0;
                canvas.height = 0;
                const headerIdx = compressedUrl.indexOf(',');
                const dataLength = headerIdx !== -1 ? compressedUrl.length - headerIdx - 1 : compressedUrl.length;
                resolve({
                    url: compressedUrl,
                    format: 'JPEG',
                    byteSize: Math.round(dataLength * 0.75)
                });
            };
            img.onerror = reject;
            img.src = sourceData;
        });
    });

    qualityCache.set(cacheKey, processingPromise);
    if (qualityCache.size > 8) {
        qualityCache.delete(qualityCache.keys().next().value);
    }
    return processingPromise;
}

function getPageDimensionsAndImageBounds(imgW, imgH, pageSize, orientation, marginType, imageFitting) {
    let pageW = 0;
    let pageH = 0;

    if (pageSize === 'original') {
        pageW = imgW * 0.75;
        pageH = imgH * 0.75;

        const margin = MARGIN_SIZES[marginType] || 0;

        if (margin === 0) {
            return {
                pageW: pageW,
                pageH: pageH,
                imgX: 0,
                imgY: 0,
                imgW: pageW,
                imgH: pageH
            };
        } else {
            const drawW = pageW - (margin * 2);
            const drawH = pageH - (margin * 2);

            return {
                pageW: pageW,
                pageH: pageH,
                imgX: margin,
                imgY: margin,
                imgW: drawW > 0 ? drawW : pageW,
                imgH: drawH > 0 ? drawH : pageH
            };
        }
    }

    const preset = PAGE_PRESETS[pageSize];
    let orient = orientation;

    if (orient === 'auto') {
        orient = imgW >= imgH ? 'landscape' : 'portrait';
    }

    if (orient === 'portrait') {
        pageW = preset.width;
        pageH = preset.height;
    } else {
        pageW = preset.height;
        pageH = preset.width;
    }

    const margin = MARGIN_SIZES[marginType];
    const printableW = pageW - (margin * 2);
    const printableH = pageH - (margin * 2);

    let imgX = margin;
    let imgY = margin;
    let drawW = printableW;
    let drawH = printableH;

    const pageRatio = printableW / printableH;
    const imgRatio = imgW / imgH;

    if (imageFitting === 'fit') {
        if (imgRatio > pageRatio) {
            drawW = printableW;
            drawH = printableW / imgRatio;
            imgY = margin + (printableH - drawH) / 2;
        } else {
            drawH = printableH;
            drawW = printableH * imgRatio;
            imgX = margin + (printableW - drawW) / 2;
        }
    } else if (imageFitting === 'fill') {
        if (imgRatio > pageRatio) {
            drawH = printableH;
            drawW = printableH * imgRatio;
            imgX = margin + (printableW - drawW) / 2;
        } else {
            drawW = printableW;
            drawH = printableW / imgRatio;
            imgY = margin + (printableH - drawH) / 2;
        }
    } else {
        drawW = printableW;
        drawH = printableH;
    }

    return {
        pageW: pageW,
        pageH: pageH,
        imgX: imgX,
        imgY: imgY,
        imgW: drawW,
        imgH: drawH
    };
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getFileSizeFingerprint(fileObj) {
    return [
        fileObj.id,
        fileObj.editCount || 0,
        fileObj.quality || 100,
        STATE.settings.pageSize,
        STATE.settings.orientation,
        STATE.settings.margin,
        STATE.settings.imageFitting,
        STATE.settings.mergeMode,
        fileObj.pageSizeOverride || 'global',
        fileObj.marginOverride || 'global',
        STATE.settings.enablePassword ? STATE.settings.pdfPassword : '',
        STATE.settings.watermarkText || ''
    ].join('|');
}

let sizeBadgeUpdateFrame = null;
let imageEstimateGeneration = 0;

function scheduleSizeBadgeUpdates() {
    if (sizeBadgeUpdateFrame !== null) return;
    sizeBadgeUpdateFrame = requestAnimationFrame(() => {
        sizeBadgeUpdateFrame = null;
        updateIndividualSizeBadges();
        updateEstimatedTotalFromIndividualSizes();
    });
}

async function processStaleIndexesInBatches(indexes, generation) {
    const batchSize = getCanvasConcurrency();
    for (let start = 0; start < indexes.length; start += batchSize) {
        if (generation !== imageEstimateGeneration) return;
        const batch = indexes.slice(start, start + batchSize);
        await Promise.all(batch.map(index =>
            calculateSingleImagePdfSize(STATE.files[index], index, generation)
        ));
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    scheduleSizeBadgeUpdates();
}

async function calculateSingleImagePdfSize(fileObj, index, generation) {
    if (!fileObj || generation !== imageEstimateGeneration) return;
    const quality = fileObj.quality || 100;
    const processedImage = await processQualityRatio(
        fileObj.previewUrl || fileObj.dataUrl,
        fileObj.type,
        quality,
        fileObj.currentBytes || fileObj.originalBytes
    );
    if (generation !== imageEstimateGeneration) return;
    const fingerprint = getFileSizeFingerprint(fileObj);
    const exactSize = (processedImage.byteSize || 0) + 1500;

    if (STATE.files[index] === fileObj && getFileSizeFingerprint(fileObj) === fingerprint) {
        fileObj.exactPdfSize = exactSize;
        fileObj.sizeFingerprint = fingerprint;
        scheduleSizeBadgeUpdates();
    }
}

function updateEstimatedTotalFromIndividualSizes() {
    const allCalculated = STATE.files.length > 0 && STATE.files.every(fileObj => {
        return Boolean(fileObj.exactPdfSize) && fileObj.sizeFingerprint === getFileSizeFingerprint(fileObj);
    });

    if (!allCalculated) {
        if (DOM.estimatedPdfSize) {
            updateSizeBadge(DOM.estimatedPdfSize, 'Total Estimate Size', 'wait');
        }
        return;
    }

    const totalSize = STATE.files.reduce((sum, fileObj) => sum + fileObj.exactPdfSize, 0);
    if (DOM.estimatedPdfSize) {
        updateSizeBadge(DOM.estimatedPdfSize, 'Total Estimate Size', totalSize);
    }
}

function recalculateEstimatedPDFSize(targetIndex = null) {
    if (STATE.files.length === 0) {
        if (DOM.sizeIndicatorGroup) {
            DOM.sizeIndicatorGroup.style.display = 'none';
        }
        return;
    }

    if (DOM.sizeIndicatorGroup) {
        DOM.sizeIndicatorGroup.style.display = 'inline-flex';
    }

    const staleIndexes = [];

    STATE.files.forEach((fileObj, index) => {
        if (targetIndex !== null && index !== targetIndex) return;

        const fingerprint = getFileSizeFingerprint(fileObj);
        if (fileObj.sizeFingerprint === fingerprint && fileObj.exactPdfSize) {
            return;
        }

        const quality = fileObj.quality || 100;
        if (quality === 100 || fileObj.type === 'image/svg+xml') {
            const bytes = fileObj.currentBytes || fileObj.originalBytes || 0;
            fileObj.exactPdfSize = bytes + 1500;
            fileObj.sizeFingerprint = fingerprint;
        } else {
            fileObj.exactPdfSize = null;
            staleIndexes.push(index);
        }
    });

    updateIndividualSizeBadges();
    updateEstimatedTotalFromIndividualSizes();

    if (staleIndexes.length > 0) {
        imageEstimateGeneration++;
        processStaleIndexesInBatches(staleIndexes, imageEstimateGeneration)
            .catch(error => console.warn('Failed to calculate individual image size:', error));
    }
}

function updateIndividualSizeBadges() {
    const badges = DOM.imageListContainer.querySelectorAll('.individual-pdf-size-badge');
    badges.forEach(badge => {
        const idx = parseInt(badge.getAttribute('data-index'));
        const fileObj = STATE.files[idx];
        if (fileObj) {
            const sizeIsCurrent = fileObj.exactPdfSize &&
                fileObj.sizeFingerprint === getFileSizeFingerprint(fileObj);
            if (sizeIsCurrent) {
                updateSizeBadge(badge, 'Size', fileObj.exactPdfSize);
            } else {
                updateSizeBadge(badge, 'Size', 'wait');
            }
        }
    });
}

// ==========================================================================
// Edit Modal & Canvas Slicing Engine
// ==========================================================================
let editState = {
    index: -1,
    dragging: false,
    resizing: false,
    startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 0, startHeight: 0,
    aspectRatio: 'free',
    rotation: 0,
    filters: { brightness: 100, contrast: 100, grayscale: 0, sepia: 0 },
    pageSizeOverride: 'global',
    marginOverride: 'global',
    tempDataUrl: null,
    perspectiveMode: false,
    perspectiveDraggingNode: null,
    perspectivePoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ]
};

let editPreviewFrame = null;
let editPreviewGeneration = 0;
let editPreviewTimer = null;
let editPreviewObjectUrl = null;

function openEditInterface(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    editState.index = index;
    editState.aspectRatio = 'free';
    editState.perspectiveMode = false;
    DOM.togglePerspective.checked = false;

    editState.rotation = fileObj.rotation || 0;
    editState.filters = fileObj.filters ? { ...fileObj.filters } : { brightness: 100, contrast: 100, grayscale: 0, sepia: 0 };
    editState.pageSizeOverride = fileObj.pageSizeOverride || 'global';
    editState.marginOverride = fileObj.marginOverride || 'global';

    const editSidebar = DOM.editModal.querySelector('.edit-sidebar');
    if (editSidebar) editSidebar.classList.add('controls-open');
    DOM.editModal.classList.add('controls-open');

    DOM.cropAspectRatio.value = 'free';
    DOM.overridePageSize.value = editState.pageSizeOverride;
    DOM.overrideMargin.value = editState.marginOverride;

    DOM.filterBrightness.value = editState.filters.brightness;
    DOM.filterContrast.value = editState.filters.contrast;
    DOM.filterGrayscale.value = editState.filters.grayscale;
    DOM.filterSepia.value = editState.filters.sepia;

    updateFilterBadges();

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    DOM.editModal.style.display = 'flex';

    document.querySelectorAll('.edit-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.edit-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="tab-crop"]').classList.add('active');
    document.getElementById('tab-crop').classList.add('active');

    updateEditPreview(true);
}

function updateFilterBadges() {
    DOM.valBrightness.textContent = editState.filters.brightness + '%';
    DOM.valContrast.textContent = editState.filters.contrast + '%';
    DOM.valGrayscale.textContent = editState.filters.grayscale + '%';
    DOM.valSepia.textContent = editState.filters.sepia + '%';
}

function updateEditPreview(resetCropBox = false) {
    const fileObj = STATE.files[editState.index];
    if (!fileObj) return;
    if (editPreviewFrame !== null) {
        cancelAnimationFrame(editPreviewFrame);
    }
    if (editPreviewTimer !== null) {
        clearTimeout(editPreviewTimer);
    }

    const generation = ++editPreviewGeneration;
    editPreviewFrame = requestAnimationFrame(() => {
        editPreviewFrame = null;
        editPreviewTimer = setTimeout(() => {
            editPreviewTimer = null;
            const img = new Image();
            img.onload = function () {
                if (generation !== editPreviewGeneration) return;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                let cw = img.width;
                let ch = img.height;
                if (editState.rotation % 180 !== 0) {
                    cw = img.height;
                    ch = img.width;
                }

                const previewScale = Math.min(1, 1600 / Math.max(cw, ch));
                cw = Math.max(1, Math.round(cw * previewScale));
                ch = Math.max(1, Math.round(ch * previewScale));

                canvas.width = cw;
                canvas.height = ch;
                ctx.filter = `brightness(${editState.filters.brightness}%) contrast(${editState.filters.contrast}%) grayscale(${editState.filters.grayscale}%) sepia(${editState.filters.sepia}%)`;
                ctx.translate(cw / 2, ch / 2);
                ctx.rotate(editState.rotation * Math.PI / 180);
                ctx.drawImage(img, -img.width * previewScale / 2, -img.height * previewScale / 2, img.width * previewScale, img.height * previewScale);

                canvas.toBlob((blob) => {
                    if (!blob || generation !== editPreviewGeneration) {
                        canvas.width = 0;
                        canvas.height = 0;
                        return;
                    }
                    const previewUrl = URL.createObjectURL(blob);
                    if (editPreviewObjectUrl) URL.revokeObjectURL(editPreviewObjectUrl);
                    editPreviewObjectUrl = previewUrl;
                    editState.tempDataUrl = previewUrl;
                    canvas.width = 0;
                    canvas.height = 0;

                    DOM.cropSourceImage.onload = () => {
                        if (!resetCropBox) return;
                        setTimeout(() => {
                            const displayedW = DOM.cropSourceImage.clientWidth;
                            const displayedH = DOM.cropSourceImage.clientHeight;
                            if (!displayedW || !displayedH) return;

                            DOM.cropBox.style.left = '0px';
                            DOM.cropBox.style.top = '0px';
                            DOM.cropBox.style.width = displayedW + 'px';
                            DOM.cropBox.style.height = displayedH + 'px';
                            DOM.cropWorkspace.style.width = displayedW + 'px';
                            DOM.cropWorkspace.style.height = displayedH + 'px';
                            editState.perspectivePoints = [
                                { x: 0, y: 0 },
                                { x: displayedW, y: 0 },
                                { x: displayedW, y: displayedH },
                                { x: 0, y: displayedH }
                            ];
                            updatePerspectiveUI();
                        }, 50);
                    };
                    DOM.cropSourceImage.src = previewUrl;
                }, fileObj.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
            };
            img.src = fileObj.originalPreviewUrl || fileObj.originalDataUrl;
        }, 50);
    });
}

function updatePerspectiveUI() {
    if (editState.perspectiveMode) {
        DOM.cropBox.style.display = 'none';
        DOM.perspectiveSvg.style.display = 'block';
        DOM.perspectiveHandles.style.display = 'block';

        const pts = editState.perspectivePoints;
        DOM.perspectivePolygon.setAttribute('points', `${pts[0].x},${pts[0].y} ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y}`);

        DOM.phTl.style.left = pts[0].x + 'px'; DOM.phTl.style.top = pts[0].y + 'px';
        DOM.phTr.style.left = pts[1].x + 'px'; DOM.phTr.style.top = pts[1].y + 'px';
        DOM.phBr.style.left = pts[2].x + 'px'; DOM.phBr.style.top = pts[2].y + 'px';
        DOM.phBl.style.left = pts[3].x + 'px'; DOM.phBl.style.top = pts[3].y + 'px';
    } else {
        DOM.cropBox.style.display = 'block';
        DOM.perspectiveSvg.style.display = 'none';
        DOM.perspectiveHandles.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initEditEvents();
});

function initEditEvents() {
    if (!DOM.cropBox) return;

    if (DOM.togglePerspective) {
        DOM.togglePerspective.addEventListener('change', (e) => {
            editState.perspectiveMode = e.target.checked;
            updatePerspectiveUI();
        });
    }

    document.querySelectorAll('.edit-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const sidebar = DOM.editModal.querySelector('.edit-sidebar');

            document.querySelectorAll('.edit-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.edit-panel').forEach(p => p.classList.remove('active'));

            const panel = document.getElementById(target.getAttribute('data-tab'));
            target.classList.add('active');
            panel.classList.add('active');

            if (sidebar) {
                sidebar.classList.add('controls-open');
                DOM.editModal.classList.add('controls-open');
            }
        });
    });

    DOM.btnRotateLeft.addEventListener('click', () => { editState.rotation = (editState.rotation - 90) % 360; updateEditPreview(true); });
    DOM.btnRotateRight.addEventListener('click', () => { editState.rotation = (editState.rotation + 90) % 360; updateEditPreview(true); });

    let filterPreviewTimer = null;
    const applyFilters = (resetCrop = false) => {
        editState.filters.brightness = parseInt(DOM.filterBrightness.value);
        editState.filters.contrast = parseInt(DOM.filterContrast.value);
        editState.filters.grayscale = parseInt(DOM.filterGrayscale.value);
        editState.filters.sepia = parseInt(DOM.filterSepia.value);
        updateFilterBadges();
        if (filterPreviewTimer !== null) clearTimeout(filterPreviewTimer);
        filterPreviewTimer = setTimeout(() => {
            filterPreviewTimer = null;
            updateEditPreview(resetCrop);
        }, 80);
    };

    DOM.filterBrightness.addEventListener('input', () => applyFilters(false));
    DOM.filterContrast.addEventListener('input', () => applyFilters(false));
    DOM.filterGrayscale.addEventListener('input', () => applyFilters(false));
    DOM.filterSepia.addEventListener('input', () => applyFilters(false));

    DOM.btnResetFilters.addEventListener('click', () => {
        DOM.filterBrightness.value = 100;
        DOM.filterContrast.value = 100;
        DOM.filterGrayscale.value = 0;
        DOM.filterSepia.value = 0;
        applyFilters(false);
    });

    DOM.overridePageSize.addEventListener('change', (e) => { editState.pageSizeOverride = e.target.value; });
    DOM.overrideMargin.addEventListener('change', (e) => { editState.marginOverride = e.target.value; });

    DOM.closeEditModal.addEventListener('click', closeEditInterface);
    DOM.btnCancelEdit.addEventListener('click', closeEditInterface);

    const mobileRevertEdit = document.getElementById('mobileRevertEdit');
    if (mobileRevertEdit) {
        mobileRevertEdit.addEventListener('click', () => {
            if (editState.index >= 0) {
                resetEdits(editState.index);
                closeEditInterface();
            }
        });
    }

    const mobileSaveEdit = document.getElementById('mobileSaveEdit');
    if (mobileSaveEdit) {
        mobileSaveEdit.addEventListener('click', applyImageEdits);
    }

    const toggleFullscreenFunc = () => {
        const mainArea = DOM.editModal.querySelector('.edit-main-area');
        const isEntering = !DOM.editModal.classList.contains('fullscreen-mode');

        DOM.editModal.classList.toggle('fullscreen-mode', isEntering);
        if (mainArea) {
            mainArea.classList.toggle('fullscreen-crop', isEntering);
        }

        if (DOM.toggleFullScreenEdit) {
            const icon = DOM.toggleFullScreenEdit.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isEntering ? 'minimize' : 'maximize');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }

        setTimeout(() => {
            if (!DOM.cropSourceImage || editState.index === -1) return;
            const displayedW = DOM.cropSourceImage.clientWidth;
            const displayedH = DOM.cropSourceImage.clientHeight;
            if (displayedW && displayedH) {
                DOM.cropWorkspace.style.width = displayedW + 'px';
                DOM.cropWorkspace.style.height = displayedH + 'px';

                DOM.cropBox.style.left = '0px';
                DOM.cropBox.style.top = '0px';
                DOM.cropBox.style.width = displayedW + 'px';
                DOM.cropBox.style.height = displayedH + 'px';

                editState.perspectivePoints = [
                    { x: 0, y: 0 },
                    { x: displayedW, y: 0 },
                    { x: displayedW, y: displayedH },
                    { x: 0, y: displayedH }
                ];
                updatePerspectiveUI();
            }
        }, 50);
    };

    DOM.toggleFullScreenEdit.addEventListener('click', toggleFullscreenFunc);
    const exitCropBtn = document.getElementById('exitFullScreenCrop');
    if (exitCropBtn) {
        exitCropBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreenFunc();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.editModal && DOM.editModal.style.display !== 'none') {
            if (DOM.editModal.classList.contains('fullscreen-mode')) {
                toggleFullscreenFunc();
            } else {
                closeEditInterface();
            }
        }
    });

    DOM.editModal.addEventListener('mousedown', (e) => {
        if (e.target === DOM.editModal) {
            closeEditInterface();
        }
    });

    DOM.cropBox.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();

        endEditPointer();

        editState.dragging = true;
        editState.startX = e.clientX;
        editState.startY = e.clientY;
        editState.startLeft = parseInt(DOM.cropBox.style.left) || 0;
        editState.startTop = parseInt(DOM.cropBox.style.top) || 0;

        DOM.cropBox.setPointerCapture(e.pointerId);
    });

    const cHandles = DOM.cropBox.querySelectorAll('.crop-handle');
    cHandles.forEach(handle => {
        const startCropDrag = (e, clientX, clientY) => {
            e.stopPropagation(); e.preventDefault();
            endEditPointer();

            editState.resizing = true;
            if (handle.classList.contains('tl')) editState.resizeNode = 'tl';
            else if (handle.classList.contains('tr')) editState.resizeNode = 'tr';
            else if (handle.classList.contains('bl')) editState.resizeNode = 'bl';
            else if (handle.classList.contains('br')) editState.resizeNode = 'br';
            else if (handle.classList.contains('t')) editState.resizeNode = 't';
            else if (handle.classList.contains('b')) editState.resizeNode = 'b';
            else if (handle.classList.contains('l')) editState.resizeNode = 'l';
            else if (handle.classList.contains('r')) editState.resizeNode = 'r';

            editState.startX = clientX;
            editState.startY = clientY;
            editState.startWidth = parseInt(DOM.cropBox.style.width) || 100;
            editState.startHeight = parseInt(DOM.cropBox.style.height) || 100;
            editState.startLeft = parseInt(DOM.cropBox.style.left) || 0;
            editState.startTop = parseInt(DOM.cropBox.style.top) || 0;

            handle.setPointerCapture(e.pointerId);
        };
        handle.addEventListener('pointerdown', (e) => startCropDrag(e, e.clientX, e.clientY));
    });

    const pHandles = [DOM.phTl, DOM.phTr, DOM.phBr, DOM.phBl];
    pHandles.forEach((handle, idx) => {
        if (!handle) return;
        const startDrag = (clientX, clientY) => {
            endEditPointer();
            editState.perspectiveDraggingNode = idx;
            editState.startX = clientX;
            editState.startY = clientY;
            editState.startLeft = editState.perspectivePoints[idx].x;
            editState.startTop = editState.perspectivePoints[idx].y;
        };
        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); e.preventDefault();
            startDrag(e.clientX, e.clientY);
            handle.setPointerCapture(e.pointerId);
        });
    });

    let editPointerFrame = null;
    let latestEditPointerEvent = null;
    window.addEventListener('pointermove', (e) => {
        if (editState.dragging || editState.resizing || editState.perspectiveDraggingNode !== null) {
            e.preventDefault();
            latestEditPointerEvent = e;
            if (editPointerFrame === null) {
                editPointerFrame = requestAnimationFrame(() => {
                    editPointerFrame = null;
                    if (latestEditPointerEvent) {
                        handlePointerMove(latestEditPointerEvent);
                        latestEditPointerEvent = null;
                    }
                });
            }
        }
    }, { passive: false });

    window.addEventListener('pointerup', endEditPointer);
    window.addEventListener('pointercancel', endEditPointer);

    DOM.cropAspectRatio.addEventListener('change', (e) => {
        editState.aspectRatio = e.target.value;
        applyCropAspectRatio();
    });

    DOM.btnApplyEdit.addEventListener('click', applyImageEdits);
}

function handlePointerMove(e) {
    if (!editState.dragging && !editState.resizing && editState.perspectiveDraggingNode === null) return;

    const displayedW = DOM.cropSourceImage.clientWidth;
    const displayedH = DOM.cropSourceImage.clientHeight;

    if (editState.perspectiveDraggingNode !== null) {
        const deltaX = e.clientX - editState.startX;
        const deltaY = e.clientY - editState.startY;

        let newX = editState.startLeft + deltaX;
        let newY = editState.startTop + deltaY;

        newX = Math.max(0, Math.min(newX, displayedW));
        newY = Math.max(0, Math.min(newY, displayedH));

        editState.perspectivePoints[editState.perspectiveDraggingNode] = { x: newX, y: newY };
        updatePerspectiveUI();
        return;
    }

    if (editState.dragging) {
        const deltaX = e.clientX - editState.startX;
        const deltaY = e.clientY - editState.startY;

        let newLeft = editState.startLeft + deltaX;
        let newTop = editState.startTop + deltaY;

        const boxW = parseInt(DOM.cropBox.style.width);
        const boxH = parseInt(DOM.cropBox.style.height);

        newLeft = Math.max(0, Math.min(newLeft, displayedW - boxW));
        newTop = Math.max(0, Math.min(newTop, displayedH - boxH));

        DOM.cropBox.style.left = newLeft + 'px';
        DOM.cropBox.style.top = newTop + 'px';
    }

    if (editState.resizing) {
        const deltaX = e.clientX - editState.startX;
        const deltaY = e.clientY - editState.startY;

        let newW = editState.startWidth;
        let newH = editState.startHeight;
        let newL = editState.startLeft;
        let newT = editState.startTop;

        if (editState.resizeNode.includes('r')) {
            newW = editState.startWidth + deltaX;
        } else if (editState.resizeNode.includes('l')) {
            newW = editState.startWidth - deltaX;
            newL = editState.startLeft + deltaX;
        }

        if (editState.resizeNode.includes('b')) {
            newH = editState.startHeight + deltaY;
        } else if (editState.resizeNode.includes('t')) {
            newH = editState.startHeight - deltaY;
            newT = editState.startTop + deltaY;
        }

        if (newW < 30) {
            if (editState.resizeNode.includes('l')) newL -= (30 - newW);
            newW = 30;
        }
        if (newH < 30) {
            if (editState.resizeNode.includes('t')) newT -= (30 - newH);
            newH = 30;
        }

        if (newL < 0) { newW += newL; newL = 0; }
        if (newT < 0) { newH += newT; newT = 0; }
        if (newL + newW > displayedW) newW = displayedW - newL;
        if (newT + newH > displayedH) newH = displayedH - newT;

        if (editState.aspectRatio !== 'free') {
            const ratioParts = editState.aspectRatio.split(':').map(Number);
            const ratio = ratioParts[0] / ratioParts[1];

            newH = newW / ratio;

            if (editState.resizeNode.includes('t')) {
                newT = editState.startTop + (editState.startHeight - newH);
            }

            if (newT + newH > displayedH) {
                newH = displayedH - newT;
                newW = newH * ratio;
                if (editState.resizeNode.includes('l')) {
                    newL = editState.startLeft + (editState.startWidth - newW);
                }
            }

            if (newT < 0) {
                newH = newH + newT;
                newT = 0;
                newW = newH * ratio;
                if (editState.resizeNode.includes('l')) {
                    newL = editState.startLeft + (editState.startWidth - newW);
                }
            }
        }

        DOM.cropBox.style.width = newW + 'px';
        DOM.cropBox.style.height = newH + 'px';
        DOM.cropBox.style.left = newL + 'px';
        DOM.cropBox.style.top = newT + 'px';
    }
}

function endEditPointer() {
    editState.dragging = false;
    editState.resizing = false;
    editState.resizeNode = null;
    editState.perspectiveDraggingNode = null;
}

function closeEditInterface() {
    ++editPreviewGeneration;
    if (editPreviewTimer !== null) {
        clearTimeout(editPreviewTimer);
        editPreviewTimer = null;
    }
    if (editPreviewObjectUrl) {
        URL.revokeObjectURL(editPreviewObjectUrl);
        editPreviewObjectUrl = null;
    }
    DOM.editModal.style.display = 'none';
    DOM.editModal.classList.remove('fullscreen-mode');
    DOM.editModal.classList.remove('controls-open');
    const editSidebar = DOM.editModal.querySelector('.edit-sidebar');
    if (editSidebar) editSidebar.classList.remove('controls-open');
    const mainArea = DOM.editModal.querySelector('.edit-main-area');
    if (mainArea) {
        mainArea.classList.remove('fullscreen-crop');
    }
    if (DOM.toggleFullScreenEdit) {
        const icon = DOM.toggleFullScreenEdit.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'maximize');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    editState.index = -1;
}

function applyCropAspectRatio() {
    if (editState.aspectRatio === 'free') return;

    const ratioParts = editState.aspectRatio.split(':').map(Number);
    const ratio = ratioParts[0] / ratioParts[1];

    const displayedW = DOM.cropSourceImage.clientWidth;
    const displayedH = DOM.cropSourceImage.clientHeight;

    let boxW = parseInt(DOM.cropBox.style.width);
    let boxH = boxW / ratio;

    if (parseInt(DOM.cropBox.style.top) + boxH > displayedH) {
        boxH = displayedH - parseInt(DOM.cropBox.style.top);
        boxW = boxH * ratio;
    }

    DOM.cropBox.style.width = Math.round(boxW) + 'px';
    DOM.cropBox.style.height = Math.round(boxH) + 'px';
}

function getPerspectiveTransform(pts) {
    let dx1 = pts[1].x - pts[2].x;
    let dx2 = pts[3].x - pts[2].x;
    let dx3 = pts[0].x - pts[1].x + pts[2].x - pts[3].x;
    let dy1 = pts[1].y - pts[2].y;
    let dy2 = pts[3].y - pts[2].y;
    let dy3 = pts[0].y - pts[1].y + pts[2].y - pts[3].y;

    let a31 = (dx3 * dy2 - dx2 * dy3) / (dx1 * dy2 - dx2 * dy1);
    let a32 = (dx1 * dy3 - dx3 * dy1) / (dx1 * dy2 - dx2 * dy1);
    let a11 = pts[1].x - pts[0].x + a31 * pts[1].x;
    let a12 = pts[3].x - pts[0].x + a32 * pts[3].x;
    let a13 = pts[0].x;
    let a21 = pts[1].y - pts[0].y + a31 * pts[1].y;
    let a22 = pts[3].y - pts[0].y + a32 * pts[3].y;
    let a23 = pts[0].y;

    return [a11, a12, a13, a21, a22, a23, a31, a32, 1];
}

function applyPerspectiveWarp(srcImg, pts, scaleX, scaleY) {
    const scaledPts = pts.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));

    const wTop = Math.hypot(scaledPts[1].x - scaledPts[0].x, scaledPts[1].y - scaledPts[0].y);
    const wBot = Math.hypot(scaledPts[2].x - scaledPts[3].x, scaledPts[2].y - scaledPts[3].y);
    const hLeft = Math.hypot(scaledPts[3].x - scaledPts[0].x, scaledPts[3].y - scaledPts[0].y);
    const hRight = Math.hypot(scaledPts[2].x - scaledPts[1].x, scaledPts[2].y - scaledPts[1].y);
    const outW = Math.round((wTop + wBot) / 2);
    const outH = Math.round((hLeft + hRight) / 2);

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcImg.width;
    srcCanvas.height = srcImg.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    srcCtx.drawImage(srcImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, srcImg.width, srcImg.height).data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    const outImgData = outCtx.createImageData(outW, outH);
    const outData = outImgData.data;

    const H = getPerspectiveTransform(scaledPts);

    const srcW = srcImg.width;
    const srcH = srcImg.height;
    for (let r = 0; r < outH; r++) {
        const v = r / outH;
        for (let c = 0; c < outW; c++) {
            const u = c / outW;

            const w = H[6] * u + H[7] * v + H[8];
            const x = (H[0] * u + H[1] * v + H[2]) / w;
            const y = (H[3] * u + H[4] * v + H[5]) / w;

            const px = Math.round(x);
            const py = Math.round(y);

            const outIdx = (r * outW + c) * 4;
            if (px >= 0 && px < srcW && py >= 0 && py < srcH) {
                const srcIdx = (py * srcW + px) * 4;
                outData[outIdx] = srcData[srcIdx];
                outData[outIdx + 1] = srcData[srcIdx + 1];
                outData[outIdx + 2] = srcData[srcIdx + 2];
                outData[outIdx + 3] = srcData[srcIdx + 3];
            } else {
                outData[outIdx + 3] = 0;
            }
        }
    }

    outCtx.putImageData(outImgData, 0, 0);
    return outCanvas;
}

async function applyImageEdits() {
    const index = editState.index;
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    fileObj.editCount = (fileObj.editCount || 0) + 1;
    if (DOM.btnApplyEdit) {
        DOM.btnApplyEdit.disabled = true;
        DOM.btnApplyEdit.classList.add('is-processing');
    }

    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
        const img = await new Promise((resolve, reject) => {
            const source = new Image();
            source.onload = () => resolve(source);
            source.onerror = () => reject(new Error('Could not load image for editing'));
            source.src = fileObj.originalPreviewUrl || fileObj.originalDataUrl;
        });

        let bakedW = img.width;
        let bakedH = img.height;
        if (editState.rotation % 180 !== 0) {
            bakedW = img.height;
            bakedH = img.width;
        }

        const bakedCanvas = document.createElement('canvas');
        bakedCanvas.width = bakedW;
        bakedCanvas.height = bakedH;
        const bakedCtx = bakedCanvas.getContext('2d', { willReadFrequently: true });
        bakedCtx.filter = `brightness(${editState.filters.brightness}%) contrast(${editState.filters.contrast}%) grayscale(${editState.filters.grayscale}%) sepia(${editState.filters.sepia}%)`;
        bakedCtx.translate(bakedW / 2, bakedH / 2);
        bakedCtx.rotate(editState.rotation * Math.PI / 180);
        bakedCtx.drawImage(img, -img.width / 2, -img.height / 2);

        const displayedW = DOM.cropSourceImage.clientWidth;
        const displayedH = DOM.cropSourceImage.clientHeight;
        const scaleX = bakedW / displayedW;
        const scaleY = bakedH / displayedH;
        let finalCanvas;

        if (editState.perspectiveMode) {
            finalCanvas = applyPerspectiveWarp(bakedCanvas, editState.perspectivePoints, scaleX, scaleY);
        } else {
            const boxLeft = parseInt(DOM.cropBox.style.left) || 0;
            const boxTop = parseInt(DOM.cropBox.style.top) || 0;
            const boxWidth = parseInt(DOM.cropBox.style.width) || displayedW;
            const boxHeight = parseInt(DOM.cropBox.style.height) || displayedH;
            const finalW = Math.max(1, Math.round(boxWidth * scaleX));
            const finalH = Math.max(1, Math.round(boxHeight * scaleY));
            const cropX = Math.max(0, Math.round(boxLeft * scaleX));
            const cropY = Math.max(0, Math.round(boxTop * scaleY));

            finalCanvas = document.createElement('canvas');
            finalCanvas.width = finalW;
            finalCanvas.height = finalH;
            finalCanvas.getContext('2d', { willReadFrequently: true }).drawImage(
                bakedCanvas, cropX, cropY, finalW, finalH, 0, 0, finalW, finalH
            );
        }

        const finalW = finalCanvas.width;
        const finalH = finalCanvas.height;
        const outputType = fileObj.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outputBlob = await new Promise(resolve => {
            finalCanvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? 0.98 : undefined);
        });
        if (!outputBlob) throw new Error('Could not encode edited image');

        const croppedDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(outputBlob);
        });

        bakedCanvas.width = 0;
        bakedCanvas.height = 0;
        finalCanvas.width = 0;
        finalCanvas.height = 0;

        // 1. Invalidate old cached quality results for this edited image
        if (fileObj.previewUrl) qualityRatioCache.delete(fileObj.previewUrl);
        if (fileObj.dataUrl) qualityRatioCache.delete(fileObj.dataUrl);

        // 2. Revoke previous temporary blob URL
        if (fileObj.previewUrl && fileObj.previewUrl.startsWith('blob:') && fileObj.previewUrl !== fileObj.originalPreviewUrl) {
            URL.revokeObjectURL(fileObj.previewUrl);
        }
        if (fileObj.thumbUrl && fileObj.thumbUrl.startsWith('blob:') && fileObj.thumbUrl !== fileObj.originalPreviewUrl) {
            URL.revokeObjectURL(fileObj.thumbUrl);
        }

        // 3. Assign new edited blob and URLs
        fileObj.dataUrl = croppedDataUrl;
        fileObj.previewUrl = URL.createObjectURL(outputBlob);
        fileObj.thumbUrl = await createMicroThumbnail(outputBlob) || fileObj.previewUrl;
        fileObj.currentBytes = outputBlob.size;
        fileObj.width = finalW;
        fileObj.height = finalH;
        fileObj.sizeText = formatFileSize(outputBlob.size);
        fileObj.rotation = editState.rotation;
        fileObj.filters = { ...editState.filters };
        fileObj.pageSizeOverride = editState.pageSizeOverride;
        fileObj.marginOverride = editState.marginOverride;

        closeEditInterface();
        updateUIState();
        recalculateEstimatedPDFSize(index);
    } finally {
        if (DOM.btnApplyEdit) {
            DOM.btnApplyEdit.disabled = false;
            DOM.btnApplyEdit.classList.remove('is-processing');
        }
    }
}

function resetEdits(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    const img = new Image();
    img.onload = async function () {
        if (fileObj.previewUrl && fileObj.previewUrl.startsWith('blob:') && fileObj.previewUrl !== fileObj.originalPreviewUrl) {
            URL.revokeObjectURL(fileObj.previewUrl);
        }
        if (fileObj.thumbUrl && fileObj.thumbUrl.startsWith('blob:') && fileObj.thumbUrl !== fileObj.originalPreviewUrl) {
            URL.revokeObjectURL(fileObj.thumbUrl);
        }

        fileObj.dataUrl = fileObj.originalDataUrl;
        fileObj.previewUrl = fileObj.originalPreviewUrl || fileObj.originalDataUrl;
        fileObj.thumbUrl = fileObj.file ? (await createMicroThumbnail(fileObj.file) || fileObj.previewUrl) : fileObj.previewUrl;
        fileObj.currentBytes = fileObj.originalBytes;
        fileObj.width = img.width;
        fileObj.height = img.height;

        delete fileObj.rotation;
        delete fileObj.filters;
        delete fileObj.pageSizeOverride;
        delete fileObj.marginOverride;

        fileObj.sizeText = formatFileSize(fileObj.originalBytes);

        updateUIState();
        recalculateEstimatedPDFSize(index);
    };
    img.src = fileObj.originalPreviewUrl || fileObj.originalDataUrl;
}

// Per-card "Save PDF" button: uses cache directly
async function downloadSinglePDF(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    const btn = document.querySelectorAll('.btn-crop-node')[index * 3 + 2];
    if (btn) btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    try {
        const quality = fileObj.quality || 100;
        let processedUrl = fileObj.previewUrl || fileObj.dataUrl;
        let processedFormat = (fileObj.type && fileObj.type.includes('png')) ? 'PNG' : 'JPEG';

        if (quality !== 100) {
            const qualityCache = qualityRatioCache.get(fileObj.previewUrl || fileObj.dataUrl);
            const cacheKey = `${quality}|${fileObj.type}`;

            if (qualityCache && qualityCache.has(cacheKey)) {
                const cached = await qualityCache.get(cacheKey);
                processedUrl = cached.url;
                processedFormat = cached.format || 'JPEG';
            } else {
                const processed = await processQualityRatio(
                    fileObj.previewUrl || fileObj.dataUrl,
                    fileObj.type,
                    quality,
                    fileObj.currentBytes || fileObj.originalBytes
                );
                processedUrl = processed.url;
                processedFormat = processed.format || 'JPEG';
            }
        }

        const usedPageSize = (fileObj.pageSizeOverride && fileObj.pageSizeOverride !== 'global') ? fileObj.pageSizeOverride : STATE.settings.pageSize;
        const usedMargin = (fileObj.marginOverride && fileObj.marginOverride !== 'global') ? fileObj.marginOverride : STATE.settings.margin;

        const pageConfig = getPageDimensionsAndImageBounds(
            fileObj.width,
            fileObj.height,
            usedPageSize,
            STATE.settings.orientation,
            usedMargin,
            STATE.settings.imageFitting
        );

        const doc = new jsPDF({
            orientation: pageConfig.pageW > pageConfig.pageH ? 'l' : 'p',
            unit: 'pt',
            format: [pageConfig.pageW, pageConfig.pageH]
        });

        doc.addImage(
            processedUrl,
            processedFormat,
            pageConfig.imgX,
            pageConfig.imgY,
            pageConfig.imgW,
            pageConfig.imgH
        );

        const originalName = fileObj.name.split('.')[0];
        doc.save(`${originalName}_PicToPDF.pdf`);
    } catch (err) {
        console.error("Failed to generate single PDF", err);
        alert("Failed to generate PDF for this image.");
    }

    updateUIState();
}