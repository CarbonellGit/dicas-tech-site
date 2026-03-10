/**
 * @module ui
 * @description Módulo de Interface — responsável pela manipulação direta do DOM, 
 * controle de modais, renderização de Swimlanes (carrosséis) e vinculação de eventos.
 */

import { tryAdminLogin, adminLogout, initAuthListener } from "./auth.js";
import { store } from "./store.js";
import {
    fetchTipsFromFirestore,
    saveTipToFirestore,
    updateTipInFirestore,
    deleteTipFromFirestore,
    uploadFileWithProgress,
    hasMoreTipsToLoad
} from "./database.js";

// =============================================
// Utilitários de Segurança
// =============================================
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}



// Estado da mídia selecionada no formulário
let selectedThumbFile = null;   // File object da thumbnail
let selectedThumbUrl = "";      // URL externa de thumbnail
let currentThumbTab = "upload";
let selectedVideoFile = null;   // File object do vídeo
let selectedVideoUrl = "";      // URL externa/YouTube do vídeo
let currentVideoTab = "upload";



const DEFAULT_THUMB = "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=400";

// =============================================
// Autenticação — Observador de Estado
// =============================================
export function setupAuth() {
    initAuthListener(
        (user) => {
            // Usuário logado
            store.setIsAdmin(true);
            closeAdminLoginModal();
            renderAdminNav();
            renderSwimlanes();
            showToast("✅ Login realizado com sucesso!");
        },
        () => {
            // Usuário deslogado
            store.setIsAdmin(false);
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

    if (store.getState().isAdmin) {
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
    if (store.getState().tips.length === 0) return;
    const latest = store.getState().tips[0];
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
    if (heroBtn) {
        heroBtn.style.display = "";
        heroBtn.onclick = () => openModal(store.getState().tips[0].id);
    }
}

// =============================================
// Render Swimlanes (com DocumentFragment)
// =============================================
export function renderSwimlanes() {
    const wrapper = document.getElementById("swimlanes-wrapper");
    if (!wrapper) return;

    // Filtra dicas pela query de busca
    let filteredTips = store.getState().tips;
    if (store.getState().searchQuery.trim() !== "") {
        const q = store.getState().searchQuery.toLowerCase();
        filteredTips = filteredTips.filter(tip =>
            tip.title.toLowerCase().includes(q) ||
            (tip.description && tip.description.toLowerCase().includes(q))
        );
    }

    // Agrupa por categoria
    const groupedTips = {};
    store.getState().categories.forEach(cat => (groupedTips[cat] = []));
    filteredTips.forEach(tip => {
        const cats = Array.isArray(tip.categories)
            ? tip.categories
            : tip.category ? [tip.category] : [];
        cats.forEach(cat => {
            if (groupedTips[cat]) groupedTips[cat].push(tip);
        });
    });

    const categoriesToRender =
        store.getState().activeCategory === "Todos" ? store.getState().categories : [store.getState().activeCategory];
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
        <div class="card" data-tip-id="${escapeHTML(tip.id)}">
          <img src="${escapeHTML(thumb)}" alt="Thumbnail" class="card-image" loading="lazy" onerror="this.src='${DEFAULT_THUMB}'">
          <div class="card-overlay">
            <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
            <h3 class="card-title">${escapeHTML(tip.title)}</h3>
            <p class="card-duration">${escapeHTML(tip.duration)}</p>
          </div>
          ${store.getState().isAdmin ? `
            <button class="edit-btn" data-edit-id="${escapeHTML(tip.id)}" title="Editar"><i data-lucide="pencil"></i></button>
            <button class="delete-btn" data-delete-id="${escapeHTML(tip.id)}" title="Remover"><i data-lucide="trash-2"></i></button>
          ` : ""}
        </div>`;
        }).join("");

        const sectionEl = document.createElement("section");
        sectionEl.className = "swimlane";
        sectionEl.innerHTML = `
      <h2 class="swimlane-title">${escapeHTML(cat)}</h2>
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
      <p>Nenhum conteúdo cadastrado${store.getState().activeCategory !== "Todos" ? ` em "${escapeHTML(store.getState().activeCategory)}"` : ""}.${store.getState().isAdmin ? ' Clique em "Nova Dica" para adicionar!' : ""}</p>
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
    // Botão de editar
    const editBtn = e.target.closest("[data-edit-id]");
    if (editBtn) {
        e.stopPropagation();
        const id = editBtn.getAttribute("data-edit-id");
        handleEditTip(id);
        return;
    }

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
    if (!store.getState().isAdmin) return;
    if (!confirm("Tem certeza que deseja remover esta dica?")) return;

    const tip = store.getState().tips.find(t => t.id === id);
    if (!tip) return;

    try {
        await deleteTipFromFirestore(tip);
        store.removeTip(id);
        renderSwimlanes();
        showToast("🗑️ Dica removida.");
    } catch (err) {
        console.error("Erro ao deletar dica:", err);
        showToast("❌ Erro ao remover a dica. Tente novamente.");
    }
}

// =============================================
// Edição de Dica
// =============================================
async function handleEditTip(id) {
    if (!store.getState().isAdmin) return;

    const tip = store.getState().tips.find(t => t.id === id);
    if (!tip) return;

    resetForm();

    // Fill form
    const editingInput = document.getElementById("editingTipId");
    if (editingInput) editingInput.value = tip.id;

    const modalTitle = document.querySelector("#adminModal .modal-header h3");
    if (modalTitle) modalTitle.textContent = "Editar Dica";

    const saveBtn = document.getElementById("saveTipBtn");
    if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save"></i> Salvar Alterações';

    if (document.getElementById("tipTitle")) document.getElementById("tipTitle").value = tip.title || "";
    if (document.getElementById("tipDuration")) document.getElementById("tipDuration").value = tip.duration || "";
    if (document.getElementById("tipDesc")) document.getElementById("tipDesc").value = tip.description || "";

    const cats = Array.isArray(tip.categories) ? tip.categories : (tip.category ? [tip.category] : []);
    document.querySelectorAll(".category-checkboxes input[type=checkbox]").forEach(cb => {
        cb.checked = cats.includes(cb.value);
    });

    // Populate thumb
    if (tip.imageUrl) {
        if (tip.storageThumbnailPath) {
            switchThumbTab("upload");
            setSrc("thumbPreviewImg", tip.imageUrl);
            setDisplay("thumbPreviewWrap", "");
            setText("fileUploadText", "Imagem atual mantida (Selecione nova para trocar)");
        } else {
            switchThumbTab("url");
            if (document.getElementById("tipImageUrl")) document.getElementById("tipImageUrl").value = tip.imageUrl;
        }
    }

    // Populate video
    if (tip.videoUrl) {
        if (tip.videoType === "url" || tip.videoType === "youtube") {
            switchVideoTab("url");
            if (document.getElementById("tipVideoUrl")) document.getElementById("tipVideoUrl").value = tip.videoUrl;
        } else if (tip.storageVideoPath) {
            switchVideoTab("upload");
            const el = document.getElementById("videoPreviewEl");
            if (el) el.src = tip.videoUrl;
            setDisplay("videoPreviewWrap", "");
            setText("videoUploadText", "Vídeo atual mantido (Selecione novo para trocar)");
        }
    }

    document.getElementById("adminModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
    lucide.createIcons();
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
    if (!store.getState().isAdmin) return;
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

        const editingInput = document.getElementById("editingTipId");
        if (editingInput) editingInput.value = "";

        const modalTitle = document.querySelector("#adminModal .modal-header h3");
        if (modalTitle) modalTitle.textContent = "Adicionar Nova Dica";

        const saveBtn = document.getElementById("saveTipBtn");
        if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save"></i> Salvar Dica';

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

        setDisplay("uploadProgressContainer", "none");
        if (document.getElementById("uploadProgressBar")) document.getElementById("uploadProgressBar").style.width = "0%";
        setText("uploadProgressText", "0%");

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
    if (!store.getState().isAdmin) return;

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
        const editingTipId = document.getElementById("editingTipId")?.value;
        const isEdit = !!editingTipId;
        const tipToEdit = isEdit ? store.getState().tips.find(t => t.id === editingTipId) : null;

        // 1. Prepara dados iniciais
        const initialData = {
            title,
            categories: selectedCats,
            duration,
            description
        };

        let currentId = editingTipId;

        if (!isEdit) {
            initialData.imageUrl = "";
            initialData.videoUrl = "";
            initialData.videoType = "";
            initialData.storageThumbnailPath = "";
            initialData.storageVideoPath = "";
            initialData.status = "pendente";
            currentId = await saveTipToFirestore(initialData);
        } else {
            initialData.status = "atualizando";
            await updateTipInFirestore(currentId, initialData);
        }

        let imageUrl = isEdit ? tipToEdit.imageUrl : "";
        let storageThumbnailPath = isEdit ? tipToEdit.storageThumbnailPath : "";
        let videoUrl = isEdit ? tipToEdit.videoUrl : "";
        let storageVideoPath = isEdit ? tipToEdit.storageVideoPath : "";
        let videoType = isEdit ? tipToEdit.videoType : "";

        const progressContainer = document.getElementById("uploadProgressContainer");
        const progressText = document.getElementById("uploadProgressText");
        const progressBar = document.getElementById("uploadProgressBar");

        const updateProgress = (label, p) => {
            if (progressContainer) progressContainer.style.display = "block";
            if (progressText) progressText.textContent = `${label}: ${Math.round(p)}%`;
            if (progressBar) progressBar.style.width = `${p}%`;
        };

        // Upload da thumbnail para o Storage ou usar URL externa
        if (currentThumbTab === "upload") {
            if (selectedThumbFile) {
                storageThumbnailPath = `thumbnails/${currentId}_${selectedThumbFile.name}`;
                imageUrl = await uploadFileWithProgress(selectedThumbFile, storageThumbnailPath, (p) => updateProgress("Img", p));
            }
        } else if (currentThumbTab === "url") {
            const rawImgUrl = document.getElementById("tipImageUrl")?.value.trim() || "";
            if (rawImgUrl) {
                if (isEdit && rawImgUrl !== tipToEdit.imageUrl) {
                    storageThumbnailPath = ""; // replaced with new URL
                }
                imageUrl = rawImgUrl;
            }
        }

        // Upload do vídeo para o Storage ou usar URL/YouTube
        if (currentVideoTab === "upload") {
            if (selectedVideoFile) {
                storageVideoPath = `videos/${currentId}_${selectedVideoFile.name}`;
                videoUrl = await uploadFileWithProgress(selectedVideoFile, storageVideoPath, (p) => updateProgress("Vídeo", p));
                videoType = "storage";
            }
        } else if (currentVideoTab === "url") {
            const rawUrl = document.getElementById("tipVideoUrl")?.value.trim() || "";
            if (rawUrl) {
                videoUrl = convertYouTubeUrl(rawUrl);
                videoType = videoUrl.includes("youtube.com/embed") ? "youtube" : "url";
                if (isEdit && videoUrl !== tipToEdit.videoUrl) {
                    storageVideoPath = ""; // replaced with new URL
                }
            }
        }

        // 3. Atualiza o documento com as URLs finais e muda o status
        const finalData = {
            imageUrl,
            videoUrl,
            videoType,
            storageThumbnailPath,
            storageVideoPath,
            status: "publicado"
        };
        await updateTipInFirestore(currentId, finalData);

        // Adiciona localmente ou atualiza
        const actTime = isEdit && tipToEdit && tipToEdit.createdAt ? tipToEdit.createdAt : { seconds: Date.now() / 1000 };
        const mergedData = { id: currentId, ...initialData, ...finalData, createdAt: actTime };

        if (isEdit) {
            store.updateTip(currentId, mergedData);
        } else {
            store.prependTip(mergedData);
        }

        closeAdminModal();

        store.setActiveCategory("Todos");
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
    const tip = store.getState().tips.find(t => t.id === tipId);
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
        <iframe src="${escapeHTML(tip.videoUrl)}?autoplay=1"
          style="width:100%;height:100%;border:none;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
        } else {
            // storage ou url direta
            body.innerHTML = `
        <video controls autoplay style="width:100%;height:100%;background:#000;">
          <source src="${escapeHTML(tip.videoUrl)}" type="video/mp4">
          <source src="${escapeHTML(tip.videoUrl)}" type="video/webm">
          Seu navegador não suporta vídeo HTML5.
        </video>`;
        }
    } else {
        const imgSrc = tip.imageUrl || DEFAULT_THUMB;
        body.innerHTML = `
      <div class="video-placeholder">
        <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(tip.title)}" onerror="this.src='${DEFAULT_THUMB}'">
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
    // Busca
    const doSearch = () => {
        const input = document.getElementById("searchInput");
        if (input) {
            store.setSearchQuery(input.value);
            renderSwimlanes();
        }
    };

    document.getElementById("searchInput")?.addEventListener("input", e => {
        store.setSearchQuery(e.target.value);
        renderSwimlanes();
    });

    document.getElementById("searchInput")?.addEventListener("keydown", e => {
        if (e.key === "Enter") doSearch();
    });

    document.getElementById("searchBtn")?.addEventListener("click", doSearch);

    // Hero button
    document.getElementById("heroBtn")?.addEventListener("click", () => {
        if (store.getState().tips.length > 0) openModal(store.getState().tips[0].id);
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
export async function loadTips(reset = true) {
    try {
        const newTips = await fetchTipsFromFirestore(reset);
        if (reset) {
            store.setTips(newTips);
        } else {
            store.appendTips(newTips);
        }
    } catch (err) {
        console.error("Erro ao buscar dicas do Firestore:", err);
        if (reset) store.setTips([]);
    }
    renderSwimlanes();
    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    let btnContainer = document.getElementById("loadMoreContainer");
    if (!btnContainer) {
        btnContainer = document.createElement("div");
        btnContainer.id = "loadMoreContainer";
        btnContainer.style.cssText = "text-align: center; padding: 30px; margin-bottom: 20px;";

        const btn = document.createElement("button");
        btn.id = "btnLoadMore";
        btn.className = "btn btn-secondary";
        btn.textContent = "Carregar Mais";
        btn.style.padding = "10px 24px";
        btn.style.fontSize = "1rem";
        btn.onclick = () => loadTips(false);

        btnContainer.appendChild(btn);

        const wrapper = document.getElementById("swimlanes-wrapper");
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(btnContainer, wrapper.nextSibling);
        }
    }

    const btn = document.getElementById("btnLoadMore");
    if (btn) {
        btn.style.display = hasMoreTipsToLoad() ? "inline-block" : "none";
    }
}

export function renderCategories() {
    const cats = store.getState().categories;
    const filtersContainer = document.querySelector(".filters-container");
    if (filtersContainer) {
        filtersContainer.innerHTML = `<button class="filter-pill active" data-category="Todos">Todos</button>`;
        cats.forEach(cat => {
            filtersContainer.innerHTML += `<button class="filter-pill" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`;
        });
        document.querySelectorAll(".filter-pill").forEach(pill => {
            pill.addEventListener("click", e => {
                document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
                e.currentTarget.classList.add("active");
                store.setActiveCategory(e.currentTarget.getAttribute("data-category"));
                renderSwimlanes();
            });
        });
    }

    const checkboxesContainer = document.querySelector(".category-checkboxes");
    if (checkboxesContainer) {
        checkboxesContainer.innerHTML = "";
        cats.forEach(cat => {
            checkboxesContainer.innerHTML += `
            <label class="checkbox-pill">
                <input type="checkbox" value="${escapeHTML(cat)}"> ${escapeHTML(cat)}
            </label>`;
        });
    }
}
