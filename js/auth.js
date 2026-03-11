// js/auth.js
// Módulo de Autenticação — login, logout e observador de estado via Firebase Auth.

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { auth } from "./firebase-config.js";

/**
 * Tenta autenticar o usuário com e-mail e senha no Firebase.
 * Em caso de falha, exibe a mensagem de erro no modal.
 */
export async function tryAdminLogin() {
    const emailEl = document.getElementById("adminEmail");
    const passwordEl = document.getElementById("adminPassword");
    const errorEl = document.getElementById("adminLoginError");

    const email = emailEl?.value?.trim() || "";
    const password = passwordEl?.value || "";

    if (!email || !password) {
        if (errorEl) {
            errorEl.textContent = "Preencha o usuário e a senha.";
            errorEl.style.display = "block";
        }
        return;
    }

    let loginEmail = email;
    if (loginEmail.toLowerCase() === "admin") {
        loginEmail = "admin@carbonell.com.br";
    }

    const loginBtn = document.getElementById("adminLoginBtn");
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = "Entrando..."; }

    try {
        await signInWithEmailAndPassword(auth, loginEmail, password);
        // O onAuthStateChanged cuida de fechar o modal e atualizar a UI
    } catch (err) {
        // Se for o login do admin primário que ainda não existe no Firebase, tenta criá-lo
        if (loginEmail === "admin@carbonell.com.br" && password === "Intelcore@2026") {
            try {
                await createUserWithEmailAndPassword(auth, loginEmail, password);
                return;
            } catch (createErr) {
                console.error("Erro ao criar admin auto:", createErr);
            }
        }

        if (errorEl) {
            errorEl.textContent = "Usuário ou senha inválidos. Tente novamente.";
            errorEl.style.display = "block";
        }
        if (passwordEl) passwordEl.value = "";
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "Entrar"; }
    }
}

/**
 * Encerra a sessão do usuário autenticado no Firebase.
 */
export async function adminLogout() {
    await signOut(auth);
}

/**
 * Configura o observador de estado de autenticação do Firebase.
 * Quando o estado muda (login/logout), atualiza a navegação
 * e re-renderiza as swimlanes para refletir os controles de admin.
 *
 * @param {Function} onLogin - Callback executado quando usuário logado.
 * @param {Function} onLogout - Callback executado quando usuário deslogado.
 */
export function initAuthListener(onLogin, onLogout) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            onLogin(user);
        } else {
            onLogout();
        }
    });
}
