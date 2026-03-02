// js/ui.js
// Módulo de Interface — manipulação de DOM, modais, renderização de Swimlanes e eventos.

import { tryAdminLogin, adminLogout, initAuthListener } from "./auth.js";
import {
    fetchTipsFromFirestore,
    saveTipToFirestore,
    deleteTipFromFirestore,
    uploadFile
} from "./database.js";

// =============================================
// Estado Global
// =============================================
let tips = [];
let activeCategory = "Todos";
let searchQuery = "";
let isAdmin = false;

// Estado da mídia selecionada no formulário
let selectedThumbFile = null;   // File object da thumbnail
let selectedThumbUrl = "";      // URL externa de thumbnail
let currentThumbTab = "upload";
let selectedVideoFile = null;   // File object do vídeo
let selectedVideoUrl = "";      // URL externa/YouTube do vídeo
let currentVideoTab = "upload";

// Categorias
const CATEGORIES = [
    "Novidades",
    "Inteligência Artificial",
    "Ferramentas Google",
    "Windows"
];

const DEFAULT_THUMB = "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=400";

// =============================================
// Autenticação — Observador de Estado
// =============================================
export function setupAuth() {
    initAuthListener(
        (user) => {
            // Usuário logado
            isAdmin = true;
            closeAdminLoginModal();
            renderAdminNav();
            renderSwimlanes();
            showToast("✅ Login realizado com sucesso!");
        },
        () => {
            // Usuário deslogado
            isAdmin = false;
            renderAdminNav();
            renderSwimlanes();
        }
    );
}

// =============================================
// Barra de Navegação Admin
// =============================================
export function renderAdminNav() {
    const container = document.getElementById("adminNavActions");
    if (!container) return;

    if (isAdmin) {
        container.innerHTML = `
      <button class="btn btn-secondary" id="navBtnNovaDica" style="padding: 8px 16px; font-size: 0.9rem;">
        <i data-lucide="plus" style="width: 18px; height: 18px;"></i> Nova Dica
      </button>
      <button class="btn btn-secondary" id="navBtnLogout" style="padding: 8px 14px; font-size: 0.85rem; opacity: 0.75;" title="Sair do modo admin">
        <i data-lucide="log-out" style="width: 16px; height: 16px;"></i> Sair
      </button>
    `;
        document.getElementById("navBtnNovaDica")?.addEventListener("click", openAdminModal);
        document.getElementById("navBtnLogout")?.addEventListener("click", adminLogout);
    } else {
        container.innerHTML = `
      <button class="icon-btn" id="navBtnAdminLogin" title="Admin" style="opacity: 0.35;" aria-label="Acesso admin">
        <i data-lucide="lock" style="width: 18px; height: 18px;"></i>
      </button>
    `;
        document.getElementById("navBtnAdminLogin")?.addEventListener("click", openAdminLoginModal);
    }
    lucide.createIcons();
}

// =============================================
// Hero Dinâmico (Última dica postada)
// =============================================
function updateHero() {
    if (tips.length === 0) return;
    const latest = tips[0];
    const heroSection = document.getElementById("heroSection");
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");
    const heroBtn = document.getElementById("heroBtn");

    if (heroTitle) heroTitle.textContent = latest.title;
    if (heroDesc) {
        heroDesc.textContent = latest.description
            ? latest.description
            : 'Clique em "Assistir Agora" para ver a dica mais recente.';
    }
    if (heroSection && latest.imageUrl) {
        heroSection.style.backgroundImage = `url('${latest.imageUrl}')`;
    }
    if (heroBtn) {
        heroBtn.style.display = "";
        heroBtn.onclick = () => openModal(tips[0].id);
    }
}

