const pdfjsLib = window['pdfjs-dist/build/pdf'];
// Menggunakan worker dari CDN yang stabil
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentPdf = null, 
    currentPage = 1, 
    currentVolId = "", 
    renderTask = null,
    isRendering = false;

let carouselIndex = 0, 
    carouselPdfInstance = null;

const TOTAL_BANNER_PAGES = 110;

// --- 1. DATABASE ID GOOGLE DRIVE ---
const driveLibrary = {
    'vol1': '1FwInTG7cVZ7FLm8nHH2jpQWCTuSUiIcG',
    'vol2': '1lXAB9p9NfEffPD51Ip7KM2IeJFeCaGy-',
    'vol3-1': '1UouRvKgGyD38SoPF5fYrAaEsYRXBLibl',
    'vol3-2': '12_m1I78vbccq96UgKBTx_gOWulL9OCH_',
    'vol3-3': '1JUMfYUOsq_NvzvoFhxYm-_H6ShmS-WhB',
    'vol3-4': '1eLybAOBjfI9OU8mMGg_7De-fjuDMH4mF',
    'vol3-5': '1UbSNnABnaElE1zSXjTkJrUxrmuLifeiI',
    'vol3-6': '1fs2HkfqJztCkuKwLnej9GEq_4O-itHif',
    'vol3-7': '1TtLrovGH6-0RLkd6s1cwYNd1K0X_9MMX',
    'vol3-8': '19Xu5h9ORjoe6nCCbtq6Bi_oBu5IS-J_4',
    'vol3-9': '1oHCqMcZs7dg63iQTeuZCQJpR90AoVeGh',
    'vol3-10': '1NCm_jdhBLRLplv8FjUezp2x1a7Vnm1JM',
    'vol3-11': '15QUKultjWNSt-_qt1bILKxKCiGWa6Uft',
    'vol4': '1qhMqK6--yfA2q-KL0Xn5x-4XA5LLo-_N',
    'vol5': '1gQ5ln5Ltlf5AKrPPDIcG7vQEf0DacAkQ',
    'vol6': '1YBnaHr8TBhRbMYWZHweSgQpeERjO-tiO',
    'vol7': '1M2bqZ7zM_5kpu8LCdHoMxpCL9a4j81zT',
    'vol8': '1GAwLRKZKqa1Mf-sKdO3HhBN_yFKT8J_H',
    'vol9': '1jMXb0UlFuvfPCpU2crmByD66HnwgPeZ8',
    'vol10': '1YzwTxQANyzES5u_2pEFG72EfTs1blFwa',
    'vol11': '1X2g2KhO1zLGlQSWyPh26MRnK6dYMLJzC',
    'vol12': '1ylLjRXMUiec0Wpo-ALB9gpu64n6-fN53',
    'vol13': '1SoEIygURfR919uK9ZnYJLpcI_5Enx6Pv',
    'vol14': '1Olpz2-nfp6Ho4axSpBUqMyiGdGHBzbO5',
    'vol15': '1i-gaNSxnq_WW2AogIPUN_TCT5_JIEBrF',
    'vol16': '1hiUWQdWbp_8d0RUBsrGe5lQ-r3yTC3z9',
    'vol17': '1YBfoCf1w__U7w0B9CMIgfSuPEX9u3iHc',
    'vol18': '16Hs9NG7sT2QY5vNG1hrfMKP05K5AIzKr',
    'extra': '1wIfuZhwrAtiBwX7Ii7VB24AtpyeAzi8r',
    'slider': '1MTtUWS4ww071Fj6KGJxPrOd70t6N0kWB',
    'carousel': '1wptCjxzDY1uUJoPrlBbv1WaMQSzpUIXk'
};

// --- 2. HELPER: GET PROXIED URL ---
function getProxiedUrl(id) {
    const fileId = driveLibrary[id];
    if (!fileId) return null;
    const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
    // Menggunakan AllOrigins Proxy untuk menembus CORS
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(directLink)}`;
}

// --- 3. DASHBOARD CONFIGURATION ---
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

const allVolumes = [...mainVolumes, ...vol3Chapters, ...specialVolumes];

// --- 4. INITIALIZE APP ---
async function initApp() {
    renderDashboard();
    await initCarousel();
    setInterval(() => {
        carouselIndex = (carouselIndex + 1) % TOTAL_BANNER_PAGES;
        updateCarouselUI();
    }, 4000);
}

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
                    <small style="color:var(--text-dim)">${prog}% Selesai</small>
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

// --- 5. READER LOGIC ---
async function openReader(id, title) {
    currentVolId = id;
    const proxiedUrl = getProxiedUrl(id);
    if (!proxiedUrl) return;

    document.getElementById('reader-title').innerText = title;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    try {
        const loadingTask = pdfjsLib.getDocument(proxiedUrl);
        currentPdf = await loadingTask.promise;
        currentPage = parseInt(localStorage.getItem(`last_page_${id}`)) || 1;
        renderPage(currentPage);
    } catch (e) { 
        console.error("Gagal memuat PDF:", e);
        alert("Gagal memuat PDF dari Drive. Pastikan folder sudah di-set 'Anyone with link' dan file tidak terlalu besar (>100MB)."); 
        closeReader(); 
    }
}

async function renderPage(num) {
    if (renderTask) renderTask.cancel();
    if (isRendering) return;
    isRendering = true;

    try {
        const page = await currentPdf.getPage(num);
        const viewport = page.getViewport({ scale: window.innerWidth < 768 ? 0.9 : 1.5 });
        const container = document.getElementById('pdf-render-area');
        container.innerHTML = '';
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height; 
        canvas.width = viewport.width;
        container.appendChild(canvas);
        
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;

        document.getElementById('page-info').innerText = `${num} / ${currentPdf.numPages}`;
        document.getElementById('page-slider').max = currentPdf.numPages;
        document.getElementById('page-slider').value = num;
        saveProgress(num);
    } catch (err) {
        console.error("Render error:", err);
    } finally {
        isRendering = false;
    }
}

// --- 6. CAROUSEL ---
async function initCarousel() {
    const track = document.getElementById('carousel-track');
    const proxiedUrl = getProxiedUrl('slider');
    if(!proxiedUrl || !track) return;

    try {
        carouselPdfInstance = await pdfjsLib.getDocument(proxiedUrl).promise;
        for (let i = 1; i <= TOTAL_BANNER_PAGES; i++) {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.id = `banner-slide-${i}`;
            track.appendChild(slide);
        }
        renderCarouselPage(1);
    } catch (e) { console.warn("Carousel failed."); }
}

async function renderCarouselPage(num) {
    const slide = document.getElementById(`banner-slide-${num}`);
    if (!slide || slide.querySelector('canvas') || !carouselPdfInstance) return;
    
    try {
        const page = await carouselPdfInstance.getPage(num);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height; canvas.width = viewport.width;
        slide.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    } catch(e) {}
}

function updateCarouselUI() {
    const track = document.getElementById('carousel-track');
    if(track) {
        track.style.transform = `translateX(-${carouselIndex * 100}%)`;
        renderCarouselPage(carouselIndex + 1);
    }
}

// --- 7. UTILS ---
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
  
