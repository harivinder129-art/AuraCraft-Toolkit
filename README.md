# 📄 PicToPDF — Premium Client-Side Image & PDF Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero-Server](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green.svg)](#privacy--security)
[![No Build Step](https://img.shields.io/badge/Build-Vanilla%20JS%20%2F%20No%20Dependencies-orange.svg)](#getting-started)
[![GitHub Pages Ready](https://img.shields.io/badge/Hosting-GitHub%20Pages%20Ready-brightgreen.svg)](#deploy-to-github-pages)

**PicToPDF** is a modern, high-performance web application to convert, edit, and organize images and documents into beautiful PDFs. Everything processes 100% locally in your browser sandbox with zero server uploads, keeping your documents completely private and secure.

---

## ✨ Features

- 📑 **Exact Original Dimensions or Paper Standards**:
  - Export PDFs preserving exact pixel-for-pixel image aspect ratios and dimensions.
  - Or choose standard page formats: **A4**, **US Letter**, **US Legal**, and **A3**.
- 📐 **Perspective Crop (CamScanner / Office Lens Style)**:
  - Drag 4 independent corner handles over tilted or angled document photos.
  - Custom mathematical homography & perspective warp engine flattens documents into a crisp, flat rectangle.
- ✂️ **Standard Crop & Rotation**:
  - 4-corner multi-handle crop tool with aspect ratio presets (Freeform, 1:1, 4:3, 16:9).
  - 90° clockwise and counter-clockwise rotation.
- 🎨 **Image Tuning & Filters**:
  - Fine-tune Brightness, Contrast, Grayscale, and Sepia before exporting.
  - Real-time live canvas layout preview.
- 📦 **Flexible Export Options**:
  - **Single PDF (Multi-page)**: Combine multiple images/PDF pages into one cohesive document.
  - **Separate PDFs (Batch)**: Download individual PDF files for each page.
  - **Direct Image Download**: Save individual edited images.
- 📱 **Mobile & Touch Friendly**:
  - Full touch-event support with touch-action isolation and translucent crosshair handles designed for precision on smartphones and tablets.
- 🔒 **100% Private & Offline Capable**:
  - Built with pure HTML5, CSS3, and vanilla JavaScript.
  - Offline-ready with bundled local libraries (jsPDF, PDF.js, Lucide Icons, heic-to).
  - No backend server required; runs anywhere, even without internet.

---

## 📂 Supported Formats

- **Images**: JPEG, PNG, WebP, SVG, GIF, HEIC/HEIF (iPhone photos)
- **Documents**: PDF (merge and re-order existing PDF pages)

---

## 🚀 Getting Started

No build tools, `npm install`, or compilation steps required!

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/PicToPDF.git
cd PicToPDF
```

### 2. Run locally
Simply double-click `index.html` to open it in any modern web browser (Chrome, Edge, Firefox, Safari).

Alternatively, serve with any local HTTP server:
```bash
# Python 3
python -m http.server 8080

# Or Node.js npx
npx serve
```
Then visit `http://localhost:8080` in your browser.

---

## 🌐 Deploy to GitHub Pages (Free Instant Hosting)

You can host PicToPDF for free on GitHub Pages in under a minute:

1. Push this repository to GitHub.
2. In your GitHub repo, go to **Settings** > **Pages** (under Code and automation).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`
   - **Branch**: Select `main`, folder `/ (root)`
4. Click **Save**. Within 1–2 minutes, your web app will be live at:
   `https://<your-username>.github.io/PicToPDF/`

---

## 🛡️ Privacy & Security

Unlike traditional online conversion utilities that upload your sensitive documents to remote third-party servers, **PicToPDF processes all files entirely on your device (client-side)** using the HTML5 Canvas API and WebAssembly/JS workers. No data ever leaves your computer.

---

## 📜 License

This project is licensed under the MIT License - feel free to use and modify for personal or commercial projects.
# AuraCraft-Toolkit
