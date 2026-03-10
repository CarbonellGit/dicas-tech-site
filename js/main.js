// js/main.js
// Controller principal — inicializa o Firebase, listeners e carrega os dados.

import { setupAuth, renderAdminNav, initEventListeners, loadTips, renderCategories } from "./ui.js";
import { fetchCategoriesFromFirestore } from "./database.js";
import { store } from "./store.js";

/**
 * Inicializa a aplicação configurando ícones, autenticação,
 * controle de estado, eventos de interface e carregamento inicial de dados.
 * @async
 * @function init
 */
async function init() {
    // Inicializa o Lucide Icons
    lucide.createIcons();

    // Configura o observador de autenticação (Firebase Auth)
    setupAuth();

    // Renderiza o botão de admin (inicialmente deslogado)
    renderAdminNav();

    // Busca categorias no Firebase e popula a store e a UI
    const cats = await fetchCategoriesFromFirestore();
    store.setCategories(cats);
    renderCategories();

    // Vincula todos os event listeners (substitui inline onclick/onchange)
    initEventListeners();

    // Carrega dicas do Firestore e renderiza os carrosséis
    loadTips();
}

init();
