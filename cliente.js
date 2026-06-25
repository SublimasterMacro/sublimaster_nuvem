const SUPABASE_URL = 'https://ckrxvzdpggintxnuzegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh2emRwZ2dpbnR4bnV6ZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTk5ODEsImV4cCI6MjA5MTA3NTk4MX0.M-SLZdLROnynTyYE-iimwlrWFCMAizVr-z0X7suw1jg';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

let currentPedido = null;

// Telas
const loadingScreen = document.getElementById('loading-screen');
const clientScreen = document.getElementById('client-screen');
const formContainer = document.getElementById('form-container');
const readonlyContainer = document.getElementById('readonly-container');

document.addEventListener('DOMContentLoaded', initClientApp);

async function initClientApp() {
    if (!token) {
        showError("Link inválido. O token de acesso está ausente.");
        return;
    }

    // Buscar pedido pelo token anônimo
    const { data, error } = await db
        .from('sublimaster_pedidos')
        .select('*')
        .eq('link_token', token)
        .single();

    if (error || !data) {
        showError("Pedido não encontrado ou link expirado.");
        return;
    }

    currentPedido = data;

    // Verificar expiração caso o status ainda seja "Aguardando"
    if (data.status === 'Aguardando Preenchimento') {
        if (data.expires_at) {
            const expDate = new Date(data.expires_at);
            const now = new Date();
            if (now > expDate) {
                showError("Este link já expirou o prazo de preenchimento.");
                return;
            }
        }
    }

    document.getElementById('pedido-cliente').innerText = `Pedido: ${data.cliente}`;
    renderStatus(data.status);

    // Esconde o loading e mostra a tela do cliente
    loadingScreen.classList.add('hidden');
    clientScreen.classList.remove('hidden');

    // Se estiver aguardando preenchimento ou pendente, mostra o formulário de edição
    if (data.status === 'Aguardando Preenchimento' || data.status === 'Pendente') {
        formContainer.classList.remove('hidden');
        readonlyContainer.classList.add('hidden');
        
        const tbodyItens = document.getElementById('tbody-itens');
        tbodyItens.innerHTML = "";
        
        if (data.dados_pedido && data.dados_pedido.length > 0) {
            data.dados_pedido.forEach(item => adicionarLinha(item));
        } else {
            adicionarLinha(); // Adiciona linha vazia para começar
        }
    } 
    // Caso contrário (Em produção, Finalizado, Baixado), é somente leitura!
    else {
        formContainer.classList.add('hidden');
        readonlyContainer.classList.remove('hidden');
        renderReadonlyTable(data.dados_pedido);
    }
    
    // Buscar telefone da confecção para o card de ajuda (visível em todas as telas)
    const { data: licenseData } = await db
        .from('licencas_v2')
        .select('telefone')
        .eq('chave', data.codigo_acesso)
        .single();
        
    if (licenseData && licenseData.telefone) {
        document.getElementById('help-card').style.display = 'block';
        document.getElementById('support-phone-text').innerText = licenseData.telefone;
        document.getElementById('btn-support-whatsapp').href = `https://wa.me/55${licenseData.telefone.replace(/\D/g, '')}`;
    }
}

function showError(msg) {
    loadingScreen.innerHTML = `
        <div style="text-align: center;">
            <i class="ph-fill ph-warning-circle text-error" style="font-size: 64px; margin-bottom: 15px;"></i>
            <h2 style="color: var(--text-main); font-weight: 600; margin-bottom: 10px;">Ops!</h2>
            <p style="color: var(--text-hint); font-size: 1.1rem; max-width: 400px; margin: 0 auto;">${msg}</p>
        </div>
    `;
}

function renderStatus(status) {
    const container = document.getElementById('status-container');
    let color = "var(--text-hint)";
    let icon = "ph-info";
    
    if (status === 'Aguardando Preenchimento') { color = "var(--warning)"; icon = "ph-hourglass-high"; }
    else if (status === 'Pendente') { color = "#3b82f6"; icon = "ph-paper-plane-tilt"; }
    else if (status === 'Em Produção' || status === 'Produção' || status === 'Baixado') { color = "var(--accent)"; icon = "ph-gear ph-spin"; }
    else if (status === 'Finalizado' || status === 'Concluído') { color = "#10b981"; icon = "ph-check-circle"; }
    
    container.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:${color}; font-size: 0.95rem; padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 6px;"><i class="ph ${icon}"></i> Status: ${status}</span>`;
}

