/* ==========================================================================
   LuminaPDF Application Script (State, UI Mechanics, & PDF Generation)
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
        imageQuality: 90,        // 10 to 100 (JPEG compression percent)
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
    qualitySlider: document.getElementById('imageQuality'),
    qualityValue: document.getElementById('qualityValue'),
    virtualPreviewCanvas: document.getElementById('virtualPreviewCanvas'),
    previewPlaceholder: document.getElementById('previewPlaceholder'),
    previewPagination: document.getElementById('previewPagination'),
    currentPreviewPage: document.getElementById('currentPreviewPage'),
    totalPreviewPages: document.getElementById('totalPreviewPages'),
    prevPreview: document.getElementById('prevPreview'),
    nextPreview: document.getElementById('nextPreview'),
    btnConvert: document.getElementById('btnConvert'),
    btnExtractZip: document.getElementById('btnExtractZip'),
    sizeIndicatorGroup: document.getElementById('sizeIndicatorGroup'),
    estimatedPdfSize: document.getElementById('estimatedPdfSize'),
    settingsHeader: document.getElementById('settingsHeader'),
    settingsCard: document.querySelector('.settings-card'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    enablePassword: document.getElementById('enablePassword'),
    passwordInputContainer: document.getElementById('passwordInputContainer'),
    pdfPassword: document.getElementById('pdfPassword'),
    watermarkText: document.getElementById('watermarkText'),

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

// Theme Setup (System Preferences color scheme query)
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    STATE.theme = prefersDark ? 'dark' : 'light';
    applyTheme();

    // Listen to browser/system theme changes dynamically
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
    // Collapsible Settings Panel Toggle
    if (DOM.settingsHeader && DOM.settingsCard) {
        DOM.settingsHeader.addEventListener('click', () => {
            DOM.settingsCard.classList.toggle('collapsed');
        });
    }

    // File Input selection
    DOM.fileInput.addEventListener('change', handleFileSelection);

    // Browse Files button trigger
    if (DOM.btnBrowse) {
        DOM.btnBrowse.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.fileInput.click();
        });
    }

    // Paste Clipboard button trigger
    if (DOM.btnPaste) {
        DOM.btnPaste.addEventListener('click', handlePasteButtonClick);
    }

    // Global Paste Event Listener (Ctrl+V / Cmd+V)
    document.addEventListener('paste', handlePasteEvent);

    // Dropzone card click trigger (clicking empty space in dropzone)
    if (DOM.dropZone) {
        DOM.dropZone.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            DOM.fileInput.click();
        });
    }

    // Local Dropzone Events (Fallback/Visual highlight)
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

    // Global Window Drop Anywhere Events
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        // Check if dragging files
        if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
            dragCounter++;
            if (DOM.globalDropOverlay) {
                DOM.globalDropOverlay.style.display = 'flex';
                // Small delay to allow display flex to apply before opacity transition
                requestAnimationFrame(() => {
                    DOM.globalDropOverlay.classList.add('active');
                });
            }
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // Check if dragging files
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
                    }, 300); // match CSS transition duration
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



    // Clear All Action
    DOM.btnClearAll.addEventListener('click', clearAllFiles);

    // Advanced Page Size Dropdown Settings
    DOM.pageSize.addEventListener('change', (e) => {
        STATE.settings.pageSize = e.target.value;

        // Show/hide orientation and fitting groups based on page size selection
        if (STATE.settings.pageSize === 'original') {
            DOM.orientationGroup.style.display = 'none';
            DOM.imageFittingGroup.style.display = 'none';
        } else {
            DOM.orientationGroup.style.display = 'flex';
            DOM.imageFittingGroup.style.display = 'flex';
        }

        updateUIState();
    });

    // Tab buttons for Orientation & Page Margins
    setupTabSelectors();

    // Fitting Mode change
    const imageFittingSelect = document.getElementById('imageFitting');
    if (imageFittingSelect) {
        imageFittingSelect.addEventListener('change', (e) => {
            STATE.settings.imageFitting = e.target.value;
            updateUIState();
        });
    }

    // Quality slider
    DOM.qualitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        STATE.settings.imageQuality = val;
        DOM.qualityValue.textContent = val === 100 ? 'Original' : `${val}%`;

        // Bulk update all files
        STATE.files.forEach(fileObj => {
            fileObj.quality = val;
        });

        // Update all displayed inline sliders in the list dynamically
        const inlineSliders = DOM.imageListContainer.querySelectorAll('.inline-quality-slider');
        const inlineBadges = DOM.imageListContainer.querySelectorAll('.inline-quality-badge');

        inlineSliders.forEach(slider => {
            slider.value = val;
        });

        inlineBadges.forEach(badge => {
            badge.textContent = val === 100 ? 'Original' : `${val}%`;
        });

        recalculateEstimatedPDFSize();
    });

    // Strategy merge mode choices
    setupSwitchSelectors();

    // Password Protection logic
    if (DOM.togglePasswordBtn && DOM.enablePassword && DOM.passwordInputContainer && DOM.pdfPassword) {
        // Handle clicking the container to toggle checkbox
        DOM.togglePasswordBtn.addEventListener('click', (e) => {
            if (e.target !== DOM.enablePassword) {
                DOM.enablePassword.checked = !DOM.enablePassword.checked;
                const event = new Event('change');
                DOM.enablePassword.dispatchEvent(event);
            }
        });

        // Handle checkbox change
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

        // Handle password input
        DOM.pdfPassword.addEventListener('input', (e) => {
            STATE.settings.pdfPassword = e.target.value;
            updateUIState();
        });
    }

    // Watermark logic
    if (DOM.watermarkText) {
        DOM.watermarkText.addEventListener('input', (e) => {
            STATE.settings.watermarkText = e.target.value;
            updateUIState();
        });
    }

    // Preview navigation
    DOM.prevPreview.addEventListener('click', () => navigatePreview(-1));
    DOM.nextPreview.addEventListener('click', () => navigatePreview(1));

    // Convert Button
    DOM.btnConvert.addEventListener('click', convertImagesToPDF);

}

// Custom tabs (Orientation / Margins) event handling
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

// Custom Switch Option selectors (Merge strategy)
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

/* ==========================================================================
   Clipboard & Paste Mechanics
   ========================================================================== */
