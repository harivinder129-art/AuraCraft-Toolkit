/**
 * state.js - Central Application State, DOM Elements, and Constants
 */

// App State Management
export const STATE = {
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

if (typeof window !== 'undefined') {
    window.STATE = STATE;
}

// DOM Cache Elements
export const DOM = {
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
    stickyBarContainer: document.querySelector('.sticky-bar-container'),
    stickyActionsGroup: document.querySelector('.sticky-actions-group'),
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
export const PAGE_PRESETS = {
    a4: { name: 'A4', width: 595.28, height: 841.89 },
    letter: { name: 'US Letter', width: 612.00, height: 792.00 },
    legal: { name: 'US Legal', width: 612.00, height: 1008.00 },
    a3: { name: 'A3', width: 841.89, height: 1190.55 }
};

// Standard Margin Sizes in Points
export const MARGIN_SIZES = {
    none: 0,
    thin: 36,     // 0.5 inches
    normal: 72    // 1.0 inch
};