// =============================================
// Render Swimlanes (com DocumentFragment)
// =============================================
export function renderSwimlanes() {
    const wrapper = document.getElementById("swimlanes-wrapper");
    if (!wrapper) return;

    // Filtra dicas pela query de busca
    let filteredTips = tips;
    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        filteredTips = filteredTips.filter(tip =>
            tip.title.toLowerCase().includes(q) ||
            (tip.description && tip.description.toLowerCase().includes(q))
        );
    }

    // Agrupa por categoria
    const groupedTips = {};
    CATEGORIES.forEach(cat => (groupedTips[cat] = []));
    filteredTips.forEach(tip => {
        const cats = Array.isArray(tip.categories)
            ? tip.categories
            : tip.category ? [tip.category] : [];
        cats.forEach(cat => {
            if (groupedTips[cat]) groupedTips[cat].push(tip);
        });
    });

    const categoriesToRender =
        activeCategory === "Todos" ? CATEGORIES : [activeCategory];
    let hasAnyCards = false;

    // Constrói toda a estrutura em memória com DocumentFragment
    const fragment = document.createDocumentFragment();

    categoriesToRender.forEach(cat => {
        const catTips = groupedTips[cat];
        if (!catTips || catTips.length === 0) return;
        hasAnyCards = true;

        // Monta o HTML dos cards em uma única string
        const cardsHTML = catTips.map(tip => {
            const thumb = tip.imageUrl || DEFAULT_THUMB;
            return `
        <div class="card" data-tip-id="${tip.id}">
          <img src="${thumb}" alt="Thumbnail" class="card-image" onerror="this.src='${DEFAULT_THUMB}'">
          <div class="card-overlay">
            <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
            <h3 class="card-title">${tip.title}</h3>
            <p class="card-duration">${tip.duration}</p>
          </div>
          ${isAdmin ? `<button class="delete-btn" data-delete-id="${tip.id}" title="Remover"><i data-lucide="trash-2"></i></button>` : ""}
        </div>`;
        }).join("");

        const sectionEl = document.createElement("section");
        sectionEl.className = "swimlane";
        sectionEl.innerHTML = `
      <h2 class="swimlane-title">${cat}</h2>
      <div class="carousel-container">
        <button class="carousel-btn prev-btn" data-scroll="-500"><i data-lucide="chevron-left"></i></button>
        <div class="carousel-track">${cardsHTML}</div>
        <button class="carousel-btn next-btn" data-scroll="500"><i data-lucide="chevron-right"></i></button>
      </div>
    `;

        // Delegação de eventos dentro da section
        sectionEl.addEventListener("click", onSwimlaneClick);
        fragment.appendChild(sectionEl);
    });

    // Limpa o wrapper e insere tudo de uma vez (único reflow)
    wrapper.innerHTML = "";

    if (!hasAnyCards) {
        const emptyDiv = document.createElement("div");
        emptyDiv.style.cssText = "padding:60px 4%;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;justify-content:center;";
        emptyDiv.innerHTML = `
      <i data-lucide="film" style="width:64px;height:64px;opacity:0.3;margin-bottom:20px;"></i>
      <h3 style="font-size:1.5rem;margin-bottom:8px;">Nenhuma dica encontrada</h3>
      <p>Nenhum conteúdo cadastrado${activeCategory !== "Todos" ? ` em "${activeCategory}"` : ""}.${isAdmin ? ' Clique em "Nova Dica" para adicionar!' : ""}</p>
    `;
        wrapper.appendChild(emptyDiv);
    } else {
        wrapper.appendChild(fragment);
    }

    lucide.createIcons();
    updateHero();
}

/**
 * Tratador de eventos delegado para cliques dentro de uma swimlane.
 * Gerencia cliques em cards (abrir modal), botões de deletar e botões de scroll.
 */
