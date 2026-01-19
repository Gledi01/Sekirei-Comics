const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdf = null, currentPage = 1, currentVolId = "", renderTask = null;
let carouselIndex = 0, carouselPdfInstance = null;
const TOTAL_BANNER_PAGES = 110;

// --- 1. DATA CONFIGURATION ---
const archiveBaseUrl = "https://archive.org/download/vol13_20260119/";

// Daftar link Archive.org untuk Volume Utama
const archiveLibrary = {
    'vol1': archiveBaseUrl + 'vol1.pdf',
    'vol2': archiveBaseUrl + 'vol2.pdf',
    'vol3-1': archiveBaseUrl + 'vol3-1.pdf',
    'vol3-2': archiveBaseUrl + 'vol3-2.pdf',
    'vol3-3': archiveBaseUrl + 'vol3-3.pdf',
    'vol3-4': archiveBaseUrl + 'vol3-4.pdf',
    'vol3-5': archiveBaseUrl + 'vol3-5.pdf',
    'vol3-6': archiveBaseUrl + 'vol3-6.pdf',
    'vol3-7': archiveBaseUrl + 'vol3-7.pdf',
    'vol3-8': archiveBaseUrl + 'vol3-8.pdf',
    'vol3-9': archiveBaseUrl + 'vol3-9.pdf',
    'vol3-10': archiveBaseUrl + 'vol3-10.pdf',
    'vol3-11': archiveBaseUrl + 'vol3-11.pdf',
    'vol4': archiveBaseUrl + 'vol4.pdf',
    'vol5': archiveBaseUrl + 'vol5.pdf',
    'vol6': archiveBaseUrl + 'vol6.pdf',
    'vol7': archiveBaseUrl + 'vol7.pdf',
    'vol8': archiveBaseUrl + 'vol8.pdf',
    'vol9': archiveBaseUrl + 'vol9.pdf',
    'vol10': archiveBaseUrl + 'vol10.pdf',
    'vol11': 'locked', 
    'vol12': archiveBaseUrl + 'vol12.pdf',
    'vol13': archiveBaseUrl + 'vol13.pdf',
    'vol14': archiveBaseUrl + 'vol14.pdf',
    'vol15': archiveBaseUrl + 'vol15.pdf',
    'vol16': archiveBaseUrl + 'vol16.pdf',
    'vol17': archiveBaseUrl + 'vol17.pdf',
    'vol18': archiveBaseUrl + 'vol18.pdf'
};

// Volume Spesial MENGGUNAKAN JALUR LOKAL /comics/
const specialVolumes = [
    { id: 'extra', title: 'Sekirei: Extra Celebrate', thumb: 'extra.jpg', isLocal: true },
    { id: 'carousel', title: 'Sekirei: Engagement', thumb: 'Engagement cover (0).JPG', isLocal: true }
];

const mainVolumes = [];
for (let i = 1; i <= 18; i++) {
    if (i === 3) continue;
    let ext = (i === 17 || i === 18) ? 'png' : 'jpg';
    mainVolumes.push({ id: `vol${i}`, title: `Sekirei Vol ${i}`, thumb: `vol${i}.${ext}`, isLocal: false });
}

const vol3Chapters = [];
for (let ch = 1; ch <= 11; ch++) {
    vol3Chapters.push({ id: `vol3-${ch}`, title: `Vol 3: Chapter ${ch}`, thumb: `vol3.jpg`, isLocal: false });
}