window.adicionarLinha = function(item = null) {
    const tbodyItens = document.getElementById('tbody-itens');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="inp-nome" placeholder="Nome (Opcional)" value="${item && item.Nome ? item.Nome : ''}"></td>
        <td><input type="text" class="inp-numero" placeholder="Num." value="${item && item.Numero ? item.Numero : ''}"></td>
        <td><input type="text" class="inp-adic" placeholder="Ex: Goleiro" value="${item && item.Adicional ? item.Adicional : ''}"></td>
        <td><input type="text" list="tamanhos-list" class="inp-tamanho" placeholder="Ex: M" value="${item && item.Tamanho ? item.Tamanho : ''}" style="text-transform:uppercase;"></td>
        <td><input type="number" class="inp-qtd" value="${item && item.Quantidade ? item.Quantidade : 1}" min="1" style="width:70px;"></td>
        <td style="text-align:center;"><button class="btn-icon-only" onclick="this.closest('tr').remove()" title="Remover Linha"><i class="ph ph-x" style="font-weight: bold; font-size: 16px;"></i></button></td>
    `;
    tbodyItens.appendChild(tr);
    
    // Auto-scroll no mobile
    if (window.innerWidth <= 768) {
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.salvarPedido = async function() {
    const linhas = document.querySelectorAll('#tbody-itens tr');
    let itens = [];
    
    linhas.forEach(linha => {
        const nome = linha.querySelector('.inp-nome').value.trim();
        const numero = linha.querySelector('.inp-numero').value.trim();
        const adic = linha.querySelector('.inp-adic').value.trim();
        const tamanho = linha.querySelector('.inp-tamanho').value.trim().toUpperCase();
        const qtd = parseInt(linha.querySelector('.inp-qtd').value) || 1;
        
        if (tamanho) {
            itens.push({ Tamanho: tamanho, Quantidade: qtd, Nome: nome, Numero: numero, Adicional: adic });
        }
    });

    if (itens.length === 0) return alert("Preencha ao menos um tamanho para enviar o pedido.");

    const msg = document.getElementById('save-msg');
    const btnSalvar = document.getElementById('btn-salvar');
    
    msg.innerText = "Salvando dados...";
    btnSalvar.disabled = true;
    
    const { error } = await db
        .from('sublimaster_pedidos')
        .update({
            dados_pedido: itens,
            status: 'Pendente' // Muda o status para pendente para alertar a confecção
        })
        .eq('link_token', token);

    if (error) {
        msg.style.color = "#ff5555";
        msg.innerText = "Erro ao salvar: " + error.message;
        btnSalvar.disabled = false;
    } else {
        msg.style.color = "var(--accent)";
        msg.innerText = "✅ Pedido enviado com sucesso!";
        renderStatus('Pendente');
        
        setTimeout(() => {
            msg.innerText = "";
            btnSalvar.disabled = false;
        }, 4000);
    }
}

function renderReadonlyTable(itens) {
    const tbody = document.getElementById('tbody-readonly');
    tbody.innerHTML = "";
    
    if (!itens || itens.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 20px; color: var(--text-hint);'>Nenhum item adicionado.</td></tr>";
        return;
    }
    
    itens.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        
        tr.innerHTML = `
            <td style="padding: 12px 10px;">${item.Nome || '-'}</td>
            <td style="padding: 12px 10px;">${item.Numero || '-'}</td>
            <td style="padding: 12px 10px;">${item.Adicional || '-'}</td>
            <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main);">${item.Tamanho}</td>
            <td style="padding: 12px 10px; text-align: center; font-weight: 600;">${item.Quantidade}</td>
        `;
        tbody.appendChild(tr);
    });
}
