const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdf = null, currentPage = 1, currentVolId = "", renderTask = null;
let carouselIndex = 0, carouselPdfInstance = null;
const TOTAL_BANNER_PAGES = 110;

// --- 1. DATA CONFIGURATION ---
const archiveBase = "https://archive.org/download/vol13_20260119/";

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

// --- 3. DASHBOARD RENDERER (TAMPILAN ASLI KAMU) ---
function renderDashboard() {
    const list = document.getElementById('volume-list');
    if (!list) return;
    list.innerHTML = '';

    const createCard = (v) => {
        const prog = localStorage.getItem(`prog_${v.id}`) || 0;
        return `
            <div class="vol-card" onclick="openReader('${v.id}', '${v.title}')">
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

    // Render baris sesuai grup asli kamu
    list.innerHTML += createRow("Main Story: Vol 01 - 05", mainVolumes.slice(0, 4));
    list.innerHTML += createRow("Exclusive: Volume 03 Chapters", vol3Chapters);
    list.innerHTML += createRow("Main Story: Vol 06 - 10", mainVolumes.slice(4, 9));
    list.innerHTML += createRow("Main Story: Vol 11 - 15", mainVolumes.slice(9, 14));
    list.innerHTML += createRow("Final Story: Vol 16 - 18", mainVolumes.slice(14));
    list.innerHTML += createRow("Special Collection", specialVolumes);

    calculateGlobal();
}

// --- 4. READER LOGIC ---
async function openReader(id, title) {
    if (id === 'vol11') {
        alert("Akses terbatas, batas waktu 01:01-7:2026");
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
        let rawUrl = archiveBase + id + ".pdf";
        finalUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(finalUrl);
        currentPdf = await loadingTask.promise;
        currentPage = parseInt(localStorage.getItem(`last_page_${id}`)) || 1;
        renderPage(currentPage);
    } catch (e) { alert("Gagal memuat PDF."); closeReader(); }
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
}

// --- 5. CAROUSEL ---
async function initCarousel() {
    const track = document.getElementById('carousel-track');
    try {
        carouselPdfInstance = await pdfjsLib.getDocument('/comics/slider.pdf').promise;
        for (let i = 1; i <= TOTAL_BANNER_PAGES; i++) {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.id = `banner-slide-${i}`;
            track.appendChild(slide);
        }
        renderCarouselPage(1);
    } catch (e) { console.warn("Slider gagal."); }
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
    document.getElementById('carousel-track').style.transform = `translateX(-${carouselIndex * 100}%)`;
    renderCarouselPage(carouselIndex + 1);
}

// --- UTILS ---
function calculateGlobal() {
    const all = [...mainVolumes, ...vol3Chapters, ...specialVolumes];
    let t = 0;
    all.forEach(v => t += parseInt(localStorage.getItem(`prog_${v.id}`)) || 0);
    const el = document.getElementById('total-stat');
    if(el) el.innerText = `Total Progress: ${Math.round(t / all.length)}%`;
}

function closeReader() {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('reader').classList.add('hidden');
}

function nextPage() { if (currentPage < currentPdf.numPages) renderPage(++currentPage); }
function prevPage() { if (currentPage > 1) renderPage(--currentPage); }
function goToPage(num) { currentPage = parseInt(num); renderPage(currentPage); }

initApp();
                
