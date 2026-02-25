// Initialize Lucide Icons
lucide.createIcons();

// State: Load from LocalStorage
// Remover dados mockados conforme solicitado e ler direto do Storage,
// se não tiver nada, começa com array vazio.
let tips = JSON.parse(localStorage.getItem('carbonell_tips')) || [];
let activeCategory = 'Todos';
let searchQuery = '';

const CATEGORIES = [
    "Novidades",
    "Google Planilhas",
    "Google Docs & Drive",
    "Inteligência Artificial",
    "Dicas de Windows"
];

// Helper to generate Unique ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Ensure at least one initial render happens
renderSwimlanes();

// ----------------------------------------------------
// UI Render Logic
// ----------------------------------------------------
function renderSwimlanes() {
    const wrapper = document.getElementById('swimlanes-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = ''; // Limpa swimlanes atuais

    // Filtro Textual
    let filteredTips = tips;
    if (searchQuery.trim() !== '') {
        filteredTips = filteredTips.filter(tip =>
            tip.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    // Filtro por Categoria
    if (activeCategory !== 'Todos') {
        filteredTips = filteredTips.filter(tip => tip.category === activeCategory);
    }

    // Agrupa por Categoria
    const groupedTips = {};
    CATEGORIES.forEach(cat => groupedTips[cat] = []);
    filteredTips.forEach(tip => {
        if (groupedTips[tip.category]) {
            groupedTips[tip.category].push(tip);
        } else {
            groupedTips[tip.category] = [tip]; // Previne erro caso categoria não exista
        }
    });

    const categoriesToRender = activeCategory === 'Todos' ? CATEGORIES : [activeCategory];
    let hasAnyCards = false;

    categoriesToRender.forEach(cat => {
        const catTips = groupedTips[cat];
        if (catTips && catTips.length > 0) {
            hasAnyCards = true;

            // Generate HTML for cards
            const cardsHTML = catTips.map(tip => `
                <div class="card" onclick="openModal('${tip.title.replace(/'/g, "\\'")}', '${tip.image}')">
                    <img src="${tip.image}" alt="Thumbnail" class="card-image" onerror="this.src='https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=400'">
                    <div class="card-overlay">
                        <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
                        <h3 class="card-title">${tip.title}</h3>
                        <p class="card-duration">${tip.duration}</p>
                    </div>
                    <button class="delete-btn" onclick="deleteTip(event, '${tip.id}')" title="Remover Dica"><i data-lucide="trash-2"></i></button>
                </div>
            `).join('');

            const swimlaneHTML = `
                <section class="swimlane">
                    <h2 class="swimlane-title">${cat}</h2>
                    <div class="carousel-container">
                        <button class="carousel-btn prev-btn" onclick="scrollTrack(this, -500)"><i data-lucide="chevron-left"></i></button>
                        <div class="carousel-track">
                            ${cardsHTML}
                        </div>
                        <button class="carousel-btn next-btn" onclick="scrollTrack(this, 500)"><i data-lucide="chevron-right"></i></button>
                    </div>
                </section>
            `;
            wrapper.innerHTML += swimlaneHTML;
        }
    });

    if (!hasAnyCards) {
        wrapper.innerHTML = `
            <div style="padding: 60px 4%; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <i data-lucide="film" style="width: 64px; height: 64px; opacity: 0.3; margin-bottom: 20px;"></i>
                <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Nenhuma dica encontrada</h3>
                <p>Nenhum vídeo cadastrado na categoria ${activeCategory !== 'Todos' ? '"' + activeCategory + '"' : ''}. Clique em "Nova Dica" para adicionar conteúdo!</p>
            </div>
        `;
    }

    // Re-injetar ícones após renderizar HTML dinâmico
    lucide.createIcons();
}

function scrollTrack(btn, amount) {
    const track = btn.parentElement.querySelector('.carousel-track');
    // Multiplica o valor para dar scroll por seção inteira da tela quase
    // O valor ideal é aprox a largura do container, mas setei manual no HTML do render (+/- 2 a 3 cards)
    track.scrollBy({ left: amount, behavior: 'smooth' });
}

// ----------------------------------------------------
// Event Listeners for Filters
// ----------------------------------------------------
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


// ----------------------------------------------------
// Admin Modal & Tip Management
// ----------------------------------------------------
const adminModal = document.getElementById('adminModal');

function openAdminModal() {
    adminModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAdminModal() {
    adminModal.classList.remove('active');
    document.body.style.overflow = '';
    const form = document.getElementById('addTipForm');
    if (form) form.reset();
}

function saveTip() {
    const form = document.getElementById('addTipForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const title = document.getElementById('tipTitle').value.trim();
    const category = document.getElementById('tipCategory').value;
    const duration = document.getElementById('tipDuration').value.trim();
    const image = document.getElementById('tipImage').value.trim();

    const newTip = {
        id: generateId(),
        title,
        category,
        duration,
        image,
        createdAt: new Date().toISOString()
    };

    // Adiciona ao começo para aparecer primeiro
    tips.unshift(newTip);

    // Salva no log storage
    localStorage.setItem('carbonell_tips', JSON.stringify(tips));

    closeAdminModal();

    // Mostra todos ao adicionar
    activeCategory = 'Todos';
    document.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.remove('active');
        if (p.getAttribute('data-category') === 'Todos') p.classList.add('active');
    });

    renderSwimlanes();
}

function deleteTip(event, id) {
    event.stopPropagation(); // Impede abrir o vídeo ao clicar no botão deletar
    if (confirm('Tem certeza que deseja remover esta dica do sistema?')) {
        tips = tips.filter(t => t.id !== id);
        localStorage.setItem('carbonell_tips', JSON.stringify(tips));
        renderSwimlanes();
    }
}


// ----------------------------------------------------
// Video/Image Modal Logic 
// ----------------------------------------------------
const videoModal = document.getElementById('videoModal');
const modalTitle = document.getElementById('modalTitle');
const modalImage = document.getElementById('modalVideoImage');

function openModal(title, imageSrc) {
    modalTitle.textContent = title;
    modalImage.src = imageSrc;
    // Fallback no caso de erro de carregamento (a div está escura pro trás)
    modalImage.onerror = () => modalImage.src = 'https://images.unsplash.com/photo-1588600878108-578307a3cc9d?auto=format&fit=crop&q=80&w=1000';
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    videoModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { modalImage.src = ''; }, 300);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (videoModal.classList.contains('active')) closeModal();
        if (adminModal.classList.contains('active')) closeAdminModal();
    }
});
