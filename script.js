document.addEventListener('DOMContentLoaded', () => {
    // Importa o jsPDF globalmente
    const { jsPDF } = window.jspdf;

    // --- DADOS DE EXEMPLO (Simulando um banco de dados) ---
    let relatoriosDB = []; // Começaremos com o banco de dados vazio para um exemplo mais limpo

    // --- ELEMENTOS DO DOM ---
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const formNovoRelatorio = document.getElementById('form-novo-relatorio');
    const tabelaCorpo = document.getElementById('tabela-registros-corpo');
    const evidenciasInput = document.getElementById('evidencias');
    const previewContainer = document.getElementById('preview-container');
    
    // NOVO: Elementos da Modal
    const modalContainer = document.getElementById('modal-visualizacao');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalImagens = document.getElementById('modal-imagens');

    let selectedFiles = []; // Array para guardar os arquivos selecionados temporariamente

    // --- LÓGICA DE NAVEGAÇÃO ---
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
    
    // --- NOVO: LÓGICA DA MODAL ---
    function abrirModal() {
        modalContainer.classList.remove('hidden');
    }
    function fecharModal() {
        modalContainer.classList.add('hidden');
    }
    modalCloseBtn.addEventListener('click', fecharModal);
    modalOverlay.addEventListener('click', fecharModal);


    // --- FUNÇÕES DE AÇÃO DA TABELA ---
    function visualizarRelatorio(id) {
        const relatorio = relatoriosDB.find(r => r.id === id);
        if (!relatorio) return;

        // Limpa conteúdo anterior
        modalBody.innerHTML = '';
        modalImagens.innerHTML = '';

        // Preenche detalhes do relatório
        modalBody.innerHTML = `
            <p><strong>Data:</strong> ${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p><strong>Turno:</strong> ${relatorio.turno}</p>
            <p><strong>Produto:</strong> ${relatorio.produto}</p>
            <p><strong>Lote:</strong> ${relatorio.lote}</p>
            <p><strong>Status:</strong> <span class="status-tag ${relatorio.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme'}">${relatorio.status}</span></p>
            <p><strong>Inspetor:</strong> ${relatorio.inspetor}</p>
            ${relatorio.descricao ? `<p><strong>Descrição:</strong> ${relatorio.descricao}</p>` : ''}
        `;
        
        // Preenche as imagens
        if (relatorio.evidencias && relatorio.evidencias.length > 0) {
            document.querySelector('.modal-imagens-container').style.display = 'block';
            relatorio.evidencias.forEach(evidencia => {
                const imgItem = document.createElement('div');
                imgItem.classList.add('preview-item');
                imgItem.innerHTML = `<img src="${evidencia.url}" alt="${evidencia.name}">`;
                modalImagens.appendChild(imgItem);
            });
        } else {
            document.querySelector('.modal-imagens-container').style.display = 'none';
        }

        abrirModal();
    }

    function excluirRelatorio(id) {
        if (confirm('Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.')) {
            relatoriosDB = relatoriosDB.filter(r => r.id !== id);
            atualizarTudo();
        }
    }

    function gerarPDFRelatorio(id) {
        // (A função de gerar PDF continua a mesma)
        const relatorio = relatoriosDB.find(r => r.id === id);
        if (relatorio) {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('Relatório de Inspeção de Qualidade', 14, 22);
            doc.setFontSize(12);
            doc.text(`ID do Relatório: ${relatorio.id}`, 14, 32);
            doc.line(14, 35, 196, 35);
            doc.text(`Data: ${new Date(relatorio.data + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 45);
            doc.text(`Turno: ${relatorio.turno}`, 14, 52);
            doc.text(`Produto Inspecionado: ${relatorio.produto}`, 14, 59);
            doc.text(`Lote / Ordem de Produção: ${relatorio.lote}`, 14, 66);
            doc.text(`Inspetor: ${relatorio.inspetor}`, 14, 73);
            doc.setFont('helvetica', 'bold');
            doc.text('Status da Inspeção:', 14, 85);
            doc.setTextColor(relatorio.status === 'Conforme' ? '#00875a' : '#de350b');
            doc.text(relatorio.status.toUpperCase(), 60, 85);
            doc.setTextColor('#000000');
            doc.setFont('helvetica', 'normal');
            if (relatorio.status === 'Não Conforme') {
                doc.setFont('helvetica', 'bold');
                doc.text('Descrição da Ocorrência:', 14, 97);
                doc.setFont('helvetica', 'normal');
                const textoDescricao = doc.splitTextToSize(relatorio.descricao, 180);
                doc.text(textoDescricao, 14, 104);
            }
            if (relatorio.evidencias && relatorio.evidencias.length > 0) {
                 doc.setFont('helvetica', 'bold');
                 doc.text('Evidências Anexadas (nomes dos arquivos):', 14, 125)
                 doc.setFont('helvetica', 'normal');
                 doc.text(relatorio.evidencias.map(e => e.name).join(', '), 14, 132);
            }
            doc.save(`Relatorio_Qualidade_${relatorio.id}_${relatorio.lote}.pdf`);
        }
    }

    function adicionarEventListenersAcoes() {
        document.querySelectorAll('.btn-visualizar').forEach(btn => {
            btn.addEventListener('click', (e) => visualizarRelatorio(parseInt(e.currentTarget.dataset.id)));
        });
        document.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', (e) => excluirRelatorio(parseInt(e.currentTarget.dataset.id)));
        });
        document.querySelectorAll('.btn-pdf').forEach(btn => {
            btn.addEventListener('click', (e) => gerarPDFRelatorio(parseInt(e.currentTarget.dataset.id)));
        });
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderizarTabela() {
        tabelaCorpo.innerHTML = '';
        const relatoriosOrdenados = [...relatoriosDB].sort((a, b) => new Date(b.data) - new Date(a.data));
        relatoriosOrdenados.forEach(relatorio => {
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
                    <button class="btn-pdf" data-id="${relatorio.id}" title="Gerar PDF">📄</button>
                    <button class="btn-excluir" data-id="${relatorio.id}" title="Excluir">❌</button>
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });
        adicionarEventListenersAcoes();
    }

    function atualizarDashboard() {
        const hoje = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const relatoriosHoje = relatoriosDB.filter(r => r.data === hoje).length;
        const relatoriosMes = relatoriosDB.filter(r => r.data >= inicioMes);
        const naoConformesMes = relatoriosMes.filter(r => r.status === 'Não Conforme').length;
        const taxaConformidade = relatoriosMes.length ? (((relatoriosMes.length - naoConformesMes) / relatoriosMes.length) * 100).toFixed(1) : '100.0';
        document.getElementById('kpi-total-hoje').textContent = relatoriosHoje;
        document.getElementById('kpi-total-mes').textContent = relatoriosMes.length;
        document.getElementById('kpi-nao-conformes').textContent = naoConformesMes;
        document.getElementById('kpi-taxa-conformidade').textContent = `${taxaConformidade}%`;
        const listaAtividades = document.getElementById('lista-atividades-recentes');
        listaAtividades.innerHTML = '';
        const atividadesRecentes = [...relatoriosDB].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
        atividadesRecentes.forEach(r => {
            const li = document.createElement('li');
            li.innerHTML = `<span><strong>${r.produto}</strong> (${r.lote})</span><span class="status-tag ${r.status === 'Conforme' ? 'status-conforme' : 'status-nao-conforme'}">${r.status}</span>`;
            listaAtividades.appendChild(li);
        });
    }

    // --- LÓGICA DO FORMULÁRIO ---
    formNovoRelatorio.addEventListener('submit', (e) => {
        e.preventDefault();
        const maiorId = relatoriosDB.reduce((max, r) => r.id > max ? r.id : max, 0);
        const novoRelatorio = {
            id: maiorId + 1,
            data: document.getElementById('data').value || new Date().toISOString().split('T')[0],
            turno: document.getElementById('turno').value,
            produto: document.getElementById('produto').value,
            lote: document.getElementById('lote').value,
            status: document.getElementById('status').value,
            descricao: document.getElementById('descricao').value,
            inspetor: 'Você',
            // ALTERAÇÃO: Salva um objeto com o nome e a URL temporária da imagem
            evidencias: selectedFiles.map(file => ({
                name: file.name,
                url: URL.createObjectURL(file) // Cria a URL temporária
            }))
        };
        relatoriosDB.unshift(novoRelatorio);
        formNovoRelatorio.reset();
        selectedFiles = [];
        renderizarPreviews();
        atualizarTudo();
        document.querySelector('.nav-link[data-target="registros"]').click();
        alert('Relatório registrado com sucesso!');
    });

    // --- LÓGICA PARA PRÉ-VISUALIZAÇÃO DE IMAGENS ---
    evidenciasInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!selectedFiles.some(f => f.name === file.name)) {
                selectedFiles.push(file);
            }
        });
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
                renderizarPreviews();
            });
        });
    }

    // --- GRÁFICOS (CHART.JS) ---
    let relatoriosChart, ocorrenciasChart, statusChart;
    
    function inicializarGraficos() {
        Chart.defaults.font.family = "'Poppins', sans-serif";
        const options = { responsive: true, maintainAspectRatio: false };
        relatoriosChart = new Chart(document.getElementById('relatoriosChart').getContext('2d'), { type: 'bar', data: { datasets: [{ label: '# de Relatórios', backgroundColor: 'rgba(0, 82, 204, 0.7)' }] }, options });
        ocorrenciasChart = new Chart(document.getElementById('ocorrenciasChart').getContext('2d'), { type: 'doughnut', data: { datasets: [{ backgroundColor: ['#de350b', '#ffab00', '#0052cc', '#00875a', '#5243aa'] }] }, options });
        statusChart = new Chart(document.getElementById('statusChart').getContext('2d'), { type: 'pie', data: { labels: ['Conforme', 'Não Conforme'], datasets: [{ backgroundColor: ['var(--cor-sucesso)', 'var(--cor-falha)'] }] }, options });
    }
    
    function atualizarGraficos() {
        const dataUltimos7Dias = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dataUltimos7Dias[d.toISOString().split('T')[0]] = 0;
        }
        relatoriosDB.forEach(r => {
            if (dataUltimos7Dias[r.data] !== undefined) dataUltimos7Dias[r.data]++;
        });
        relatoriosChart.data.labels = Object.keys(dataUltimos7Dias).map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        relatoriosChart.data.datasets[0].data = Object.values(dataUltimos7Dias);
        relatoriosChart.update();
        const ocorrencias = {};
        relatoriosDB.filter(r => r.status === 'Não Conforme').forEach(r => {
            ocorrencias[r.produto] = (ocorrencias[r.produto] || 0) + 1;
        });
        ocorrenciasChart.data.labels = Object.keys(ocorrencias);
        ocorrenciasChart.data.datasets[0].data = Object.values(ocorrencias);
        ocorrenciasChart.update();
        const conformes = relatoriosDB.filter(r => r.status === 'Conforme').length;
        const naoConformes = relatoriosDB.filter(r => r.status === 'Não Conforme').length;
        statusChart.data.datasets[0].data = [conformes, naoConformes];
        statusChart.update();
    }
    
    function atualizarTudo() {
        renderizarTabela();
        atualizarDashboard();
        if (relatoriosChart) {
             atualizarGraficos();
        }
    }

    // --- INICIALIZAÇÃO DO APP ---
    inicializarGraficos();
    atualizarTudo();
});