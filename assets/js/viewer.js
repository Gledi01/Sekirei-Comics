const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdf = null, currentPage = 1, currentVolId = "", renderTask = null;
let carouselIndex = 0, carouselPdfInstance = null;
const TOTAL_BANNER_PAGES = 110;

// ===== LOCK ADDITION =====
const SERVER_OPEN = false;

// --- 1. DATA CONFIGURATION (MANUAL URL) ---
const archiveLibrary = {
    'vol1': 'https://archive.org/download/vol13_20260119/vol1.pdf',
    'vol2': 'https://archive.org/download/vol13_20260119/vol2.pdf',
    'vol3-1': 'https://archive.org/download/vol13_20260119/vol3-1.pdf',
    'vol3-2': 'https://archive.org/download/vol13_20260119/vol3-2.pdf',
    'vol3-3': 'https://archive.org/download/vol13_20260119/vol3-3.pdf',
    'vol3-4': 'https://archive.org/download/vol13_20260119/vol3-4.pdf',
    'vol3-5': 'https://archive.org/download/vol13_20260119/vol3-5.pdf',
    'vol3-6': 'https://archive.org/download/vol13_20260119/vol3-6.pdf',
    'vol3-7': 'https://archive.org/download/vol13_20260119/vol3-7.pdf',
    'vol3-8': 'https://archive.org/download/vol13_20260119/vol3-8.pdf',
    'vol3-9': 'https://archive.org/download/vol13_20260119/vol3-9.pdf',
    'vol3-10': 'https://archive.org/download/vol13_20260119/vol3-10.pdf',
    'vol3-11': 'https://archive.org/download/vol13_20260119/vol3-11.pdf',
    'vol4': 'https://archive.org/download/vol13_20260119/vol4.pdf',
    'vol5': 'https://archive.org/download/vol13_20260119/vol5.pdf',
    'vol6': 'https://archive.org/download/vol13_20260119/vol6.pdf',
    'vol7': 'https://archive.org/download/vol13_20260119/vol7.pdf',
    'vol8': 'https://archive.org/download/vol13_20260119/vol8.pdf',
    'vol9': 'https://archive.org/download/vol13_20260119/vol9.pdf',
    'vol10': 'https://archive.org/download/vol13_20260119/vol10.pdf',
    'vol11': 'https://archive.org/download/vol13_20260119/vol11.pdf',
    'vol12': 'https://archive.org/download/vol13_20260119/vol12.pdf',
    'vol13': 'https://archive.org/download/vol13_20260119/vol13.pdf',
    'vol14': 'https://archive.org/download/vol13_20260119/vol14.pdf',
    'vol15': 'https://archive.org/download/vol13_20260119/vol15.pdf',
    'vol16': 'https://archive.org/download/vol13_20260119/vol16.pdf',
    'vol17': 'https://archive.org/download/vol13_20260119/vol17.pdf',
    'vol18': 'https://archive.org/download/vol13_20260119/vol18.pdf'
};

const specialVolumes = [
    { id: 'extra', title: 'Sekirei: Extra Celebrate', thumb: 'extra.jpg' },
    { id: 'carousel', title: 'Sekirei: Engagement', thumb: 'Engagement cover (0).JPG' }
];

const mainVolumes = [];
for (let i = 1; i <= 18; i++) {
    if (i === 3) continue;
    let ext = (i === 17 || i === 18) ? 'png' : 'jpg';
    mainVolumes.push({ id: `vol${i}`, title: `Sekirei Vol ${i}`, thumb: `vol${i}.${ext}` });
}

const vol3Chapters = [];
for (let ch = 1; ch <= 11; ch++) {
    vol3Chapters.push({ id: `vol3-${ch}`, title: `Vol 3: Chapter ${ch}`, thumb: `vol3.jpg` });
}

// --- 2. INITIALIZE ---
async function initApp() {
    renderDashboard();
    await initCarousel();
    setInterval(() => {
        carouselIndex = (carouselIndex + 1) % TOTAL_BANNER_PAGES;
        updateCarouselUI();
    }, 4000);
}