async function handlePasteEvent(e) {
    // Ignore paste if user is typing inside text input/textarea/editable element
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        if (activeEl.type === 'text' || activeEl.type === 'password' || activeEl.type === 'textarea' || activeEl.isContentEditable) {
            return;
        }
    }

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const filesToProcess = [];

    // 1. Check direct file objects in clipboard (copied files from File Explorer / Desktop)
    if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
            const f = clipboardData.files[i];
            filesToProcess.push(f);
        }
    }

    // 2. Check items in clipboard (screenshots, copied images, PDF blobs)
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
                // Check if user pasted a base64 data URL
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

    // Try System Async Clipboard API
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
            const scale = 2.0; // Render at 2x scaling for high-resolution text & graphics
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

            // Release GPU canvas memory immediately
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();

            // Calculate size estimation for this page
            const base64Length = dataUrl.length;
            const headerIndex = dataUrl.indexOf(',');
            const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
            const approxBytes = Math.round(dataLength * 0.75);

            const pageName = pdf.numPages > 1
                ? `${file.name} (Page ${pageNum} of ${pdf.numPages})`
                : file.name;

            const pageRecord = {
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                file: file,
                dataUrl: dataUrl,
                originalDataUrl: dataUrl,
                quality: STATE.settings.imageQuality,
                width: Math.round(viewport.width / scale), // native dimensions
                height: Math.round(viewport.height / scale),
                name: pageName,
                originalBytes: approxBytes,
                sizeText: formatFileSize(approxBytes),
                type: 'image/jpeg',
                isPdfPage: true,
                pdfPageNum: pageNum,
                pdfTotalPages: pdf.numPages
            };

            pageRecords.push(pageRecord);
        }

        // Clean up PDF document and terminate worker thread
        pdf.destroy();

        return pageRecords;
    } catch (err) {
        console.error("Failed to parse PDF file:", file.name, err);
        alert(`Failed to import PDF "${file.name}". The file might be password-protected or corrupted.`);
        return [];
    }
}

// Parse uploaded assets (Images, HEIC, and PDFs) asynchronously in parallel
async function processFiles(files) {
    const validFiles = Array.from(files).filter(f => {
        // Safe check MIME type
        if (f.type && (f.type.startsWith('image/') || f.type === 'application/pdf')) {
            return true;
        }
        // Fallback: check extension in filename for Android & mobile picker compatibility
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

    // Display loader state on export button
    DOM.btnConvert.disabled = true;
    const btnTextEl = DOM.btnConvert.querySelector('.btn-text');
    const btnLoadEl = DOM.btnConvert.querySelector('.btn-loading');
    const progressEl = document.getElementById('compilationProgress');

    let hasHeicOrPdf = false;
    validFiles.forEach(file => {
        const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
        if (ext === 'heic' || ext === 'heif' || ext === 'pdf' || (file.type && (file.type.includes('heic') || file.type.includes('heif') || file.type.includes('pdf')))) {
            hasHeicOrPdf = true;
        }
    });

    if (hasHeicOrPdf && btnTextEl && btnLoadEl && progressEl) {
        btnTextEl.style.display = 'none';
        btnLoadEl.style.display = 'inline-flex';
        progressEl.textContent = 'Processing files...';
    }

    // Helper function to process a single image file (supporting parallel calls)
    async function processSingleImageFile(file) {
        let fileToProcess = file;
        let resolvedType = file.type;
        const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
        const isHeic = ext === 'heic' || ext === 'heif' || (resolvedType && (resolvedType.includes('heic') || resolvedType.includes('heif')));

        if (isHeic) {
            // Check if browser natively supports HEIC decoding (Safari on iOS/macOS bypass)
            const supportsNativeHeic = (() => {
                const ua = navigator.userAgent.toLowerCase();
                const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
                const isApple = ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh');
                return isSafari && isApple;
            })();

            if (supportsNativeHeic) {
                console.log(`Safari native HEIC support detected for ${file.name}. Bypassing transcoder.`);
            } else {
                let convertFn = null;
                if (typeof HeicTo === 'function') {
                    convertFn = HeicTo;
                } else if (typeof HeicTo === 'object' && typeof HeicTo.heicTo === 'function') {
                    convertFn = HeicTo.heicTo;
                } else if (typeof heicTo === 'function') {
                    convertFn = heicTo;
                }

                if (convertFn) {
                    try {
                        let imageBitmap = null;
                        try {
                            imageBitmap = await convertFn({
                                blob: file,
                                type: 'bitmap'
                            });
                        } catch (bitmapErr) {
                            console.warn("Bitmap fast-path failed, falling back to standard canvas transcoding:", bitmapErr);
                        }

                        if (imageBitmap) {
                            const canvas = document.createElement('canvas');
                            canvas.width = imageBitmap.width;
                            canvas.height = imageBitmap.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(imageBitmap, 0, 0);
                            imageBitmap.close();

                            const mainThreadBlob = await new Promise((resolve, reject) => {
                                canvas.toBlob((b) => {
                                    if (b) resolve(b);
                                    else reject(new Error("Main-thread canvas compression failed"));
                                }, 'image/jpeg', 0.82);
                            });

                            const newName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
                            fileToProcess = new File([mainThreadBlob], newName, { type: 'image/jpeg' });
                            resolvedType = 'image/jpeg';
                        } else {
                            const convertedBlob = await convertFn({
                                blob: file,
                                type: 'image/jpeg',
                                quality: 0.82
                            });
                            const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                            const newName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
                            fileToProcess = new File([singleBlob], newName, { type: 'image/jpeg' });
                            resolvedType = 'image/jpeg';
                        }
                    } catch (heicErr) {
                        console.error('HEIC conversion failed for:', file.name, heicErr);
                        if (window.location.protocol === 'file:') {
                            alert(`HEIC Transcoding Failed for "${file.name}"!\n\nYou are running PicToPDF directly from local files (file:// protocol).\n\nModern browsers enforce strict security sandboxes on local files, which can block dynamic WebAssembly decoders.\n\nTo convert HEIC images, please serve this directory using a local web server:\n1. Open your terminal in this directory\n2. Run: python -m http.server 8000  (or npx http-server)\n3. Navigate to: http://localhost:8000`);
                        } else {
                            alert(`HEIC Transcoding Failed for "${file.name}": ${heicErr.message || heicErr}\n\nThe HEIC image might be corrupted or unsupported.`);
                        }
                        throw heicErr;
                    }
                } else {
                    const err = new Error("HEIC transcoder library is not loaded in the DOM.");
                    console.warn(err.message);
                    alert("HEIC Conversion Failed: The transcoding library (heic-to.js) failed to load.");
                    throw err;
                }
            }
        }

        // Resolve MIME type for Android pickers that return empty or generic streams
        if (!resolvedType || resolvedType === 'application/octet-stream') {
            const ext = fileToProcess.name ? fileToProcess.name.split('.').pop().toLowerCase() : '';
            if (ext === 'png') resolvedType = 'image/png';
            else if (ext === 'webp') resolvedType = 'image/webp';
            else if (ext === 'svg') resolvedType = 'image/svg+xml';
            else if (ext === 'gif') resolvedType = 'image/gif';
            else resolvedType = 'image/jpeg';
        }

        // Read image file into data URL & record
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const dataUrl = e.target.result;
                const img = new Image();
                img.onload = function () {
                    const base64Length = dataUrl.length;
                    const headerIndex = dataUrl.indexOf(',');
                    const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
                    const approxBytes = Math.round(dataLength * 0.75);

                    const fileRecord = {
                        id: Date.now() + Math.random().toString(36).substr(2, 5),
                        file: fileToProcess,
                        dataUrl: dataUrl,
                        originalDataUrl: dataUrl,
                        quality: STATE.settings.imageQuality,
                        width: img.width,
                        height: img.height,
                        name: fileToProcess.name,
                        originalBytes: approxBytes,
                        sizeText: formatFileSize(approxBytes),
                        type: resolvedType
                    };
                    resolve([fileRecord]);
                };
                img.onerror = function () {
                    console.error("Failed to load image element for file:", fileToProcess.name);
                    alert("Unable to decode '" + fileToProcess.name + "'. The image might be unsupported by the browser or corrupted.");
                    resolve([]);
                };
                img.src = dataUrl;
            };
            reader.onerror = function () {
                console.error("FileReader failed for file:", fileToProcess.name);
                resolve([]);
            };
            reader.readAsDataURL(fileToProcess);
        });
    }

    // Execute parallel file tasks (handling both PDF documents & Images concurrently)
    const fileTasks = validFiles.map(async (file) => {
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
    });

    const resultsArray = await Promise.all(fileTasks);
    const allRecords = resultsArray.flat().filter(rec => rec !== null && rec !== undefined);

    if (allRecords.length > 0) {
        STATE.files.push(...allRecords);
        STATE.activePageIdx = STATE.files.length - 1; // Set last loaded page active
        updateUIState();
    }

    // Reset input element & restore buttons
    DOM.fileInput.value = '';
    if (btnTextEl && btnLoadEl) {
        btnTextEl.style.display = 'inline-flex';
        btnLoadEl.style.display = 'none';
    }
}