function onSwimlaneClick(e) {
    // Botão de deletar
    const deleteBtn = e.target.closest("[data-delete-id]");
    if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute("data-delete-id");
        handleDeleteTip(id);
        return;
    }

    // Botão de scroll do carrossel
    const scrollBtn = e.target.closest("[data-scroll]");
    if (scrollBtn) {
        const amount = parseInt(scrollBtn.getAttribute("data-scroll"), 10);
        const track = scrollBtn.parentElement.querySelector(".carousel-track");
        track?.scrollBy({ left: amount, behavior: "smooth" });
        return;
    }

    // Card
    const card = e.target.closest("[data-tip-id]");
    if (card) {
        const id = card.getAttribute("data-tip-id");
        openModal(id);
    }
}

// =============================================
// Exclusão de Dica
// =============================================
async function handleDeleteTip(id) {
    if (!isAdmin) return;
    if (!confirm("Tem certeza que deseja remover esta dica?")) return;

    const tip = tips.find(t => t.id === id);
    if (!tip) return;

    try {
        await deleteTipFromFirestore(tip);
        tips = tips.filter(t => t.id !== id);
        renderSwimlanes();
        showToast("🗑️ Dica removida.");
    } catch (err) {
        console.error("Erro ao deletar dica:", err);
        showToast("❌ Erro ao remover a dica. Tente novamente.");
    }
}

// =============================================
// Modal de Login
// =============================================
function openAdminLoginModal() {
    const modal = document.getElementById("adminLoginModal");
    if (!modal) return;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    const emailEl = document.getElementById("adminEmail");
    const pwEl = document.getElementById("adminPassword");
    const errEl = document.getElementById("adminLoginError");
    if (emailEl) emailEl.value = "";
    if (pwEl) pwEl.value = "";
    if (errEl) errEl.style.display = "none";
}

function closeAdminLoginModal() {
    const modal = document.getElementById("adminLoginModal");
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "";
}

