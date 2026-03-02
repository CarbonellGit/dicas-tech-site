// js/main.js
// Controller principal — inicializa o Firebase, listeners e carrega os dados.

import { setupAuth, renderAdminNav, initEventListeners, loadTips } from "./ui.js";

// Inicializa o Lucide Icons
lucide.createIcons();

// Configura o observador de autenticação (Firebase Auth)
setupAuth();

// Renderiza o botão de admin (inicialmente deslogado)
renderAdminNav();

// Vincula todos os event listeners (substitui inline onclick/onchange)
initEventListeners();

// Carrega dicas do Firestore e renderiza os carrosséis
loadTips();
