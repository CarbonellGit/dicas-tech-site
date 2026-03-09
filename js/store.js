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

export const store = {
    subscribe(fn) {
        listeners.push(fn);
        return () => {
            const idx = listeners.indexOf(fn);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    },
    getState() {
        return { ...state };
    },
    setTips(tips) {
        state.tips = tips;
        notifyListeners();
    },
    appendTips(tips) {
        state.tips = [...state.tips, ...tips];
        notifyListeners();
    },
    prependTip(tip) {
        state.tips = [tip, ...state.tips];
        notifyListeners();
    },
    removeTip(id) {
        state.tips = state.tips.filter(t => t.id !== id);
        notifyListeners();
    },
    updateTip(id, updatedTip) {
        state.tips = state.tips.map(t => t.id === id ? { ...t, ...updatedTip } : t);
        notifyListeners();
    },
    setActiveCategory(category) {
        state.activeCategory = category;
        notifyListeners();
    },
    setSearchQuery(query) {
        state.searchQuery = query;
        notifyListeners();
    },
    setIsAdmin(isAdmin) {
        state.isAdmin = isAdmin;
        notifyListeners();
    },
    setCategories(categories) {
        state.categories = categories;
        notifyListeners();
    }
};
