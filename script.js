// Initialize Lucide Icons
lucide.createIcons();

// =============================================
// IndexedDB — Armazenamento de Vídeos
// =============================================
const DB_NAME = 'carbonell_tips_db';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        if (db) { resolve(db); return; }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(VIDEO_STORE)) {
                database.createObjectStore(VIDEO_STORE, { keyPath: 'tipId' });
            }
        };
        req.onsuccess = (e) => { db = e.target.result; resolve(db); };
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveVideoBlob(tipId, blob) {
    return initDB().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(VIDEO_STORE, 'readwrite');
        tx.objectStore(VIDEO_STORE).put({ tipId, blob });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    }));
}

function getVideoBlob(tipId) {
    return initDB().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(VIDEO_STORE, 'readonly');
        const req = tx.objectStore(VIDEO_STORE).get(tipId);
        req.onsuccess = (e) => resolve(e.target.result ? e.target.result.blob : null);
        req.onerror = (e) => reject(e.target.error);
    }));
}

function deleteVideoBlob(tipId) {
    return initDB().then(database => new Promise((resolve) => {
        const tx = database.transaction(VIDEO_STORE, 'readwrite');
        tx.objectStore(VIDEO_STORE).delete(tipId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve(); // silencioso
    }));
}

// =============================================
// Estado Global
// =============================================
let tips = JSON.parse(localStorage.getItem('carbonell_tips')) || [];
let activeCategory = 'Todos';
let searchQuery = '';

// Estado da mídia selecionada no formulário
let selectedThumbData = '';    // base64 da thumbnail
let currentThumbTab = 'upload';
let selectedVideoFile = null;  // File object do vídeo selecionado
let currentVideoTab = 'upload';

// Cache de Object URLs para vídeos (evita re-criar a cada render)
const videoBlobUrls = {};

// Categorias principais
const CATEGORIES = [
    "Novidades",
    "Inteligência Artificial",
    "Ferramentas Google",
    "Windows"
];

// Imagem padrão para cards sem thumbnail
const DEFAULT_THUMB = 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=400';

// =============================================
// Admin Auth
// =============================================
const ADMIN_PASSWORD = 'carbonell2026';

function isAdminLoggedIn() {
    return sessionStorage.getItem('admin_auth') === 'true';
}

function renderAdminNav() {
    const container = document.getElementById('adminNavActions');
    if (!container) return;
    if (isAdminLoggedIn()) {
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="openAdminModal()" style="padding: 8px 16px; font-size: 0.9rem;">
                <i data-lucide="plus" style="width: 18px; height: 18px;"></i> Nova Dica
            </button>
            <button class="btn btn-secondary" onclick="adminLogout()" style="padding: 8px 14px; font-size: 0.85rem; opacity: 0.75;" title="Sair do modo admin">
                <i data-lucide="log-out" style="width: 16px; height: 16px;"></i> Sair
            </button>
        `;
    } else {
        container.innerHTML = `
            <button class="icon-btn" onclick="openAdminLoginModal()" title="Admin" style="opacity: 0.35;" aria-label="Acesso admin">
                <i data-lucide="lock" style="width: 18px; height: 18px;"></i>
            </button>
        `;
    }
    lucide.createIcons();
}

function openAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminLoginError').style.display = 'none';
        document.getElementById('adminPassword').onkeydown = (e) => {
            if (e.key === 'Enter') tryAdminLogin();
        };
    }
}

function closeAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function tryAdminLogin() {
    const inputPwd = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');
    if (inputPwd === ADMIN_PASSWORD) {
        sessionStorage.setItem('admin_auth', 'true');
        closeAdminLoginModal();
        renderAdminNav();
        renderSwimlanes();
    } else {
        errorEl.style.display = 'block';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
}

function adminLogout() {
    sessionStorage.removeItem('admin_auth');
    renderAdminNav();
    renderSwimlanes();
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// =============================================
// Hero Dinâmico (Última dica postada)
// =============================================
function updateHero() {
    if (tips.length === 0) return;
    const latest = tips[0];
    const heroSection = document.getElementById('heroSection');
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    const heroBtn = document.getElementById('heroBtn');

    if (heroTitle) heroTitle.textContent = latest.title;
    if (heroDesc) {
        heroDesc.textContent = latest.description
            ? latest.description
            : 'Clique em "Assistir Agora" para ver a dica mais recente.';
    }
    if (heroSection && latest.image) {
        heroSection.style.backgroundImage = `url('${latest.image}')`;
    }
    if (heroBtn) heroBtn.style.display = '';
}

function openHeroTip() {
    if (tips.length === 0) return;
    openModal(tips[0].id);
}

// =============================================
// Render Swimlanes
// =============================================
function renderSwimlanes() {
    const wrapper = document.getElementById('swimlanes-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const isAdmin = isAdminLoggedIn();

    let filteredTips = tips;
    if (searchQuery.trim() !== '') {
        filteredTips = filteredTips.filter(tip =>
            tip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tip.description && tip.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    // Agrupa por categoria
    const groupedTips = {};
    CATEGORIES.forEach(cat => groupedTips[cat] = []);
    filteredTips.forEach(tip => {
        const cats = Array.isArray(tip.categories) ? tip.categories : (tip.category ? [tip.category] : []);
        cats.forEach(cat => {
            if (groupedTips[cat]) groupedTips[cat].push(tip);
        });
    });

    const categoriesToRender = activeCategory === 'Todos' ? CATEGORIES : [activeCategory];
    let hasAnyCards = false;

    categoriesToRender.forEach(cat => {
        const catTips = groupedTips[cat];
        if (catTips && catTips.length > 0) {
            hasAnyCards = true;
            const cardsHTML = catTips.map(tip => {
                const thumb = tip.image || DEFAULT_THUMB;
                return `
                <div class="card" onclick="openModal('${tip.id}')">
                    <img src="${thumb}" alt="Thumbnail" class="card-image" onerror="this.src='${DEFAULT_THUMB}'">
                    <div class="card-overlay">
                        <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
                        <h3 class="card-title">${tip.title}</h3>
                        <p class="card-duration">${tip.duration}</p>
                    </div>
                    ${isAdmin ? `<button class="delete-btn" onclick="deleteTip(event,'${tip.id}')" title="Remover"><i data-lucide="trash-2"></i></button>` : ''}
                </div>`;
            }).join('');

            wrapper.innerHTML += `
                <section class="swimlane">
                    <h2 class="swimlane-title">${cat}</h2>
                    <div class="carousel-container">
                        <button class="carousel-btn prev-btn" onclick="scrollTrack(this,-500)"><i data-lucide="chevron-left"></i></button>
                        <div class="carousel-track">${cardsHTML}</div>
                        <button class="carousel-btn next-btn" onclick="scrollTrack(this,500)"><i data-lucide="chevron-right"></i></button>
                    </div>
                </section>`;
        }
    });

    if (!hasAnyCards) {
        wrapper.innerHTML = `
            <div style="padding:60px 4%;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <i data-lucide="film" style="width:64px;height:64px;opacity:0.3;margin-bottom:20px;"></i>
                <h3 style="font-size:1.5rem;margin-bottom:8px;">Nenhuma dica encontrada</h3>
                <p>Nenhum conteúdo cadastrado${activeCategory !== 'Todos' ? ' em "' + activeCategory + '"' : ''}.${isAdmin ? ' Clique em "Nova Dica" para adicionar!' : ''}</p>
            </div>`;
    }

    lucide.createIcons();
    updateHero();
}

function scrollTrack(btn, amount) {
    const track = btn.parentElement.querySelector('.carousel-track');
    track.scrollBy({ left: amount, behavior: 'smooth' });
}

// =============================================
// Filters
// =============================================
document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.getAttribute('data-category');
        renderSwimlanes();
    });
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderSwimlanes();
    });
}

// =============================================
// Admin Modal
// =============================================
const adminModal = document.getElementById('adminModal');

function openAdminModal() {
    if (!isAdminLoggedIn()) return;
    resetForm();
    adminModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAdminModal() {
    adminModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(resetForm, 350);
}

function resetForm() {
    try {
        const form = document.getElementById('addTipForm');
        if (form) form.reset();

        selectedThumbData = '';
        selectedVideoFile = null;
        currentThumbTab = 'upload';
        currentVideoTab = 'upload';

        const els = {
            tUp: 'thumbUploadPanel', tUrl: 'thumbUrlPanel',
            tPrev: 'thumbPreviewWrap', tPrevImg: 'thumbPreviewImg',
            tTabUp: 'tabThumbUpload', tTabUrl: 'tabThumbUrl',
            fUpText: 'fileUploadText',
            vUp: 'videoUploadPanel', vUrl: 'videoUrlPanel',
            vPrev: 'videoPreviewWrap', vPrevEl: 'videoPreviewEl',
            vTabUp: 'tabVideoUpload', vTabUrl: 'tabVideoUrl',
            vUpText: 'videoUploadText',
            tipImageFile: 'tipImageFile', tipVideoFile: 'tipVideoFile',
            tipImageUrl: 'tipImageUrl', tipVideoUrl: 'tipVideoUrl',
            catErr: 'categoryError'
        };
        const e = {};
        Object.keys(els).forEach(k => e[k] = document.getElementById(els[k]));

        if (e.tUp) e.tUp.style.display = '';
        if (e.tUrl) e.tUrl.style.display = 'none';
        if (e.tPrev) e.tPrev.style.display = 'none';
        if (e.tPrevImg) e.tPrevImg.src = '';
        if (e.tTabUp) e.tTabUp.classList.add('active');
        if (e.tTabUrl) e.tTabUrl.classList.remove('active');
        if (e.fUpText) e.fUpText.textContent = 'Clique para selecionar uma imagem';

        if (e.vUp) e.vUp.style.display = '';
        if (e.vUrl) e.vUrl.style.display = 'none';
        if (e.vPrev) e.vPrev.style.display = 'none';
        if (e.vPrevEl) { e.vPrevEl.src = ''; e.vPrevEl.removeAttribute('src'); }
        if (e.vTabUp) e.vTabUp.classList.add('active');
        if (e.vTabUrl) e.vTabUrl.classList.remove('active');
        if (e.vUpText) e.vUpText.textContent = 'Clique para selecionar um vídeo';

        if (e.tipImageFile) e.tipImageFile.value = '';
        if (e.tipVideoFile) e.tipVideoFile.value = '';
        if (e.tipImageUrl) e.tipImageUrl.value = '';
        if (e.tipVideoUrl) e.tipVideoUrl.value = '';
        if (e.catErr) e.catErr.style.display = 'none';

        document.querySelectorAll('.category-checkboxes input[type=checkbox]').forEach(cb => cb.checked = false);
    } catch (err) {
        console.warn('resetForm (non-critical):', err);
    }
}

// ---- Thumbnail ----
function switchThumbTab(tab) {
    currentThumbTab = tab;
    const up = document.getElementById('thumbUploadPanel');
    const ur = document.getElementById('thumbUrlPanel');
    const tUp = document.getElementById('tabThumbUpload');
    const tUrl = document.getElementById('tabThumbUrl');
    if (up) up.style.display = tab === 'upload' ? '' : 'none';
    if (ur) ur.style.display = tab === 'url' ? '' : 'none';
    if (tUp) tUp.classList.toggle('active', tab === 'upload');
    if (tUrl) tUrl.classList.toggle('active', tab === 'url');
    selectedThumbData = '';
    const prev = document.getElementById('thumbPreviewWrap');
    const fi = document.getElementById('tipImageFile');
    const ui = document.getElementById('tipImageUrl');
    const ft = document.getElementById('fileUploadText');
    if (prev) prev.style.display = 'none';
    if (fi) fi.value = '';
    if (ui) ui.value = '';
    if (ft) ft.textContent = 'Clique para selecionar uma imagem';
}

function onThumbFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedThumbData = e.target.result;
        const img = document.getElementById('thumbPreviewImg');
        const wrap = document.getElementById('thumbPreviewWrap');
        const text = document.getElementById('fileUploadText');
        if (img) img.src = selectedThumbData;
        if (wrap) wrap.style.display = '';
        if (text) text.textContent = file.name;
    };
    reader.readAsDataURL(file);
}

function clearThumb() {
    selectedThumbData = '';
    const wrap = document.getElementById('thumbPreviewWrap');
    const img = document.getElementById('thumbPreviewImg');
    const fi = document.getElementById('tipImageFile');
    const ui = document.getElementById('tipImageUrl');
    const ft = document.getElementById('fileUploadText');
    if (wrap) wrap.style.display = 'none';
    if (img) img.src = '';
    if (fi) fi.value = '';
    if (ui) ui.value = '';
    if (ft) ft.textContent = 'Clique para selecionar uma imagem';
}

// ---- Vídeo (usa File object em memória, Blob no IndexedDB) ----
function switchVideoTab(tab) {
    currentVideoTab = tab;
    const up = document.getElementById('videoUploadPanel');
    const ur = document.getElementById('videoUrlPanel');
    const tUp = document.getElementById('tabVideoUpload');
    const tUrl = document.getElementById('tabVideoUrl');
    if (up) up.style.display = tab === 'upload' ? '' : 'none';
    if (ur) ur.style.display = tab === 'url' ? '' : 'none';
    if (tUp) tUp.classList.toggle('active', tab === 'upload');
    if (tUrl) tUrl.classList.toggle('active', tab === 'url');
    selectedVideoFile = null;
    const prev = document.getElementById('videoPreviewWrap');
    const el = document.getElementById('videoPreviewEl');
    const fv = document.getElementById('tipVideoFile');
    const uv = document.getElementById('tipVideoUrl');
    const vt = document.getElementById('videoUploadText');
    if (prev) prev.style.display = 'none';
    if (el) { el.src = ''; el.removeAttribute('src'); }
    if (fv) fv.value = '';
    if (uv) uv.value = '';
    if (vt) vt.textContent = 'Clique para selecionar um vídeo';
}

function onVideoFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Guarda o File object diretamente (sem converter para base64)
    selectedVideoFile = file;

    // Preview instantâneo usando Object URL
    const previewUrl = URL.createObjectURL(file);
    const el = document.getElementById('videoPreviewEl');
    const prev = document.getElementById('videoPreviewWrap');
    const vt = document.getElementById('videoUploadText');

    if (el) el.src = previewUrl;
    if (prev) prev.style.display = '';
    if (vt) vt.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
}

function clearVideo() {
    selectedVideoFile = null;
    const prev = document.getElementById('videoPreviewWrap');
    const el = document.getElementById('videoPreviewEl');
    const fv = document.getElementById('tipVideoFile');
    const uv = document.getElementById('tipVideoUrl');
    const vt = document.getElementById('videoUploadText');
    if (prev) prev.style.display = 'none';
    if (el) { el.src = ''; el.removeAttribute('src'); }
    if (fv) fv.value = '';
    if (uv) uv.value = '';
    if (vt) vt.textContent = 'Clique para selecionar um vídeo';
}

// ---- Salvar Dica ----
async function saveTip() {
    if (!isAdminLoggedIn()) return;

    const titleEl = document.getElementById('tipTitle');
    const durationEl = document.getElementById('tipDuration');
    const descEl = document.getElementById('tipDesc');

    if (!titleEl || !titleEl.value.trim() || !durationEl || !durationEl.value.trim()) {
        alert('Por favor, preencha o título e a duração.');
        return;
    }

    // Categorias
    const selectedCats = [];
    document.querySelectorAll('.category-checkboxes input[type=checkbox]:checked').forEach(cb => {
        selectedCats.push(cb.value);
    });
    if (selectedCats.length === 0) {
        const catErr = document.getElementById('categoryError');
        if (catErr) catErr.style.display = 'block';
        return;
    }
    const catErr = document.getElementById('categoryError');
    if (catErr) catErr.style.display = 'none';

    // Thumbnail (base64 é OK para imagens — geralmente < 500KB)
    let image = '';
    if (currentThumbTab === 'upload') {
        image = selectedThumbData || '';
    } else {
        image = (document.getElementById('tipImageUrl')?.value || '').trim();
    }

    // Gera ID da dica
    const tipId = generateId();

    // Resolve vídeo
    let video = '';
    let videoType = '';

    if (currentVideoTab === 'upload') {
        if (selectedVideoFile) {
            // Salva Blob no IndexedDB (sem limite de 5MB)
            const saveBtn = document.querySelector('#adminModal .btn-primary');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }

            try {
                await saveVideoBlob(tipId, selectedVideoFile);
                video = tipId;       // referência ao IndexedDB
                videoType = 'indexed';
            } catch (err) {
                alert('Erro ao salvar o vídeo. Tente usar a opção de URL.');
                const saveBtn2 = document.querySelector('#adminModal .btn-primary');
                if (saveBtn2) { saveBtn2.disabled = false; saveBtn2.innerHTML = '<i data-lucide="save"></i> Salvar Dica'; lucide.createIcons(); }
                return;
            }
        }
        // Se não houver arquivo selecionado: videoType e video ficam vazios
    } else {
        const rawUrl = (document.getElementById('tipVideoUrl')?.value || '').trim();
        if (rawUrl) {
            video = convertYouTubeUrl(rawUrl);
            videoType = video.includes('youtube.com/embed') ? 'youtube' : 'url';
        }
    }

    const newTip = {
        id: tipId,
        title: titleEl.value.trim(),
        categories: selectedCats,
        duration: durationEl.value.trim(),
        description: descEl ? descEl.value.trim() : '',
        image,
        video,
        videoType,
        createdAt: new Date().toISOString()
    };

    // Metadados salvos no localStorage (sem o blob do vídeo)
    tips.unshift(newTip);
    try {
        localStorage.setItem('carbonell_tips', JSON.stringify(tips));
    } catch (e) {
        tips.shift();
        // Se localStorage cheio, tenta limpar thumbnails base64 antigas
        alert('Armazenamento de metadados cheio. Tente remover algumas dicas antigas.');
        if (newTip.videoType === 'indexed') deleteVideoBlob(tipId);
        return;
    }

    closeAdminModal();

    activeCategory = 'Todos';
    document.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.remove('active');
        if (p.getAttribute('data-category') === 'Todos') p.classList.add('active');
    });

    setTimeout(() => {
        renderSwimlanes();
        const wrapper = document.getElementById('swimlanes-wrapper');
        if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('✅ Dica salva com sucesso!');
    }, 320);
}

// Converte URL do YouTube para embed
function convertYouTubeUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
            return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
        }
        if (u.hostname.includes('youtu.be')) {
            return `https://www.youtube.com/embed${u.pathname}`;
        }
    } catch (_) { }
    return url;
}