const allVolumes = [...mainVolumes, ...vol3Chapters, ...specialVolumes];

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
            <div class="vol-card" onclick="openReader('${v.id}', '${v.title}', ${v.isLocal})">
                <img src="thumbnail/${v.thumb}" class="vol-thumbnail" onerror="this.src='https://via.placeholder.com/200x280?text=Error+Load'">
                <div class="vol-info">
                    <strong>${v.title}</strong>
                    <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
                    <small style="color:var(--text-dim)">${prog}% Complete</small>
                </div>
            </div>`;
    };

    const createRow = (title, items) => {
        if (!items.length) return '';
        return `<h3 class="row-title">${title}</h3>
                <div class="volume-row-list">${items.map(v => createCard(v)).join('')}</div>`;
    };

    list.innerHTML += createRow("Main Story: Vol 01 - 05", mainVolumes.slice(0, 4));
    list.innerHTML += createRow("Exclusive: Volume 03 Chapters", vol3Chapters);
    list.innerHTML += createRow("Main Story: Vol 06 - 10", mainVolumes.slice(4, 9));
    list.innerHTML += createRow("Main Story: Vol 11 - 15", mainVolumes.slice(9, 14));
    list.innerHTML += createRow("Final Story: Vol 16 - 18", mainVolumes.slice(14));
    list.innerHTML += createRow("Special Collection", specialVolumes);

    calculateGlobal();
}

// --- 4. READER LOGIC ---
async function openReader(id, title, isLocal) {
    if (id === 'vol11') {
        alert("Akses terbatas, batas waktu 01:01-7:2026");
        return;
    }

    currentVolId = id;
    document.getElementById('reader-title').innerText = title;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    let pdfUrl;
    if (isLocal) {
        // MENGGUNAKAN JALUR /comics/
        if (id === 'extra') {
            pdfUrl = `/comics/Sekirei Extra Celebrate.pdf`;
        } else if (id === 'carousel') {
            pdfUrl = `/comics/carousel.pdf`;
        }
    } else {
        // Dari Archive.org via Proxy
        const rawUrl = archiveLibrary[id];
        pdfUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        currentPdf = await loadingTask.promise;
        currentPage = parseInt(localStorage.getItem(`last_page_${id}`)) || 1;
        renderPage(currentPage);
    } catch (e) { 
        console.error(e);
        alert("Gagal memuat PDF. Pastikan file ada di /comics/ atau Archive.org sedang aktif."); 
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
    canvas.height = viewport.height; canvas.width = viewport.width;
    container.appendChild(canvas);
    renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    
    document.getElementById('page-info').innerText = `${num} / ${currentPdf.numPages}`;
    document.getElementById('page-slider').max = currentPdf.numPages;
    document.getElementById('page-slider').value = num;
    saveProgress(num);
}

// --- 5. CAROUSEL & UTILS ---
async function initCarousel() {
    const track = document.getElementById('carousel-track');
    try {
        // MENGGUNAKAN /comics/slider.pdf
        carouselPdfInstance = await pdfjsLib.getDocument('/comics/slider.pdf').promise;
        for (let i = 1; i <= TOTAL_BANNER_PAGES; i++) {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.id = `banner-slide-${i}`;
            track.appendChild(slide);
        }
        renderCarouselPage(1);
    } catch (e) { 
        console.warn("Carousel gagal dimuat dari /comics/slider.pdf"); 
    }
}

async function renderCarouselPage(num) {
    const slide = document.getElementById(`banner-slide-${num}`);
    if (!slide || slide.querySelector('canvas') || !carouselPdfInstance) return;
    const page = await carouselPdfInstance.getPage(num);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height; canvas.width = viewport.width;
    slide.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
}

function updateCarouselUI() {
    const track = document.getElementById('carousel-track');
    if(track) {
        track.style.transform = `translateX(-${carouselIndex * 100}%)`;
        renderCarouselPage(carouselIndex + 1);
    }
}

function saveProgress(num) {
    const p = Math.round((num / currentPdf.numPages) * 100);
    localStorage.setItem(`prog_${currentVolId}`, p);
    localStorage.setItem(`last_page_${currentVolId}`, num);
}

function closeReader() {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('reader').classList.add('hidden');
    renderDashboard();
}

function calculateGlobal() {
    let t = 0;
    allVolumes.forEach(v => t += parseInt(localStorage.getItem(`prog_${v.id}`)) || 0);
    const statEl = document.getElementById('total-stat');
    if(statEl) statEl.innerText = `Total Progress: ${Math.round(t / allVolumes.length)}%`;
}

function nextPage() { if (currentPage < currentPdf.numPages) renderPage(++currentPage); }
function prevPage() { if (currentPage > 1) renderPage(--currentPage); }
function goToPage(num) { currentPage = parseInt(num); renderPage(currentPage); }

initApp();
  
