/**
 * @module database
 * @description Módulo responsável pela comunicação com o Firestore e Firebase Storage.
 * Implementa operações CRUD para as dicas (tips) e categorias, 
 * além de uploads de arquivos de mídia com controle de progresso.
 */
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from "firebase/firestore";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { db, storage } from "./firebase-config.js";

const TIPS_COLLECTION = "tips";
const CATEGORIES_COLLECTION = "config"; // Assuming there is a config collection with a document 'app_settings' OR a 'categories' collection. Let's make it 'categories' collection for simplicity or just a document. We'll use a document 'metadata' in 'categories' or just a 'categories' collection where each doc is a category. Let's assume a 'categories' collection where each doc has a 'name' field.


/**
 * Faz upload de um arquivo (imagem ou vídeo) para o Firebase Storage usando uploadBytesResumable.
 * Permite acompanhar o progresso através de um callback opcional.
 *
 * @param {File} file - Objeto File do arquivo a ser enviado.
 * @param {string} path - Caminho de destino no Storage (ex: 'thumbnails/tipId.jpg').
 * @param {Function} onProgress - Callback(percent) chamado durante o upload.
 * @returns {Promise<string>} URL pública do arquivo.
 */
export function uploadFileWithProgress(file, path, onProgress) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => {
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

/**
 * Salva os metadados de uma nova dica na coleção 'tips' do Firestore.
 *
 * @param {Object} tipData - Dados da dica.
 * @returns {Promise<string>} ID do documento criado no Firestore.
 */
export async function saveTipToFirestore(tipData) {
    const docRef = await addDoc(collection(db, TIPS_COLLECTION), {
        ...tipData,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Atualiza os metadados de uma dica existente no Firestore.
 *
 * @param {string} id - ID do documento.
 * @param {Object} dataToUpdate - Dados a serem atualizados.
 */
export async function updateTipInFirestore(id, dataToUpdate) {
    const docRef = doc(db, TIPS_COLLECTION, id);
    await updateDoc(docRef, dataToUpdate);
}

/**
 * Busca todas as categorias dinâmicas do Firestore.
 * Assume que existe uma coleção 'categories' onde cada documento tem um campo 'name'.
 * Se a coleção estiver vazia, retorna as categorias padrão.
 */
export async function fetchCategoriesFromFirestore() {
    try {
        const q = query(collection(db, "categories"), orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            // Categorias default fallback caso não existam no banco ainda
            return ["Novidades", "Inteligência Artificial", "Ferramentas Google", "Windows"];
        }
        return snapshot.docs.map(d => d.data().name).filter(Boolean);
    } catch (err) {
        console.error("Erro ao buscar categorias:", err);
        return ["Novidades", "Inteligência Artificial", "Ferramentas Google", "Windows"];
    }
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