// Toast de feedback visual
function showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('toast-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast-visible'), 3000);
}

// =============================================
// Deletar Dica
// =============================================
function deleteTip(event, id) {
    if (!isAdminLoggedIn()) return;
    event.stopPropagation();
    if (confirm('Tem certeza que deseja remover esta dica?')) {
        const tip = tips.find(t => t.id === id);
        // Remove blob do IndexedDB se for vídeo local
        if (tip && tip.videoType === 'indexed') {
            deleteVideoBlob(id);
        }
        // Revoga Object URL em cache se existir
        if (videoBlobUrls[id]) {
            URL.revokeObjectURL(videoBlobUrls[id]);
            delete videoBlobUrls[id];
        }
        tips = tips.filter(t => t.id !== id);
        localStorage.setItem('carbonell_tips', JSON.stringify(tips));
        renderSwimlanes();
    }
}

// =============================================
// Modal de Visualização
// =============================================
const videoModal = document.getElementById('videoModal');

async function openModal(tipId) {
    const tip = tips.find(t => t.id === tipId);
    if (!tip) return;

    document.getElementById('modalTitle').textContent = tip.title;

    const descEl = document.getElementById('modalDesc');
    if (tip.description) {
        descEl.textContent = tip.description;
        descEl.style.display = '';
    } else {
        descEl.style.display = 'none';
    }

    const body = document.getElementById('modalBody');
    body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:0.9rem;opacity:0.7;">Carregando...</div>';

    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (tip.video) {
        if (tip.videoType === 'youtube') {
            body.innerHTML = `
                <iframe src="${tip.video}?autoplay=1"
                    style="width:100%;height:100%;border:none;"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>`;
        } else if (tip.videoType === 'indexed') {
            // Busca o Blob do IndexedDB
            try {
                let blobUrl = videoBlobUrls[tipId];
                if (!blobUrl) {
                    const blob = await getVideoBlob(tipId);
                    if (blob) {
                        blobUrl = URL.createObjectURL(blob);
                        videoBlobUrls[tipId] = blobUrl; // cache
                    }
                }
                if (blobUrl) {
                    body.innerHTML = `
                        <video controls autoplay style="width:100%;height:100%;background:#000;">
                            <source src="${blobUrl}">
                            Seu navegador não suporta vídeo HTML5.
                        </video>`;
                } else {
                    body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;">Vídeo não encontrado no armazenamento local.</div>`;
                }
            } catch (err) {
                body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;">Erro ao carregar o vídeo.</div>`;
            }
        } else {
            // URL direta
            body.innerHTML = `
                <video controls autoplay style="width:100%;height:100%;background:#000;">
                    <source src="${tip.video}" type="video/mp4">
                    <source src="${tip.video}" type="video/webm">
                    Seu navegador não suporta vídeo HTML5.
                </video>`;
        }
    } else {
        // Sem vídeo: mostra thumbnail
        const imgSrc = tip.image || DEFAULT_THUMB;
        body.innerHTML = `
            <div class="video-placeholder">
                <img src="${imgSrc}" alt="${tip.title}" onerror="this.src='${DEFAULT_THUMB}'">
                <div class="fake-play-btn"><i data-lucide="play" fill="currentColor"></i></div>
            </div>`;
        lucide.createIcons();
    }
}

function closeModal() {
    videoModal.classList.remove('active');
    document.body.style.overflow = '';
    const body = document.getElementById('modalBody');
    // Pequeno delay para terminar a animação de fechamento antes de limpar
    setTimeout(() => { if (body) body.innerHTML = ''; }, 300);
}

// =============================================
// Keyboard shortcuts
// =============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (videoModal.classList.contains('active')) closeModal();
        if (adminModal.classList.contains('active')) closeAdminModal();
        const loginModal = document.getElementById('adminLoginModal');
        if (loginModal && loginModal.classList.contains('active')) closeAdminLoginModal();
    }
});

// =============================================
// Inicialização
// =============================================
initDB().catch(err => console.warn('IndexedDB indisponível:', err));
renderAdminNav();
renderSwimlanes();