// --- 3. DASHBOARD RENDERER ---
function renderDashboard() {
    const list = document.getElementById('volume-list');
    if (!list) return;
    list.innerHTML = '';

    const createCard = (v) => {
        const prog = localStorage.getItem(`prog_${v.id}`) || 0;
        return `
            <div class="vol-card" onclick="openReader('${v.id}', '${v.title}')">
                <img src="thumbnail/${v.thumb}" class="vol-thumbnail">
                <div class="vol-info">
                    <strong>${v.title}</strong>
                    <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
                    <small>${prog}% Complete</small>
                </div>
            </div>`;
    };

    const createRow = (title, items) =>
        `<h3 class="row-title">${title}</h3>
         <div class="volume-row-list">${items.map(v => createCard(v)).join('')}</div>`;

    list.innerHTML += createRow("Main Story: Vol 01 - 05", mainVolumes.slice(0, 4));
    list.innerHTML += createRow("Exclusive: Volume 03 Chapters", vol3Chapters);
    list.innerHTML += createRow("Main Story: Vol 06 - 10", mainVolumes.slice(4, 9));
    list.innerHTML += createRow("Main Story: Vol 11 - 15", mainVolumes.slice(9, 14));
    list.innerHTML += createRow("Final Story: Vol 16 - 18", mainVolumes.slice(14));
    list.innerHTML += createRow("Special Collection", specialVolumes);

    calculateGlobal();
}

// ===== LOCK ADDITION =====
function showLockPopup() {
    document.getElementById('lock-popup').classList.remove('hidden');
}
function closeLockPopup() {
    document.getElementById('lock-popup').classList.add('hidden');
}

// --- 4. READER LOGIC ---
async function openReader(id, title) {

    // ===== LOCK ADDITION =====
    const isSpecial = id === 'extra' || id === 'carousel';
    if (!SERVER_OPEN && !isSpecial) {
        showLockPopup();
        return;
    }

    currentVolId = id;
    document.getElementById('reader-title').innerText = title;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    let finalUrl;
    if (id === 'extra') {
        finalUrl = '/comics/Sekirei Extra Celebrate.pdf';
    } else if (id === 'carousel') {
        finalUrl = '/comics/carousel.pdf';
    } else {
        const rawUrl = archiveLibrary[id];
        finalUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(finalUrl);
        currentPdf = await loadingTask.promise;
        currentPage = parseInt(localStorage.getItem(`last_page_${id}`)) || 1;
        renderPage(currentPage);
    } catch (e) {
        showLockPopup();
        closeReader();
    }
}

async function renderPage(num) {
    if (renderTask) renderTask.cancel();
    const page = await currentPdf.getPage(num);
    const viewport = page.getViewport({ scale: window.innerWidth < 768 ? 0.8 : 1.5 });
    const container = document.getElementById('pdf-render-area');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    container.appendChild(canvas);
    renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    document.getElementById('page-info').innerText = `${num} / ${currentPdf.numPages}`;
}

// --- 5. CAROUSEL ---
async function initCarousel() {
    const track = document.getElementById('carousel-track');
    carouselPdfInstance = await pdfjsLib.getDocument('/comics/slider.pdf').promise;
    for (let i = 1; i <= TOTAL_BANNER_PAGES; i++) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.id = `banner-slide-${i}`;
        track.appendChild(slide);
    }
    renderCarouselPage(1);
}

async function renderCarouselPage(num) {
    const slide = document.getElementById(`banner-slide-${num}`);
    if (!slide || slide.querySelector('canvas')) return;
    const page = await carouselPdfInstance.getPage(num);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    slide.appendChild(canvas);
    page.render({ canvasContext: canvas.getContext('2d'), viewport });
}

function updateCarouselUI() {
    const track = document.getElementById('carousel-track');
    track.style.transform = `translateX(-${carouselIndex * 100}%)`;
    renderCarouselPage(carouselIndex + 1);
}

// --- UTILS ---
function calculateGlobal() {
    const all = [...mainVolumes, ...vol3Chapters, ...specialVolumes];
    let t = 0;
    all.forEach(v => t += parseInt(localStorage.getItem(`prog_${v.id}`)) || 0);
    document.getElementById('total-stat').innerText =
        `Total Progress: ${Math.round(t / all.length)}%`;
}

function closeReader() {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('reader').classList.add('hidden');
    renderDashboard();
}

function nextPage() { if (currentPage < currentPdf.numPages) renderPage(++currentPage); }
function prevPage() { if (currentPage > 1) renderPage(--currentPage); }
function goToPage(num) { currentPage = parseInt(num); renderPage(currentPage); }

initApp();
