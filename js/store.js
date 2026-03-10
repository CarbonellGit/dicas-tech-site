// js/store.js
// Módulo de Gerenciamento de Estado Global

const state = {
    tips: [],
    activeCategory: "Todos",
    searchQuery: "",
    isAdmin: false,
    categories: []
};

// Sistema simples de Pub/Sub
const listeners = [];

function notifyListeners() {
    listeners.forEach(fn => fn(state));
}

/**
 * Objeto central de armazenamento de estado (Store) que gerencia os dados
 * globais da aplicação utilizando um padrão Observador (Pub/Sub).
 * 
 * @namespace store
 */
export const store = {
    /**
     * Inscreve uma função callback para ser notificada sobre mudanças no estado.
     * @param {Function} fn - Callback que recebe o estado atual.
     * @returns {Function} Função para cancelar a inscrição.
     */
    subscribe(fn) {
        listeners.push(fn);
        return () => {
            const idx = listeners.indexOf(fn);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    },
    /**
     * Retorna uma cópia do estado atual.
     * @returns {Object} Cópia do estado.
     */
    getState() {
        return { ...state };
    },
    /**
     * Define a lista completa de dicas.
     * @param {Array<Object>} tips - Array de dicas.
     */
    setTips(tips) {
        state.tips = tips;
        notifyListeners();
    },
    /**
     * Adiciona um lote de novas dicas ao final da lista (útil para paginação).
     * @param {Array<Object>} tips - Array de novas dicas.
     */
    appendTips(tips) {
        state.tips = [...state.tips, ...tips];
        notifyListeners();
    },
    /**
     * Adiciona uma única dica no início da lista (útil após criação).
     * @param {Object} tip - Objeto da dica.
     */
    prependTip(tip) {
        state.tips = [tip, ...state.tips];
        notifyListeners();
    },
    /**
     * Remove uma dica específica pelo ID.
     * @param {string} id - ID da dica a ser removida.
     */
    removeTip(id) {
        state.tips = state.tips.filter(t => t.id !== id);
        notifyListeners();
    },
    /**
     * Atualiza os dados de uma dica existente.
     * @param {string} id - ID da dica.
     * @param {Object} updatedTip - Objeto com os campos atualizados.
     */
    updateTip(id, updatedTip) {
        state.tips = state.tips.map(t => t.id === id ? { ...t, ...updatedTip } : t);
        notifyListeners();
    },
    /**
     * Define a categoria ativa no filtro do painel.
     * @param {string} category - Categoria selecionada.
     */
    setActiveCategory(category) {
        state.activeCategory = category;
        notifyListeners();
    },
    /**
     * Define o texto da consulta de busca.
     * @param {string} query - Termo a ser pesquisado.
     */
    setSearchQuery(query) {
        state.searchQuery = query;
        notifyListeners();
    },
    /**
     * Define o status de privilégio do usuário atual.
     * @param {boolean} isAdmin - Verdadeiro se o usuário for administrador.
     */
    setIsAdmin(isAdmin) {
        state.isAdmin = isAdmin;
        notifyListeners();
    },
    /**
     * Define a lista global de categorias disponíveis.
     * @param {Array<string>} categories - Array com nomes das categorias.
     */
    setCategories(categories) {
        state.categories = categories;
        notifyListeners();
    }
};
