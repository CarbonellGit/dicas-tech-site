// js/database.js
// Módulo de Banco de Dados e Storage — CRUD no Firestore e uploads no Firebase Storage.

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from "firebase/firestore";
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { db, storage } from "./firebase-config.js";

const TIPS_COLLECTION = "tips";

/**
 * Faz upload de um arquivo (imagem ou vídeo) para o Firebase Storage.
 * Retorna a URL pública do arquivo após o upload.
 *
 * @param {File} file - Objeto File do arquivo a ser enviado.
 * @param {string} path - Caminho de destino no Storage (ex: 'thumbnails/tipId.jpg').
 * @returns {Promise<string>} URL pública do arquivo.
 */
export async function uploadFile(file, path) {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

/**
 * Salva os metadados de uma nova dica na coleção 'tips' do Firestore.
 *
 * @param {Object} tipData - Dados da dica (title, categories, duration, description, imageUrl, videoUrl, videoType).
 * @returns {Promise<string>} ID do documento criado no Firestore.
 */
export async function saveTipToFirestore(tipData) {
    const docRef = await addDoc(collection(db, TIPS_COLLECTION), {
        ...tipData,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

let lastVisibleTip = null;
let hasMoreTips = true;
const TIPS_PER_PAGE = 15;

/**
 * Busca todas as dicas do Firestore, ordenadas por data de criação (mais recentes primeiro),
 * com suporte a paginação.
 *
 * @param {boolean} reset - Se verdadeiro, reseta a paginação e busca as primeiras.
 * @returns {Promise<Array>} Array de objetos de dica com o campo 'id' adicionado.
 */
export async function fetchTipsFromFirestore(reset = false) {
    if (reset) {
        lastVisibleTip = null;
        hasMoreTips = true;
    }

    if (!hasMoreTips) return [];

    let q = query(
        collection(db, TIPS_COLLECTION),
        orderBy("createdAt", "desc"),
        limit(TIPS_PER_PAGE)
    );

    if (lastVisibleTip) {
        q = query(q, startAfter(lastVisibleTip));
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        hasMoreTips = false;
        return [];
    }

    lastVisibleTip = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < TIPS_PER_PAGE) {
        hasMoreTips = false;
    }

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Retorna estado indicativo de se há mais dicas para carregar do banco.
 */
export function hasMoreTipsToLoad() {
    return hasMoreTips;
}

/**
 * Exclui uma dica do Firestore e, se houver arquivos de mídia no Storage,
 * exclui também o arquivo de thumbnail e/ou vídeo.
 *
 * @param {Object} tip - Objeto da dica (com id, storageThumbnailPath, storageVideoPath).
 */
export async function deleteTipFromFirestore(tip) {
    // Deleta o documento do Firestore
    await deleteDoc(doc(db, TIPS_COLLECTION, tip.id));

    // Deleta a thumbnail do Storage se existir
    if (tip.storageThumbnailPath) {
        try {
            await deleteObject(ref(storage, tip.storageThumbnailPath));
        } catch (_) { /* Arquivo pode não existir mais, ignorar. */ }
    }

    // Deleta o vídeo do Storage se existir
    if (tip.storageVideoPath) {
        try {
            await deleteObject(ref(storage, tip.storageVideoPath));
        } catch (_) { /* Arquivo pode não existir mais, ignorar. */ }
    }
}