// =============================================
// Modal de Adicionar Dica
// =============================================
function openAdminModal() {
    if (!isAdmin) return;
    resetForm();
    document.getElementById("adminModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeAdminModal() {
    document.getElementById("adminModal")?.classList.remove("active");
    document.body.style.overflow = "";
    setTimeout(resetForm, 350);
}

function resetForm() {
    try {
        document.getElementById("addTipForm")?.reset();

        selectedThumbFile = null;
        selectedThumbUrl = "";
        selectedVideoFile = null;
        selectedVideoUrl = "";
        currentThumbTab = "upload";
        currentVideoTab = "upload";

        setDisplay("thumbUploadPanel", "");
        setDisplay("thumbUrlPanel", "none");
        setDisplay("thumbPreviewWrap", "none");
        setSrc("thumbPreviewImg", "");
        toggleClass("tabThumbUpload", "active", true);
        toggleClass("tabThumbUrl", "active", false);
        setText("fileUploadText", "Clique para selecionar uma imagem");

        setDisplay("videoUploadPanel", "");
        setDisplay("videoUrlPanel", "none");
        setDisplay("videoPreviewWrap", "none");
        const vPrev = document.getElementById("videoPreviewEl");
        if (vPrev) { vPrev.src = ""; vPrev.removeAttribute("src"); }
        toggleClass("tabVideoUpload", "active", true);
        toggleClass("tabVideoUrl", "active", false);
        setText("videoUploadText", "Clique para selecionar um vídeo");

        setValue("tipImageFile", "");
        setValue("tipVideoFile", "");
        setValue("tipImageUrl", "");
        setValue("tipVideoUrl", "");
        setDisplay("categoryError", "none");

        document.querySelectorAll(".category-checkboxes input[type=checkbox]").forEach(cb => (cb.checked = false));
    } catch (err) {
        console.warn("resetForm (non-critical):", err);
    }
}

// Helpers DOM
function setDisplay(id, val) { const el = document.getElementById(id); if (el) el.style.display = val; }
function setSrc(id, val) { const el = document.getElementById(id); if (el) el.src = val; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function toggleClass(id, cls, force) { const el = document.getElementById(id); if (el) el.classList.toggle(cls, force); }

// ---- Thumbnail ----
function switchThumbTab(tab) {
    currentThumbTab = tab;
    setDisplay("thumbUploadPanel", tab === "upload" ? "" : "none");
    setDisplay("thumbUrlPanel", tab === "url" ? "" : "none");
    toggleClass("tabThumbUpload", "active", tab === "upload");
    toggleClass("tabThumbUrl", "active", tab === "url");
    selectedThumbFile = null;
    selectedThumbUrl = "";
    setDisplay("thumbPreviewWrap", "none");
    setValue("tipImageFile", "");
    setValue("tipImageUrl", "");
    setText("fileUploadText", "Clique para selecionar uma imagem");
}

function onThumbFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    selectedThumbFile = file;
    const previewUrl = URL.createObjectURL(file);
    setSrc("thumbPreviewImg", previewUrl);
    setDisplay("thumbPreviewWrap", "");
    setText("fileUploadText", file.name);
}

function clearThumb() {
    selectedThumbFile = null;
    selectedThumbUrl = "";
    setDisplay("thumbPreviewWrap", "none");
    setSrc("thumbPreviewImg", "");
    setValue("tipImageFile", "");
    setValue("tipImageUrl", "");
    setText("fileUploadText", "Clique para selecionar uma imagem");
}

// ---- Vídeo ----
function switchVideoTab(tab) {
    currentVideoTab = tab;
    setDisplay("videoUploadPanel", tab === "upload" ? "" : "none");
    setDisplay("videoUrlPanel", tab === "url" ? "" : "none");
    toggleClass("tabVideoUpload", "active", tab === "upload");
    toggleClass("tabVideoUrl", "active", tab === "url");
    selectedVideoFile = null;
    selectedVideoUrl = "";
    const el = document.getElementById("videoPreviewEl");
    if (el) { el.src = ""; el.removeAttribute("src"); }
    setDisplay("videoPreviewWrap", "none");
    setValue("tipVideoFile", "");
    setValue("tipVideoUrl", "");
    setText("videoUploadText", "Clique para selecionar um vídeo");
}

function onVideoFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    selectedVideoFile = file;
    const previewUrl = URL.createObjectURL(file);
    const el = document.getElementById("videoPreviewEl");
    if (el) el.src = previewUrl;
    setDisplay("videoPreviewWrap", "");
    setText("videoUploadText", `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
}

function clearVideo() {
    selectedVideoFile = null;
    selectedVideoUrl = "";
    const el = document.getElementById("videoPreviewEl");
    if (el) { el.src = ""; el.removeAttribute("src"); }
    setDisplay("videoPreviewWrap", "none");
    setValue("tipVideoFile", "");
    setValue("tipVideoUrl", "");
    setText("videoUploadText", "Clique para selecionar um vídeo");
}

// ---- Salvar Dica ----
async function saveTip() {
    if (!isAdmin) return;

    const title = document.getElementById("tipTitle")?.value.trim();
    const duration = document.getElementById("tipDuration")?.value.trim();
    const description = document.getElementById("tipDesc")?.value.trim() || "";

    if (!title || !duration) {
        alert("Por favor, preencha o título e a duração.");
        return;
    }

    const selectedCats = [];
    document.querySelectorAll(".category-checkboxes input[type=checkbox]:checked").forEach(cb => selectedCats.push(cb.value));
    if (selectedCats.length === 0) {
        setDisplay("categoryError", "block");
        return;
    }
    setDisplay("categoryError", "none");

    const saveBtn = document.querySelector("#adminModal .btn-primary");
    const originalBtnHTML = saveBtn?.innerHTML;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Salvando..."; }

    try {
        let imageUrl = "";
        let storageThumbnailPath = "";

        // Upload da thumbnail para o Storage ou usar URL externa
        if (currentThumbTab === "upload" && selectedThumbFile) {
            storageThumbnailPath = `thumbnails/${Date.now()}_${selectedThumbFile.name}`;
            imageUrl = await uploadFile(selectedThumbFile, storageThumbnailPath);
        } else if (currentThumbTab === "url") {
            imageUrl = document.getElementById("tipImageUrl")?.value.trim() || "";
        }

        let videoUrl = "";
        let storageVideoPath = "";
        let videoType = "";

        // Upload do vídeo para o Storage ou usar URL/YouTube
        if (currentVideoTab === "upload" && selectedVideoFile) {
            storageVideoPath = `videos/${Date.now()}_${selectedVideoFile.name}`;
            videoUrl = await uploadFile(selectedVideoFile, storageVideoPath);
            videoType = "storage";
        } else if (currentVideoTab === "url") {
            const rawUrl = document.getElementById("tipVideoUrl")?.value.trim() || "";
            if (rawUrl) {
                videoUrl = convertYouTubeUrl(rawUrl);
                videoType = videoUrl.includes("youtube.com/embed") ? "youtube" : "url";
            }
        }

        const tipData = {
            title,
            categories: selectedCats,
            duration,
            description,
            imageUrl,
            videoUrl,
            videoType,
            storageThumbnailPath,
            storageVideoPath
        };

        const newId = await saveTipToFirestore(tipData);

        // Adiciona localmente para evitar re-fetch imediato
        tips.unshift({ id: newId, ...tipData, createdAt: { seconds: Date.now() / 1000 } });

        closeAdminModal();

        activeCategory = "Todos";
        document.querySelectorAll(".filter-pill").forEach(p => {
            p.classList.remove("active");
            if (p.getAttribute("data-category") === "Todos") p.classList.add("active");
        });

        setTimeout(() => {
            renderSwimlanes();
            document.getElementById("swimlanes-wrapper")?.scrollIntoView({ behavior: "smooth", block: "start" });
            showToast("✅ Dica salva com sucesso!");
        }, 320);

    } catch (err) {
        console.error("Erro ao salvar dica:", err);
        showToast("❌ Erro ao salvar a dica. Verifique o console.");
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHTML; lucide.createIcons(); }
    }
}

// =============================================
// Modal de Visualização
// =============================================
function openModal(tipId) {
    const tip = tips.find(t => t.id === tipId);
    if (!tip) return;

    document.getElementById("modalTitle").textContent = tip.title;
    const descEl = document.getElementById("modalDesc");
    if (tip.description) {
        descEl.textContent = tip.description;
        descEl.style.display = "";
    } else {
        descEl.style.display = "none";
    }

    const body = document.getElementById("modalBody");
    body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:0.9rem;opacity:0.7;">Carregando...</div>';
    document.getElementById("videoModal")?.classList.add("active");
    document.body.style.overflow = "hidden";

    if (tip.videoUrl) {
        if (tip.videoType === "youtube") {
            body.innerHTML = `
        <iframe src="${tip.videoUrl}?autoplay=1"
          style="width:100%;height:100%;border:none;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
        } else {
            // storage ou url direta
            body.innerHTML = `
        <video controls autoplay style="width:100%;height:100%;background:#000;">
          <source src="${tip.videoUrl}" type="video/mp4">
          <source src="${tip.videoUrl}" type="video/webm">
          Seu navegador não suporta vídeo HTML5.
        </video>`;
        }
    } else {
        const imgSrc = tip.imageUrl || DEFAULT_THUMB;
        body.innerHTML = `
      <div class="video-placeholder">
        <img src="${imgSrc}" alt="${tip.title}" onerror="this.src='${DEFAULT_THUMB}'">
        <div class="fake-play-btn"><i data-lucide="play" fill="currentColor"></i></div>
      </div>`;
        lucide.createIcons();
    }
}

