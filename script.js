// O Firebase usa um sistema de módulos. Importamos as funções que vamos usar.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, orderBy, query } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// =========================================================================================
// COLE AQUI O SEU OBJETO firebaseConfig QUE VOCÊ SALVOU NO PASSO A PASSO ANTERIOR
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

// O restante do seu código, agora completo e adaptado para o Firebase
document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    let relatoriosCache = []; // Cache local para evitar múltiplas leituras do DB

    // --- Seleção de Elementos do DOM ---
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
    let relatoriosChart, ocorrenciasChart, statusChart;

    // --- Navegação e Modal ---
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
            pages.forEach(page => page.classList.toggle('active', page.id === targetId));
        });
    });

    // --- Ações da Tabela (Visualizar, Excluir, PDF) ---
    function visualizarRelatorio(id) {
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
                imgItem.innerHTML = `<a href="${evidencia.url}" target="_blank" title="Clique para abrir em nova aba"><img src="${evidencia.url}" alt="${evidencia.name}"></a>`;
                modalImagens.appendChild(imgItem);
            });
        } else {
            document.querySelector('.modal-imagens-container').style.display = 'none';
        }
        abrirModal();
    }

    async function excluirRelatorio(id) {
        if (!confirm('Tem certeza que deseja excluir este relatório? As imagens também serão apagadas permanentemente.')) return;
        
        try {
            const relatorio = relatoriosCache.find(r => r.id === id);
            // Deleta as imagens do Storage primeiro
            if (relatorio.evidencias && relatorio.evidencias.length > 0) {
                for (const evidencia of relatorio.evidencias) {
                    const imageRef = ref(storage, evidencia.url);
                    await deleteObject(imageRef);
                }
            }
            // Deleta o registro do Firestore
            await deleteDoc(doc(db, "relatorios", id));
            alert('Relatório excluído com sucesso!');
            atualizarTudo();
        } catch (error) {
            console.error("Erro ao excluir relatório: ", error);
            alert("Falha ao excluir o relatório. Verifique o console para mais detalhes.");
        }
    }

    function gerarPDFRelatorio(id) {
        const relatorio = relatoriosCache.find(r => r.id === id);
        if (relatorio) {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('Relatório de Inspeção de Qualidade', 14, 22);
            doc.setFontSize(12);
            doc.text(`ID: ${relatorio.id}`, 14, 32);
            doc.line(14, 35, 196, 35);
            doc.text(`Data: ${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 45);
            doc.text(`Produto: ${relatorio.produto}`, 14, 52);
            doc.text(`Lote: ${relatorio.lote}`, 14, 59);
            if (relatorio.descricao) {
                const textoDescricao = doc.splitTextToSize(`Descrição: ${relatorio.descricao}`, 180);
                doc.text(textoDescricao, 14, 73);
            }
            if (relatorio.evidencias && relatorio.evidencias.length > 0) {
                 doc.text(`Evidências: ${relatorio.evidencias.map(e => e.name).join(', ')}`, 14, 100);
            }
            doc.save(`Relatorio_Qualidade_${relatorio.lote}.pdf`);
        }
    }

    // --- Renderização da Interface (Tabela, Dashboard, Gráficos) ---
    function renderizarTabela() {
        tabelaCorpo.innerHTML = '';
        relatoriosCache.forEach(relatorio => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${relatorio.produto}</td>
                <td>${relatorio.lote}</td>
                <td><span class="status-tag ${relatorio.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme'}">${relatorio.status}</span></td>
                <td>${relatorio.inspetor}</td>
                <td class="action-buttons">
                    <button class="btn-visualizar" data-id="${relatorio.id}" title="Visualizar">👁️</button>
                    <button class="btn-pdf" data-id="${relatorio.id}" title="Gerar PDF">📄</button>
                    <button class="btn-excluir" data-id="${relatorio.id}" title="Excluir">❌</button>
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-visualizar').forEach(btn => btn.addEventListener('click', (e) => visualizarRelatorio(e.currentTarget.dataset.id)));
        document.querySelectorAll('.btn-pdf').forEach(btn => btn.addEventListener('click', (e) => gerarPDFRelatorio(e.currentTarget.dataset.id)));
        document.querySelectorAll('.btn-excluir').forEach(btn => btn.addEventListener('click', (e) => excluirRelatorio(e.currentTarget.dataset.id)));
    }

    function atualizarDashboard() {
        const hoje = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        const relatoriosHoje = relatoriosCache.filter(r => r.data === hoje).length;
        const relatoriosMes = relatoriosCache.filter(r => r.data >= inicioMes);
        const naoConformesMes = relatoriosMes.filter(r => r.status === 'Não Conforme').length;
        const taxaConformidade = relatoriosMes.length ? (((relatoriosMes.length - naoConformesMes) / relatoriosMes.length) * 100).toFixed(1) : '100.0';

        document.getElementById('kpi-total-hoje').textContent = relatoriosHoje;
        document.getElementById('kpi-total-mes').textContent = relatoriosMes.length;
        document.getElementById('kpi-nao-conformes').textContent = naoConformesMes;
        document.getElementById('kpi-taxa-conformidade').textContent = `${taxaConformidade}%`;

        const listaAtividades = document.getElementById('lista-atividades-recentes');
        listaAtividades.innerHTML = '';
        relatoriosCache.slice(0, 5).forEach(r => {
            const li = document.createElement('li');
            li.innerHTML = `<span><strong>${r.produto}</strong> (${r.lote})</span><span class="status-tag ${r.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme'}">${r.status}</span>`;
            listaAtividades.appendChild(li);
        });
    }

    function inicializarGraficos() {
        Chart.defaults.font.family = "'Poppins', sans-serif";
        const options = { responsive: true, maintainAspectRatio: false };
        relatoriosChart = new Chart(document.getElementById('relatoriosChart').getContext('2d'), { type: 'bar', data: { datasets: [{ label: '# de Relatórios', backgroundColor: 'rgba(0, 82, 204, 0.7)' }] }, options });
        ocorrenciasChart = new Chart(document.getElementById('ocorrenciasChart').getContext('2d'), { type: 'doughnut', data: { datasets: [{ backgroundColor: ['#de350b', '#ffab00', '#0052cc', '#00875a', '#5243aa'] }] }, options });
        statusChart = new Chart(document.getElementById('statusChart').getContext('2d'), { type: 'pie', data: { labels: ['Conforme', 'Não Conforme'], datasets: [{ backgroundColor: ['var(--cor-sucesso)', 'var(--cor-falha)'] }] }, options });
    }

    function atualizarGraficos() {
        // Gráfico de Relatórios por Dia
        const dataUltimos7Dias = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dataUltimos7Dias[d.toISOString().split('T')[0]] = 0;
        }
        relatoriosCache.forEach(r => {
            if (dataUltimos7Dias[r.data] !== undefined) dataUltimos7Dias[r.data]++;
        });
        relatoriosChart.data.labels = Object.keys(dataUltimos7Dias).map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        relatoriosChart.data.datasets[0].data = Object.values(dataUltimos7Dias);
        relatoriosChart.update();

        // Gráfico de Ocorrências por Produto
        const ocorrencias = {};
        relatoriosCache.filter(r => r.status === 'Não Conforme').forEach(r => {
            ocorrencias[r.produto] = (ocorrencias[r.produto] || 0) + 1;
        });
        ocorrenciasChart.data.labels = Object.keys(ocorrencias);
        ocorrenciasChart.data.datasets[0].data = Object.values(ocorrencias);
        ocorrenciasChart.update();

        // Gráfico de Status
        const conformes = relatoriosCache.filter(r => r.status === 'Conforme').length;
        const naoConformes = relatoriosCache.filter(r => r.status === 'Não Conforme').length;
        statusChart.data.datasets[0].data = [conformes, naoConformes];
        statusChart.update();
    }
    
    // --- Lógica do Formulário e Upload ---
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
            await atualizarTudo();
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
                evidenciasInput.value = ""; 
                renderizarPreviews();
            });
        });
    }

    // --- Função Principal de Carregamento e Atualização ---
    async function atualizarTudo() {
        const q = query(collection(db, "relatorios"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        relatoriosCache = [];
        querySnapshot.forEach((doc) => {
            relatoriosCache.push({ id: doc.id, ...doc.data() });
        });
        
        renderizarTabela();
        atualizarDashboard();
        atualizarGraficos();
    }

    // --- INICIALIZAÇÃO DO APP ---
    inicializarGraficos();
    atualizarTudo();
});
