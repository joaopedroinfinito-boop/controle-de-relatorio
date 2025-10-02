// O Firebase usa um sistema de módulos. Precisamos importar as funções que vamos usar.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, orderBy, query } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// =========================================================================================
// COLE AQUI O SEU OBJETO firebaseConfig QUE VOCÊ SALVOU
const firebaseConfig = {
  apiKey: "AIzaSyArOLzrwNp8t-OZMrelqXLvix4a7Kcanfk",
  authDomain: "app-qualidade-41bf2.firebaseapp.com",
  projectId: "app-qualidade-41bf2",
  storageBucket: "app-qualidade-41bf2.firebasestorage.app",
  messagingSenderId: "685335548003",
  appId: "1:685335548003:web:9ecd51dc8d3b4f8c512856",
  measurementId: "G-D6D7N911BM"
};
// =========================================================================================

// Inicializa o Firebase e seus serviços
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// O restante do seu código, agora adaptado para o Firebase
document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    let relatoriosCache = []; // Cache local para evitar múltiplas leituras do DB

    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const formNovoRelatorio = document.getElementById('form-novo-relatorio');
    const tabelaCorpo = document.getElementById('tabela-registros-corpo');
    const evidenciasInput = document.getElementById('evidencias');
    const previewContainer = document.getElementById('preview-container');
    const modalContainer = document.getElementById('modal-visualizacao');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalImagens = document.getElementById('modal-imagens');
    let selectedFiles = [];

    function abrirModal() { modalContainer.classList.remove('hidden'); }
    function fecharModal() { modalContainer.classList.add('hidden'); }
    modalCloseBtn.addEventListener('click', fecharModal);
    modalOverlay.addEventListener('click', fecharModal);

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            pages.forEach(page => {
                page.classList.toggle('active', page.id === targetId);
            });
        });
    });

    async function visualizarRelatorio(id) {
        const relatorio = relatoriosCache.find(r => r.id === id);
        if (!relatorio) return;

        modalBody.innerHTML = `
            <p><strong>Data:</strong> ${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p><strong>Produto:</strong> ${relatorio.produto}</p>
            <p><strong>Lote:</strong> ${relatorio.lote}</p>
            <p><strong>Status:</strong> <span class="status-tag ${relatorio.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme'}">${relatorio.status}</span></p>
            ${relatorio.descricao ? `<p><strong>Descrição:</strong> ${relatorio.descricao}</p>` : ''}
        `;
        
        modalImagens.innerHTML = '';
        if (relatorio.evidencias && relatorio.evidencias.length > 0) {
            document.querySelector('.modal-imagens-container').style.display = 'block';
            relatorio.evidencias.forEach(evidencia => {
                const imgItem = document.createElement('div');
                imgItem.classList.add('preview-item');
                imgItem.innerHTML = `<a href="${evidencia.url}" target="_blank"><img src="${evidencia.url}" alt="${evidencia.name}"></a>`;
                modalImagens.appendChild(imgItem);
            });
        } else {
            document.querySelector('.modal-imagens-container').style.display = 'none';
        }

        abrirModal();
    }

    async function excluirRelatorio(id) {
        if (confirm('Tem certeza que deseja excluir este relatório?')) {
            try {
                await deleteDoc(doc(db, "relatorios", id));
                alert('Relatório excluído com sucesso!');
                atualizarTudo();
            } catch (error) {
                console.error("Erro ao excluir relatório: ", error);
                alert("Falha ao excluir o relatório.");
            }
        }
    }

    function renderizarTabela() {
        tabelaCorpo.innerHTML = '';
        relatoriosCache.forEach(relatorio => {
            const statusClass = relatorio.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${relatorio.produto}</td>
                <td>${relatorio.lote}</td>
                <td><span class="status-tag ${statusClass}">${relatorio.status}</span></td>
                <td>${relatorio.inspetor}</td>
                <td class="action-buttons">
                    <button class="btn-visualizar" data-id="${relatorio.id}" title="Visualizar">👁️</button>
                    <button class="btn-excluir" data-id="${relatorio.id}" title="Excluir">❌</button>
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-visualizar').forEach(btn => btn.addEventListener('click', (e) => visualizarRelatorio(e.currentTarget.dataset.id)));
        document.querySelectorAll('.btn-excluir').forEach(btn => btn.addEventListener('click', (e) => excluirRelatorio(e.currentTarget.dataset.id)));
    }
    
    async function carregarDadosDoFirebase() {
        const q = query(collection(db, "relatorios"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        relatoriosCache = [];
        querySnapshot.forEach((doc) => {
            relatoriosCache.push({ id: doc.id, ...doc.data() });
        });
        renderizarTabela();
        // Você pode adicionar chamadas para atualizar dashboard e gráficos aqui se desejar
    }

    formNovoRelatorio.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        try {
            const uploadedEvidencias = [];
            for (const file of selectedFiles) {
                const storageRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                uploadedEvidencias.push({ name: file.name, url: downloadURL });
            }

            const novoRelatorio = {
                data: document.getElementById('data').value || new Date().toISOString().split('T')[0],
                turno: document.getElementById('turno').value,
                produto: document.getElementById('produto').value,
                lote: document.getElementById('lote').value,
                status: document.getElementById('status').value,
                descricao: document.getElementById('descricao').value,
                inspetor: 'Você',
                evidencias: uploadedEvidencias,
                timestamp: new Date()
            };

            await addDoc(collection(db, "relatorios"), novoRelatorio);

            formNovoRelatorio.reset();
            selectedFiles = [];
            renderizarPreviews();
            alert('Relatório registrado com sucesso!');
            atualizarTudo();
            document.querySelector('.nav-link[data-target="registros"]').click();

        } catch (error) {
            console.error("Erro ao registrar relatório: ", error);
            alert("Ocorreu um erro ao salvar o relatório.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Registrar Relatório';
        }
    });

    evidenciasInput.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files);
        renderizarPreviews();
    });

    function renderizarPreviews() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.classList.add('preview-item');
                previewItem.innerHTML = `<img src="${e.target.result}" alt="${file.name}"><button type="button" class="remove-btn" data-index="${index}">&times;</button>`;
                previewContainer.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
        setTimeout(adicionarListenersRemover, 100);
    }
    
    function adicionarListenersRemover() {
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                selectedFiles.splice(index, 1);
                evidenciasInput.value = ""; // Limpa a seleção de arquivos
                renderizarPreviews();
            });
        });
    }

    async function atualizarTudo() {
        await carregarDadosDoFirebase();
        // Adicione aqui as funções de atualizar dashboard e gráficos
    }

    // --- INICIALIZAÇÃO DO APP ---
    atualizarTudo();
});