function closeModal() {
    document.getElementById("videoModal")?.classList.remove("active");
    document.body.style.overflow = "";
    setTimeout(() => {
        const body = document.getElementById("modalBody");
        if (body) body.innerHTML = "";
    }, 300);
}

// =============================================
// Utilitários
// =============================================
function convertYouTubeUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
            return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
        }
        if (u.hostname.includes("youtu.be")) {
            return `https://www.youtube.com/embed${u.pathname}`;
        }
    } catch (_) { }
    return url;
}

export function showToast(msg) {
    let toast = document.getElementById("appToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("toast-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("toast-visible"), 3000);
}

// =============================================
// Inicialização de Eventos (substitui inline)
// =============================================
export function initEventListeners() {
    // Filtros de categoria
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", e => {
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeCategory = e.currentTarget.getAttribute("data-category");
            renderSwimlanes();
        });
    });

    // Busca
    document.getElementById("searchInput")?.addEventListener("input", e => {
        searchQuery = e.target.value;
        renderSwimlanes();
    });

    // Hero button
    document.getElementById("heroBtn")?.addEventListener("click", () => {
        if (tips.length > 0) openModal(tips[0].id);
    });

    // Modal de login
    document.getElementById("adminLoginModal")
        ?.querySelector(".modal-backdrop")
        ?.addEventListener("click", closeAdminLoginModal);

    document.getElementById("closeAdminLoginBtn")?.addEventListener("click", closeAdminLoginModal);
    document.getElementById("cancelAdminLoginBtn")?.addEventListener("click", closeAdminLoginModal);
    document.getElementById("adminLoginBtn")?.addEventListener("click", tryAdminLogin);

    // Campo senha: Enter submete
    document.getElementById("adminPassword")?.addEventListener("keydown", e => {
        if (e.key === "Enter") tryAdminLogin();
    });

    // Modal de adicionar dica
    document.getElementById("adminModal")
        ?.querySelector(".modal-backdrop")
        ?.addEventListener("click", closeAdminModal);

    document.getElementById("closeAdminModalBtn")?.addEventListener("click", closeAdminModal);
    document.getElementById("cancelAdminModalBtn")?.addEventListener("click", closeAdminModal);
    document.getElementById("saveTipBtn")?.addEventListener("click", saveTip);

    // Modal de vídeo
    document.getElementById("videoModal")
        ?.querySelector(".modal-backdrop")
        ?.addEventListener("click", closeModal);

    document.getElementById("closeVideoModalBtn")?.addEventListener("click", closeModal);

    // Tabs de thumbnail
    document.getElementById("tabThumbUpload")?.addEventListener("click", () => switchThumbTab("upload"));
    document.getElementById("tabThumbUrl")?.addEventListener("click", () => switchThumbTab("url"));
    document.getElementById("tipImageFile")?.addEventListener("change", onThumbFileSelected);
    document.getElementById("clearThumbBtn")?.addEventListener("click", clearThumb);

    // Tabs de vídeo
    document.getElementById("tabVideoUpload")?.addEventListener("click", () => switchVideoTab("upload"));
    document.getElementById("tabVideoUrl")?.addEventListener("click", () => switchVideoTab("url"));
    document.getElementById("tipVideoFile")?.addEventListener("change", onVideoFileSelected);
    document.getElementById("clearVideoBtn")?.addEventListener("click", clearVideo);

    // Teclado: ESC fecha modais
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        const videoModal = document.getElementById("videoModal");
        const adminModal = document.getElementById("adminModal");
        const loginModal = document.getElementById("adminLoginModal");
        if (videoModal?.classList.contains("active")) closeModal();
        else if (adminModal?.classList.contains("active")) closeAdminModal();
        else if (loginModal?.classList.contains("active")) closeAdminLoginModal();
    });
}

// =============================================
// Carregamento Inicial do Firestore
// =============================================
export async function loadTips() {
    try {
        tips = await fetchTipsFromFirestore();
    } catch (err) {
        console.error("Erro ao buscar dicas do Firestore:", err);
        tips = [];
    }
    renderSwimlanes();
}