// Format raw bytes
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}



function clearAllFiles() {
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
        if (DOM.btnExtractZip) DOM.btnExtractZip.disabled = true;

        // Show layout preview placeholder
        DOM.previewPlaceholder.style.display = 'flex';
        const existingSheet = DOM.virtualPreviewCanvas.querySelector('.virtual-pdf-sheet');
        if (existingSheet) existingSheet.remove();

        DOM.previewPagination.style.display = 'none';

        if (DOM.sizeIndicatorGroup) {
            DOM.sizeIndicatorGroup.style.display = 'none';
        }
    } else {
        DOM.imageListCard.style.display = 'flex';
        DOM.btnConvert.disabled = false;
        if (DOM.btnExtractZip) DOM.btnExtractZip.disabled = false;
        DOM.previewPlaceholder.style.display = 'none';

        // Boundaries checks for navigation indicator index
        if (STATE.activePageIdx >= fileCount) {
            STATE.activePageIdx = fileCount - 1;
        }
        if (STATE.activePageIdx < 0) {
            STATE.activePageIdx = 0;
        }

        renderUploadedGrid();
        renderVirtualLayoutPreview();
        recalculateEstimatedPDFSize();
    }
}

// Display uploaded files with sorting capabilities and metadata
function renderUploadedGrid() {
    DOM.imageListContainer.innerHTML = '';

    STATE.files.forEach((fileObj, index) => {
        const item = document.createElement('div');
        item.className = 'image-item-node animate-fade-in-up';
        item.style.animationDelay = `${index * 0.05}s`;
        item.setAttribute('draggable', 'true');
        item.dataset.index = index;

        const isFirst = index === 0;
        const isLast = index === STATE.files.length - 1;

        const isEdited = fileObj.dataUrl !== fileObj.originalDataUrl || fileObj.filters || fileObj.rotation || fileObj.pageSizeOverride || fileObj.marginOverride;
        const individualSize = fileObj.exactPdfSize || fileObj.estimatedPdfSize || 0;
        const sizeDisplay = individualSize ? formatFileSize(individualSize) : 'Calculating...';

        const qualityLabel = fileObj.quality === 100 ? 'Original' : `${fileObj.quality || 90}%`;

        item.innerHTML = `
            <img src="${fileObj.dataUrl}" alt="${fileObj.name}" class="node-thumbnail">
            <div class="node-details">
                <h4>${fileObj.name}</h4>
                <div class="node-meta" style="margin-bottom: 6px;">
                    <span class="badge-dim">${fileObj.width} x ${fileObj.height} px</span>
                    ${fileObj.isPdfPage ? '<span class="badge badge-pdf">PDF Page</span>' : ''}
                    ${isEdited ? '<span class="badge cropped-badge">Edited</span>' : ''}
                    <span class="meta-divider"></span>
                    <span class="meta-text" title="Original File Size">${fileObj.sizeText}</span>
                    <span class="meta-divider"></span>
                    <span class="badge individual-pdf-size-badge" data-index="${index}" style="background-color: rgba(139, 92, 246, 0.08); color: var(--accent-solid); font-weight: 600;" title="Estimated PDF size for this page">
                        PDF Size: ${sizeDisplay}
                    </span>
                </div>
                
                <!-- Per-Image Compression Slider -->
                <div class="inline-quality-control" style="margin-bottom: 8px; display: flex; align-items: center; gap: 0.5rem; max-width: 250px;">
                    <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; min-width: 50px;">Quality:</span>
                    <input type="range" class="inline-quality-slider" data-index="${index}" min="10" max="100" value="${fileObj.quality || 90}" style="flex: 1; height: 4px; cursor: pointer;">
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
                <button type="button" class="btn-circle" title="Move Down" ${isLast ? 'disabled' : ''} onclick="swapFiles(${index}, ${index + 1})">
                    <i data-lucide="chevron-down"></i>
                </button>
                <button type="button" class="btn-circle btn-circle-delete" title="Remove image" onclick="removeFile(${index})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;

        // Bind inline slider listener with stopPropagation to prevent active card selection triggers
        const inlineSlider = item.querySelector('.inline-quality-slider');
        const inlineBadge = item.querySelector('.inline-quality-badge');
        const inlineControlRow = item.querySelector('.inline-quality-control');

        inlineSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            fileObj.quality = val;
            inlineBadge.textContent = val === 100 ? 'Original' : `${val}%`;

            // Fast recalculate size approximation
            recalculateEstimatedPDFSize();
        });

        // Prevent HTML5 Drag and Drop from interrupting slider usage
        const preventDrag = () => { item.draggable = false; };
        const restoreDrag = () => { item.draggable = true; };
        inlineSlider.addEventListener('pointerdown', preventDrag);
        inlineSlider.addEventListener('pointerup', restoreDrag);
        inlineSlider.addEventListener('pointercancel', restoreDrag);
        inlineSlider.addEventListener('pointerleave', restoreDrag);

        inlineControlRow.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Active click background indicator for currently previewed page
        if (index === STATE.activePageIdx) {
            item.style.borderColor = 'var(--accent-solid)';
            item.style.backgroundColor = 'rgba(139, 92, 246, 0.04)';
        }

        // Click item body to inspect in layout panel
        item.addEventListener('click', (e) => {
            // Prevent trigger if clicking action items
            if (e.target.closest('button') || e.target.closest('i') || e.target.closest('input')) return;
            STATE.activePageIdx = index;
            updateUIState();
        });

        // Drag and drop sorting events
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
            item.classList.add('dragging');
            // Slight visual fade
            setTimeout(() => { item.style.opacity = '0.4'; }, 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            item.style.opacity = '1';

            // Clean up dragover visual states on all nodes
            document.querySelectorAll('.image-item-node').forEach(node => {
                node.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });

        item.addEventListener('dragover', (e) => {
            // Ignore if dragging external files
            if (e.dataTransfer && hasFiles(e.dataTransfer.types)) {
                return;
            }

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Check bounding box to decide if dropping before or after
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

        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        item.addEventListener('drop', (e) => {
            // Ignore if dropping external files
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

            // Move item in array
            const movedItem = STATE.files.splice(dragIndex, 1)[0];

            // If dropping into bottom half, place after, else place before
            const rect = item.getBoundingClientRect();
            const relY = e.clientY - rect.top;

            let finalIndex = dropIndex;
            if (dragIndex < dropIndex) {
                // Since we removed item, array shifted left
                finalIndex = relY < rect.height / 2 ? dropIndex - 1 : dropIndex;
            } else {
                finalIndex = relY < rect.height / 2 ? dropIndex : dropIndex + 1;
            }

            STATE.files.splice(finalIndex, 0, movedItem);

            // Update active index if moved
            if (STATE.activePageIdx === dragIndex) {
                STATE.activePageIdx = finalIndex;
            } else {
                // Check if active page was shifted
                if (STATE.activePageIdx > dragIndex && STATE.activePageIdx <= finalIndex) {
                    STATE.activePageIdx--;
                } else if (STATE.activePageIdx < dragIndex && STATE.activePageIdx >= finalIndex) {
                    STATE.activePageIdx++;
                }
            }

            updateUIState();
        });

        DOM.imageListContainer.appendChild(item);
    });

    // Re-create icons for new dynamic list markup
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function swapFiles(idxA, idxB) {
    const temp = STATE.files[idxA];
    STATE.files[idxA] = STATE.files[idxB];
    STATE.files[idxB] = temp;

    // Follow the swapped index
    if (STATE.activePageIdx === idxA) {
        STATE.activePageIdx = idxB;
    } else if (STATE.activePageIdx === idxB) {
        STATE.activePageIdx = idxA;
    }

    updateUIState();
}

function removeFile(index) {
    STATE.files.splice(index, 1);
    if (STATE.activePageIdx >= STATE.files.length) {
        STATE.activePageIdx = Math.max(0, STATE.files.length - 1);
    }
    updateUIState();
}

// Generate the virtual PDF page mockup sheet dynamically
function renderVirtualLayoutPreview() {
    // Clear old sheet
    const oldSheet = DOM.virtualPreviewCanvas.querySelector('.virtual-pdf-sheet');
    if (oldSheet) oldSheet.remove();

    const activeFile = STATE.files[STATE.activePageIdx];
    if (!activeFile) return;

    // Create the page sheet DOM structure
    const sheet = document.createElement('div');
    sheet.className = 'virtual-pdf-sheet';

    // Calculate aspect ratio and dimensions for virtual preview
    let pageW = 1;
    let pageH = 1.414; // Default standard aspect ratio

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

    // Set standard style ratio
    sheet.style.aspectRatio = `${pageW} / ${pageH}`;

    // Render margins guides
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

    // Setup interior elements
    const imgElement = document.createElement('img');
    imgElement.src = activeFile.dataUrl;
    imgElement.className = 'virtual-sheet-image';

    // Apply margins padding to the page sheet
    sheet.style.padding = `${marginPercent}%`;

    // Add sizing alignments based on settings
    if (usedPageSize === 'original') {
        imgElement.style.objectFit = 'fill';
    } else {
        // Presets layouts
        const fitting = STATE.settings.imageFitting;

        if (fitting === 'fit') {
            imgElement.style.objectFit = 'contain';
        } else if (fitting === 'fill') {
            imgElement.style.objectFit = 'cover';
        } else {
            // stretch
            imgElement.style.objectFit = 'fill';
        }
    }

    sheet.appendChild(imgElement);
    DOM.virtualPreviewCanvas.appendChild(sheet);

    // Render pagination indicators
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
   jsPDF Compilation Processing
   ========================================================================== */
async function convertImagesToPDF() {
    if (STATE.files.length === 0 || STATE.compiling) return;

    STATE.compiling = true;
    DOM.btnConvert.disabled = true;

    const btnTextEl = DOM.btnConvert.querySelector('.btn-text');
    const btnLoadEl = DOM.btnConvert.querySelector('.btn-loading');
    const progressEl = document.getElementById('compilationProgress');

    btnTextEl.style.display = 'none';
    btnLoadEl.style.display = 'inline-flex';
    progressEl.textContent = '0%';

    try {
        const fingerprint = STATE.files.map(f => f.id).join(',');
        const qFingerprint = STATE.files.map(f => f.quality || 90).join(',');

        // Check cache
        let compiledResult = null;
        if (STATE.compiledCache &&
            STATE.compiledCache.pageSize === STATE.settings.pageSize &&
            STATE.compiledCache.orientation === STATE.settings.orientation &&
            STATE.compiledCache.margin === STATE.settings.margin &&
            STATE.compiledCache.imageFitting === STATE.settings.imageFitting &&
            STATE.compiledCache.mergeMode === STATE.settings.mergeMode &&
            STATE.compiledCache.filesLength === STATE.files.length &&
            STATE.compiledCache.filesFingerprint === fingerprint &&
            STATE.compiledCache.qualitiesFingerprint === qFingerprint &&
            STATE.compiledCache.enablePassword === STATE.settings.enablePassword &&
            STATE.compiledCache.pdfPassword === STATE.settings.pdfPassword &&
            STATE.compiledCache.watermarkText === STATE.settings.watermarkText &&
            STATE.compiledCache.data) {

            compiledResult = STATE.compiledCache.data;
            progressEl.textContent = '100%';
        } else {
            compiledResult = await compilePDFDocument(async (curr, tot) => {
                const percent = Math.round((curr / tot) * 100);
                progressEl.textContent = `${percent}%`;
                await delay(50);
            });
        }

        // Download
        if (STATE.settings.mergeMode === 'single') {
            compiledResult.doc.save('pictopdf_compiled.pdf');
        } else {
            for (let i = 0; i < compiledResult.docs.length; i++) {
                const imgData = STATE.files[i];
                const safeName = imgData.name.replace(/\.[^/.]+$/, "");
                compiledResult.docs[i].save(`${safeName}_converted.pdf`);
                await delay(300);
            }
        }

    } catch (err) {
        console.error('PDF Export Failed:', err);
        alert('An error occurred while compiling your PDF. Check details in your browser console.');
    } finally {
        STATE.compiling = false;
        DOM.btnConvert.disabled = false;
        btnTextEl.style.display = 'inline-flex';
        btnLoadEl.style.display = 'none';
    }
}

/* ==========================================================================
   Image Extraction & ZIP Packing
   ========================================================================== */

// Download a single card image directly as a JPEG file
async function downloadSingleImage(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    try {
        const quality = fileObj.quality || STATE.settings.imageQuality;
        const processedImage = await processQualityRatio(fileObj.dataUrl, fileObj.type, quality);

        const cleanName = fileObj.name.replace(/\.[^/.]+$/, "").replace(/[^\w\s-]/gi, '').replace(/\s+/g, "_");
        const fileName = `${cleanName}_extracted.jpg`;

        const link = document.createElement('a');
        link.href = processedImage.url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Failed to download image:", err);
        alert("Failed to download image. Check console details.");
    }
}


// Compile the PDF document exactly according to active settings
async function compilePDFDocument(progressCallback) {
    const count = STATE.files.length;
    if (count === 0) return null;

    if (STATE.settings.mergeMode === 'single') {
        let doc = null;
        
        // Start all image processing in parallel to utilize multiple cores/threads
        const processingPromises = STATE.files.map(imgData => {
            const quality = imgData.quality || STATE.settings.imageQuality;
            return processQualityRatio(imgData.dataUrl, imgData.type, quality);
        });

        for (let i = 0; i < count; i++) {
            if (progressCallback) await progressCallback(i, count);

            const imgData = STATE.files[i];
            const processedImage = await processingPromises[i];

            // Calculate base64 length in bytes of the compressed stream
            const base64Length = processedImage.url.length;
            const headerIndex = processedImage.url.indexOf(',');
            const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
            const imageBytes = Math.round(dataLength * 0.75);

            // Save exact individual size contribution inside state
            imgData.exactPdfSize = imageBytes + 1500;

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

        // Start all image processing in parallel to utilize multiple cores/threads
        const processingPromises = STATE.files.map(imgData => {
            const quality = imgData.quality || STATE.settings.imageQuality;
            return processQualityRatio(imgData.dataUrl, imgData.type, quality);
        });

        for (let i = 0; i < count; i++) {
            if (progressCallback) await progressCallback(i, count);

            const imgData = STATE.files[i];
            const processedImage = await processingPromises[i];
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
                processedImage.url,
                processedImage.format,
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

            // Save exact individual PDF blob size in state
            imgData.exactPdfSize = itemBlob.size;

            docs.push(itemDoc);
            blobs.push(itemBlob);
        }

        if (progressCallback) await progressCallback(count, count);
        return { docs, blobs, size: totalSize };
    }
}

// Helper to stamp watermark diagonally
function applyWatermark(doc, pageConfig, text) {
    doc.setTextColor(150, 150, 150); // Light gray
    doc.setFontSize(42);
    // Add transparency via GState if jsPDF allows, otherwise rely on light color
    doc.text(text, pageConfig.pageW / 2, pageConfig.pageH / 2, {
        align: 'center',
        angle: 45
    });
}

// Compress client-side using standard offscreen HTML canvas drawing contexts
function processQualityRatio(dataUrl, mimeType, quality) {
    return new Promise((resolve) => {
        // No compression for full lossless representations or vector formats
        if (quality === 100 || mimeType === 'image/svg+xml') {
            const format = mimeType.includes('png') ? 'PNG' : 'JPEG';
            resolve({ url: dataUrl, format: format });
            return;
        }

        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);

            // Export as compressed JPEG format representation
            const qualityDecimal = quality / 100;
            const compressedUrl = canvas.toDataURL('image/jpeg', qualityDecimal);

            // Release GPU canvas memory immediately
            canvas.width = 0;
            canvas.height = 0;

            resolve({ url: compressedUrl, format: 'JPEG' });
        };
        img.src = dataUrl;
    });
}

// Coordinate calculation systems (Original / Margins / Alignment fitting)
function getPageDimensionsAndImageBounds(imgW, imgH, pageSize, orientation, marginType, imageFitting) {
    let pageW = 0;
    let pageH = 0;

    // Page Size Selection
    if (pageSize === 'original') {
        pageW = imgW * 0.75; // Convert image px to pt (assuming 96 dpi: 1 px = 0.75 pt)
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

    // Predefined Paper selection sizing (A4, Letter, legal...)
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

    // Margin size calculations
    const margin = MARGIN_SIZES[marginType];

    // Printable Dimensions inside margin layout bounds
    const printableW = pageW - (margin * 2);
    const printableH = pageH - (margin * 2);

    let imgX = margin;
    let imgY = margin;
    let drawW = printableW;
    let drawH = printableH;

    const pageRatio = printableW / printableH;
    const imgRatio = imgW / imgH;

    // Alignment / Aspect scaling strategy formulas
    if (imageFitting === 'fit') {
        // Centering and fitting maintaining original bounds
        if (imgRatio > pageRatio) {
            // Image is wider than page ratio
            drawW = printableW;
            drawH = printableW / imgRatio;
            imgY = margin + (printableH - drawH) / 2;
        } else {
            // Image is taller than page ratio
            drawH = printableH;
            drawW = printableH * imgRatio;
            imgX = margin + (printableW - drawW) / 2;
        }
    } else if (imageFitting === 'fill') {
        // Fills printable canvas box, cropping overlapping bounds. 
        if (imgRatio > pageRatio) {
            // Image is wider than page ratio - scale height to printable, overflow width
            drawH = printableH;
            drawW = printableH * imgRatio;
            imgX = margin + (printableW - drawW) / 2;
        } else {
            // Image is taller than page ratio - scale width to printable, overflow height
            drawW = printableW;
            drawH = printableW / imgRatio;
            imgY = margin + (printableH - drawH) / 2;
        }
    } else {
        // stretch: matches printable width and height exactly, ignoring aspect ratios
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

// Utility delay timer
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Recalculate estimated PDF size based on selected quality and files in queue
let exactSizeTimeout = null;

function recalculateEstimatedPDFSize() {
    if (STATE.files.length === 0) {
        if (DOM.sizeIndicatorGroup) {
            DOM.sizeIndicatorGroup.style.display = 'none';
        }
        return;
    }

    if (DOM.sizeIndicatorGroup) {
        DOM.sizeIndicatorGroup.style.display = 'flex';
    }

    const globalQuality = STATE.settings.imageQuality;

    // Check if we already have the exact size calculated for these precise settings
    const fingerprint = STATE.files.map(f => f.id + '-' + (f.editCount || 0)).join(',');
    const qFingerprint = STATE.files.map(f => f.quality || 90).join(',');

    if (STATE.compiledCache &&
        STATE.compiledCache.pageSize === STATE.settings.pageSize &&
        STATE.compiledCache.orientation === STATE.settings.orientation &&
        STATE.compiledCache.margin === STATE.settings.margin &&
        STATE.compiledCache.imageFitting === STATE.settings.imageFitting &&
        STATE.compiledCache.mergeMode === STATE.settings.mergeMode &&
        STATE.compiledCache.filesLength === STATE.files.length &&
        STATE.compiledCache.filesFingerprint === fingerprint &&
        STATE.compiledCache.qualitiesFingerprint === qFingerprint &&
        STATE.compiledCache.enablePassword === STATE.settings.enablePassword &&
        STATE.compiledCache.pdfPassword === STATE.settings.pdfPassword &&
        STATE.compiledCache.watermarkText === STATE.settings.watermarkText) {

        // Cache hit! Skip background processing completely
        if (DOM.estimatedPdfSize) {
            const label = STATE.settings.mergeMode === 'separate' ? 'Batch Total' : 'Size';
            DOM.estimatedPdfSize.textContent = `${label}: ${formatFileSize(STATE.compiledCache.data.size)}`;
        }

        updateIndividualSizeBadges();
        return; // STOP execution. Do not start timeout or background compiler.
    }

    // Cache miss: clear exact sizes and show Calculating...
    STATE.files.forEach(fileObj => {
        fileObj.exactPdfSize = null;
    });

    if (DOM.estimatedPdfSize) {
        DOM.estimatedPdfSize.textContent = "...";
    }

    // Update individual page badges instantly during dragging/updating
    updateIndividualSizeBadges();

    // 2. Debounced Exact Compiled Size Calculation
    if (exactSizeTimeout) {
        clearTimeout(exactSizeTimeout);
    }

    const watermarkCheck = STATE.settings.watermarkText;
    const enablePasswordCheck = STATE.settings.enablePassword;
    const passwordCheck = STATE.settings.pdfPassword;

    exactSizeTimeout = setTimeout(async () => {
        try {
            const result = await compilePDFDocument();
            if (!result) return;

            const currentFingerprint = STATE.files.map(f => f.id + '-' + (f.editCount || 0)).join(',');
            const currentQFingerprint = STATE.files.map(f => f.quality || 90).join(',');

            const currentWatermark = STATE.settings.watermarkText;
            const currentEnablePassword = STATE.settings.enablePassword;
            const currentPassword = STATE.settings.pdfPassword;

            if (STATE.settings.imageQuality === globalQuality &&
                currentFingerprint === fingerprint &&
                currentQFingerprint === qFingerprint &&
                currentWatermark === watermarkCheck &&
                currentEnablePassword === enablePasswordCheck &&
                currentPassword === passwordCheck) {

                if (DOM.estimatedPdfSize) {
                    const label = STATE.settings.mergeMode === 'separate' ? 'Batch Total' : 'Size';
                    DOM.estimatedPdfSize.textContent = `${label}: ${formatFileSize(result.size)}`;
                }

                updateIndividualSizeBadges();

                STATE.compiledCache = {
                    pageSize: STATE.settings.pageSize,
                    orientation: STATE.settings.orientation,
                    margin: STATE.settings.margin,
                    imageFitting: STATE.settings.imageFitting,
                    mergeMode: STATE.settings.mergeMode,
                    filesLength: STATE.files.length,
                    filesFingerprint: fingerprint,
                    qualitiesFingerprint: qFingerprint,
                    enablePassword: STATE.settings.enablePassword,
                    pdfPassword: STATE.settings.pdfPassword,
                    watermarkText: STATE.settings.watermarkText,
                    data: result
                };
            }
        } catch (e) {
            console.warn("Failed to background-compile PDF:", e);
        }
    }, 0); // 0ms delay as requested for instant recalculation
}

// Update individual list card badge text content instantly
function updateIndividualSizeBadges() {
    const badges = DOM.imageListContainer.querySelectorAll('.individual-pdf-size-badge');
    badges.forEach(badge => {
        const idx = parseInt(badge.getAttribute('data-index'));
        const fileObj = STATE.files[idx];
        if (fileObj) {
            if (fileObj.exactPdfSize) {
                badge.textContent = `Size: ${formatFileSize(fileObj.exactPdfSize)}`;
            } else {
                badge.textContent = `Size: ...`;
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
    tempDataUrl: null, // holds the image with rotation/filters applied before cropping
    perspectiveMode: false,
    perspectiveDraggingNode: null,
    perspectivePoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ]
};

function openEditInterface(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    editState.index = index;
    editState.aspectRatio = 'free';
    editState.perspectiveMode = false;
    DOM.togglePerspective.checked = false;

    // Load existing local settings or defaults
    editState.rotation = fileObj.rotation || 0;
    editState.filters = fileObj.filters ? { ...fileObj.filters } : { brightness: 100, contrast: 100, grayscale: 0, sepia: 0 };
    editState.pageSizeOverride = fileObj.pageSizeOverride || 'global';
    editState.marginOverride = fileObj.marginOverride || 'global';

    const editSidebar = DOM.editModal.querySelector('.edit-sidebar');
    if (editSidebar) editSidebar.classList.add('controls-open');
    DOM.editModal.classList.add('controls-open');

    // Set UI elements
    DOM.cropAspectRatio.value = 'free';
    DOM.overridePageSize.value = editState.pageSizeOverride;
    DOM.overrideMargin.value = editState.marginOverride;

    DOM.filterBrightness.value = editState.filters.brightness;
    DOM.filterContrast.value = editState.filters.contrast;
    DOM.filterGrayscale.value = editState.filters.grayscale;
    DOM.filterSepia.value = editState.filters.sepia;

    updateFilterBadges();

    // Prevent background home page from scrolling while modal is open
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    DOM.editModal.style.display = 'flex';

    // Reset tabs
    document.querySelectorAll('.edit-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.edit-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="tab-crop"]').classList.add('active');
    document.getElementById('tab-crop').classList.add('active');

    // Generate the preview image (bakes in filters and rotation to a temp canvas)
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

    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Handle Rotation bounds
        let cw = img.width;
        let ch = img.height;
        if (editState.rotation % 180 !== 0) {
            cw = img.height;
            ch = img.width;
        }

        canvas.width = cw;
        canvas.height = ch;

        // Apply CSS Filters
        ctx.filter = `brightness(${editState.filters.brightness}%) contrast(${editState.filters.contrast}%) grayscale(${editState.filters.grayscale}%) sepia(${editState.filters.sepia}%)`;

        // Apply Transform
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(editState.rotation * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Save to temp state and UI
        editState.tempDataUrl = canvas.toDataURL(fileObj.type, 1.0);

        // Clean GPU
        canvas.width = 0; canvas.height = 0;

        DOM.cropSourceImage.onload = () => {
            if (resetCropBox) {
                setTimeout(() => {
                    const displayedW = DOM.cropSourceImage.clientWidth;
                    const displayedH = DOM.cropSourceImage.clientHeight;

                    const boxW = displayedW;
                    const boxH = displayedH;
                    const boxL = 0;
                    const boxT = 0;

                    DOM.cropBox.style.left = boxL + 'px';
                    DOM.cropBox.style.top = boxT + 'px';
                    DOM.cropBox.style.width = boxW + 'px';
                    DOM.cropBox.style.height = boxH + 'px';

                    DOM.cropWorkspace.style.width = displayedW + 'px';
                    DOM.cropWorkspace.style.height = displayedH + 'px';

                    // Reset perspective points to corners
                    editState.perspectivePoints = [
                        { x: 0, y: 0 },
                        { x: displayedW, y: 0 },
                        { x: displayedW, y: displayedH },
                        { x: 0, y: displayedH }
                    ];
                    updatePerspectiveUI();
                }, 50);
            }
        };
        DOM.cropSourceImage.src = editState.tempDataUrl;
    };
    img.src = fileObj.originalDataUrl;
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

// Bind Edit Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initEditEvents();
});

function initEditEvents() {
    if (!DOM.cropBox) return;

    // Toggle Perspective Mode
    if (DOM.togglePerspective) {
        DOM.togglePerspective.addEventListener('change', (e) => {
            editState.perspectiveMode = e.target.checked;
            updatePerspectiveUI();
        });
    }

    // Tabs switching
    document.querySelectorAll('.edit-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const sidebar = DOM.editModal.querySelector('.edit-sidebar');
            const wasActive = target.classList.contains('active');
            const isOpen = sidebar ? sidebar.classList.contains('controls-open') : false;

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

    // Tools
    DOM.btnRotateLeft.addEventListener('click', () => { editState.rotation = (editState.rotation - 90) % 360; updateEditPreview(true); });
    DOM.btnRotateRight.addEventListener('click', () => { editState.rotation = (editState.rotation + 90) % 360; updateEditPreview(true); });

    // Filters (live preview using input)
    const applyFilters = (resetCrop = false) => {
        editState.filters.brightness = parseInt(DOM.filterBrightness.value);
        editState.filters.contrast = parseInt(DOM.filterContrast.value);
        editState.filters.grayscale = parseInt(DOM.filterGrayscale.value);
        editState.filters.sepia = parseInt(DOM.filterSepia.value);
        updateFilterBadges();
        updateEditPreview(resetCrop);
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

    // Layout
    DOM.overridePageSize.addEventListener('change', (e) => { editState.pageSizeOverride = e.target.value; });
    DOM.overrideMargin.addEventListener('change', (e) => { editState.marginOverride = e.target.value; });

    // 1. Close actions
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

    // Fullscreen toggle
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

        // Allow layout to adapt, then sync workspace and crop box to the resized image
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

    // Escape key listener to exit full view or close modal
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.editModal && DOM.editModal.style.display !== 'none') {
            if (DOM.editModal.classList.contains('fullscreen-mode')) {
                toggleFullscreenFunc();
            } else {
                closeEditInterface();
            }
        }
    });

    // Close on click outside
    DOM.editModal.addEventListener('mousedown', (e) => {
        if (e.target === DOM.editModal) {
            closeEditInterface();
        }
    });

    // 2. Dragging box moves
    DOM.cropBox.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();

        // Release any existing state
        endEditPointer();

        editState.dragging = true;
        editState.startX = e.clientX;
        editState.startY = e.clientY;
        editState.startLeft = parseInt(DOM.cropBox.style.left) || 0;
        editState.startTop = parseInt(DOM.cropBox.style.top) || 0;
        
        DOM.cropBox.setPointerCapture(e.pointerId);
    });

    // 3. Resizing handles (all 4 corners)
    const cHandles = DOM.cropBox.querySelectorAll('.crop-handle');
    cHandles.forEach(handle => {
        const startCropDrag = (e, clientX, clientY) => {
            e.stopPropagation(); e.preventDefault();
            endEditPointer();
            
            editState.resizing = true;
            // Determine which corner this is based on its class
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

    // 3.5 Perspective Handles
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

    // 4. Mouse movement tracking
    window.addEventListener('pointermove', (e) => {
        if (editState.dragging || editState.resizing || editState.perspectiveDraggingNode !== null) {
            e.preventDefault();
            handlePointerMove(e);
        }
    }, { passive: false });

    // 5. Mouse release tracking
    window.addEventListener('pointerup', endEditPointer);
    window.addEventListener('pointercancel', endEditPointer);

    // 6. Aspect Ratio changes
    DOM.cropAspectRatio.addEventListener('change', (e) => {
        editState.aspectRatio = e.target.value;
        applyCropAspectRatio();
    });

    // 7. Apply Edit Action
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

        // Bounds checking
        if (newL < 0) { newW += newL; newL = 0; }
        if (newT < 0) { newH += newT; newT = 0; }
        if (newL + newW > displayedW) newW = displayedW - newL;
        if (newT + newH > displayedH) newH = displayedH - newT;

        if (editState.aspectRatio !== 'free') {
            const ratioParts = editState.aspectRatio.split(':').map(Number);
            const ratio = ratioParts[0] / ratioParts[1];

            newH = newW / ratio;
            
            // If dragging a top handle, we must adjust newT so the bottom edge stays fixed
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
                newH = newH + newT; // newT is negative, so this shrinks newH
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
    // Restore home page scrolling
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
    // 1. Scale points to native resolution
    const scaledPts = pts.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));

    // 2. Estimate output bounding box size (average of top/bottom widths and left/right heights)
    const wTop = Math.hypot(scaledPts[1].x - scaledPts[0].x, scaledPts[1].y - scaledPts[0].y);
    const wBot = Math.hypot(scaledPts[2].x - scaledPts[3].x, scaledPts[2].y - scaledPts[3].y);
    const hLeft = Math.hypot(scaledPts[3].x - scaledPts[0].x, scaledPts[3].y - scaledPts[0].y);
    const hRight = Math.hypot(scaledPts[2].x - scaledPts[1].x, scaledPts[2].y - scaledPts[1].y);
    const outW = Math.round((wTop + wBot) / 2);
    const outH = Math.round((hLeft + hRight) / 2);

    // 3. Draw source image to offscreen canvas to get ImageData
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcImg.width;
    srcCanvas.height = srcImg.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, srcImg.width, srcImg.height).data;

    // 4. Prepare output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    const outImgData = outCtx.createImageData(outW, outH);
    const outData = outImgData.data;

    // 5. Get transformation matrix (from output unit square to input quad)
    const H = getPerspectiveTransform(scaledPts);

    // 6. Raycast pixels
    const srcW = srcImg.width;
    const srcH = srcImg.height;
    for (let r = 0; r < outH; r++) {
        const v = r / outH;
        for (let c = 0; c < outW; c++) {
            const u = c / outW;

            // Apply homography
            const w = H[6] * u + H[7] * v + H[8];
            const x = (H[0] * u + H[1] * v + H[2]) / w;
            const y = (H[3] * u + H[4] * v + H[5]) / w;

            const px = Math.round(x);
            const py = Math.round(y);

            const outIdx = (r * outW + c) * 4;
            if (px >= 0 && px < srcW && py >= 0 && py < srcH) {
                const srcIdx = (py * srcW + px) * 4;
                outData[outIdx] = srcData[srcIdx];         // R
                outData[outIdx + 1] = srcData[srcIdx + 1];     // G
                outData[outIdx + 2] = srcData[srcIdx + 2];     // B
                outData[outIdx + 3] = srcData[srcIdx + 3];     // A
            } else {
                outData[outIdx + 3] = 0; // Transparent
            }
        }
    }

    outCtx.putImageData(outImgData, 0, 0);
    return outCanvas;
}

function applyImageEdits() {
    const index = editState.index;
    const fileObj = STATE.files[index];
    if (!fileObj || !editState.tempDataUrl) return;

    fileObj.editCount = (fileObj.editCount || 0) + 1;

    const displayedW = DOM.cropSourceImage.clientWidth;
    const displayedH = DOM.cropSourceImage.clientHeight;

    const img = new Image();
    img.onload = function () {
        // Find natural bounds of the pre-processed (rotated/filtered) image
        const scaleX = img.width / displayedW;
        const scaleY = img.height / displayedH;

        let finalCanvas;
        let finalW, finalH;

        if (editState.perspectiveMode) {
            finalCanvas = applyPerspectiveWarp(img, editState.perspectivePoints, scaleX, scaleY);
            finalW = finalCanvas.width;
            finalH = finalCanvas.height;
        } else {
            const boxLeft = parseInt(DOM.cropBox.style.left);
            const boxTop = parseInt(DOM.cropBox.style.top);
            const boxWidth = parseInt(DOM.cropBox.style.width);
            const boxHeight = parseInt(DOM.cropBox.style.height);

            finalW = Math.round(boxWidth * scaleX);
            finalH = Math.round(boxHeight * scaleY);
            const cropX = Math.round(boxLeft * scaleX);
            const cropY = Math.round(boxTop * scaleY);

            finalCanvas = document.createElement('canvas');
            finalCanvas.width = finalW;
            finalCanvas.height = finalH;
            const ctx = finalCanvas.getContext('2d');

            // Final crop of the baked image
            ctx.drawImage(img, cropX, cropY, finalW, finalH, 0, 0, finalW, finalH);
        }

        const croppedDataUrl = finalCanvas.toDataURL(fileObj.type, 0.95);
        finalCanvas.width = 0; finalCanvas.height = 0;

        const base64Length = croppedDataUrl.length;
        const headerIndex = croppedDataUrl.indexOf(',');
        const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
        const imageBytes = Math.round(dataLength * 0.75);

        // Save applied edits back to fileObj
        fileObj.dataUrl = croppedDataUrl;
        fileObj.width = finalW;
        fileObj.height = finalH;
        fileObj.sizeText = formatFileSize(imageBytes);

        fileObj.rotation = editState.rotation;
        fileObj.filters = { ...editState.filters };
        fileObj.pageSizeOverride = editState.pageSizeOverride;
        fileObj.marginOverride = editState.marginOverride;

        closeEditInterface();
        updateUIState();
        recalculateEstimatedPDFSize();
    };
    img.src = editState.tempDataUrl;
}

// Revert all edits
function resetEdits(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    const img = new Image();
    img.onload = function () {
        fileObj.dataUrl = fileObj.originalDataUrl;
        fileObj.width = img.width;
        fileObj.height = img.height;

        // Remove override keys
        delete fileObj.rotation;
        delete fileObj.filters;
        delete fileObj.pageSizeOverride;
        delete fileObj.marginOverride;

        const base64Length = fileObj.originalDataUrl.length;
        const headerIndex = fileObj.originalDataUrl.indexOf(',');
        const dataLength = headerIndex !== -1 ? base64Length - headerIndex - 1 : base64Length;
        const imageBytes = Math.round(dataLength * 0.75);

        fileObj.sizeText = formatFileSize(imageBytes);

        updateUIState();
        recalculateEstimatedPDFSize();
    };
    img.src = fileObj.originalDataUrl;
}

// Download just one image as a PDF
async function downloadSinglePDF(index) {
    const fileObj = STATE.files[index];
    if (!fileObj) return;

    // Show loading on the button
    const btn = document.querySelectorAll('.btn-crop-node')[index * 3 + 1]; // Approximate, just for UI feedback
    if (btn) btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    try {
        const quality = fileObj.quality || STATE.settings.imageQuality;
        const processedImage = await processQualityRatio(fileObj.dataUrl, fileObj.type, quality);

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
            processedImage.url,
            processedImage.format,
            pageConfig.imgX,
            pageConfig.imgY,
            pageConfig.imgW,
            pageConfig.imgH
        );

        const originalName = fileObj.name.split('.')[0];
        doc.save(`${originalName}_LuminaPDF.pdf`);
    } catch (err) {
        console.error("Failed to generate single PDF", err);
        alert("Failed to generate PDF for this image.");
    }

    updateUIState();
}
