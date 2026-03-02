// js/firebase-config.js
// Inicializa o app do Firebase e exporta as instâncias de serviço.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDiItmIm0cQtqXMQsA2a_0vXatOVurmkxo",
    authDomain: "site-dicastech.firebaseapp.com",
    projectId: "site-dicastech",
    storageBucket: "site-dicastech.firebasestorage.app",
    messagingSenderId: "754639217350",
    appId: "1:754639217350:web:976500c6ad6c213b0badc7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
