const SUPABASE_URL = 'https://ckrxvzdpggintxnuzegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh2emRwZ2dpbnR4bnV6ZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTk5ODEsImV4cCI6MjA5MTA3NTk4MX0.M-SLZdLROnynTyYE-iimwlrWFCMAizVr-z0X7suw1jg';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências HTML
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const tbodyItens = document.getElementById('tbody-itens');
const msgLogin = document.getElementById('login-msg');

let currentCode = null;

// 1. CHECAR SE JÁ TEM CÓDIGO SALVO
function checkSession() {
    const savedCode = localStorage.getItem('sublimaster_codigo');
    if (savedCode) {
        currentCode = savedCode;
        showDashboard();
    }
}
checkSession();

// 2. SISTEMA DE LOGIN (SALA / CÓDIGO)
document.getElementById('btn-login').addEventListener('click', async () => {
    const inputCode = document.getElementById('codigo-acesso').value.trim().toUpperCase();

    if (inputCode.length < 3) {
        msgLogin.innerText = "Digite um código válido (mínimo 3 letras).";
        return;
    }

    msgLogin.innerText = "Entrando...";
    msgLogin.style.color = "#E0E0E0";

    // Salva o código localmente e entra
    currentCode = inputCode;
    localStorage.setItem('sublimaster_codigo', currentCode);
    showDashboard();
});

// LOGOUT
document.getElementById('btn-logout').addEventListener('click', async () => {
    localStorage.removeItem('sublimaster_codigo');
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    currentCode = null;
    document.getElementById('codigo-acesso').value = "";
    msgLogin.innerText = "";
});

// TROCAR TELA
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadOrders();
    if (tbodyItens.children.length === 0) adicionarLinha();
}

// 3. TABELA DINÂMICA DE TAMANHOS
document.getElementById('btn-add-item').addEventListener('click', adicionarLinha);

function adicionarLinha() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="inp-nome" placeholder="Opcional"></td>
        <td><input type="text" class="inp-numero" placeholder="Opcional"></td>
        <td><input type="text" class="inp-adic" placeholder="Ex: Goleiro"></td>
        <td><input type="text" class="inp-tamanho" placeholder="P, M, G..." list="lista-tamanhos" style="text-transform:uppercase;"></td>
        <td><input type="number" class="inp-qtd" value="1" min="1" style="width:70px;"></td>
        <td style="text-align:center;"><button class="btn-text" onclick="this.closest('tr').remove()" title="Remover Linha">✖</button></td>
    `;
    tbodyItens.appendChild(tr);
}

let editingOrderId = null;

// 4. LANÇAR OU ATUALIZAR PEDIDO (POST/UPDATE)
document.getElementById('btn-salvar').addEventListener('click', async () => {
    const cliente = document.getElementById('cliente').value.trim();
    const referencia = document.getElementById('referencia').value.trim();
    const observacoes = document.getElementById('observacoes').value.trim();
    if (!cliente && !referencia) return alert("Digite a referência ou nome do cliente!");

    const linhas = tbodyItens.querySelectorAll('tr');
    let itens = [];

    linhas.forEach(tr => {
        const tamanho = tr.querySelector('.inp-tamanho').value.trim().toUpperCase();
        const qtd = parseInt(tr.querySelector('.inp-qtd').value) || 1;
        const nome = tr.querySelector('.inp-nome').value.trim();
        const numero = tr.querySelector('.inp-numero').value.trim();
        const adic = tr.querySelector('.inp-adic').value.trim();

        if (tamanho) {
            itens.push({ Tamanho: tamanho, Quantidade: qtd, Nome: nome, Numero: numero, Adicional: adic });
        }
    });

    if (itens.length === 0) return alert("Adicione pelo menos um tamanho!");

    const msg = document.getElementById('save-msg');
    
    if (editingOrderId) {
        msg.innerText = "Atualizando pedido...";
        const { error } = await db
            .from('sublimaster_pedidos')
            .update({
                cliente: cliente,
                referencia: referencia,
                observacoes: observacoes,
                dados_pedido: itens
            })
            .eq('id', editingOrderId);

        if (error) {
            msg.style.color = "#ff5555";
            msg.innerText = "Erro: " + error.message;
        } else {
            msg.style.color = "var(--accent)";
            msg.innerText = "✅ Pedido atualizado com sucesso!";
            cancelEditMode();
            loadOrders();
            setTimeout(() => msg.innerText = "", 4000);
        }
    } else {
        msg.innerText = "Enviando pedido...";
        // Insere o pedido vinculado ao Código de Acesso atual
        const { data, error } = await db
            .from('sublimaster_pedidos')
            .insert([
                {
                    codigo_acesso: currentCode,
                    cliente: cliente,
                    referencia: referencia,
                    observacoes: observacoes,
                    status: 'PENDENTE',
                    dados_pedido: itens
                }
            ]);

        if (error) {
            msg.style.color = "#ff5555";
            msg.innerText = "Erro: " + error.message;
        } else {
            msg.style.color = "var(--accent)";
            msg.innerText = "✅ Sucesso! O CorelDRAW já pode baixar este pedido.";
            document.getElementById('cliente').value = "";
            tbodyItens.innerHTML = "";
            adicionarLinha();
            loadOrders();
            setTimeout(() => msg.innerText = "", 4000);
        }
    }
});

function cancelEditMode() {
    editingOrderId = null;
    document.getElementById('cliente').value = "";
    document.getElementById('referencia').value = "";
    document.getElementById('observacoes').value = "";
    tbodyItens.innerHTML = "";
    adicionarLinha();
    document.getElementById('btn-salvar').innerHTML = '<i class="ph ph-paper-plane-tilt"></i><span>Enviar para Confecção</span>';
    
    const btnCancel = document.getElementById('btn-cancel-edit');
    if (btnCancel) btnCancel.remove();
}

// 5. HISTÓRICO DE PEDIDOS DO CÓDIGO (GET)
async function loadOrders() {
    const lista = document.getElementById('lista-pedidos');
    lista.innerHTML = "<p style='color:#999; font-size:13px;'>Buscando histórico da confecção...</p>";

    // Puxa apenas os pedidos deste código!
    const { data, error } = await db
        .from('sublimaster_pedidos')
        .select('id, cliente, referencia, observacoes, status, created_at, dados_pedido')
        .eq('codigo_acesso', currentCode)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        lista.innerHTML = "Erro de conexão.";
        return;
    }

    lista.innerHTML = "";
    if (data.length === 0) {
        lista.innerHTML = "<p style='color:#999; font-size:13px;'>Nenhum pedido foi enviado para este código ainda.</p>";
        return;
    }

    // Guardar os dados em uma variável global temporária para facilitar a edição
    window.loadedOrders = data;

    data.forEach(pedido => {
        const li = document.createElement('li');
        const dataStr = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        const horaStr = new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const statusClass = pedido.status === 'Pendente' ? 'status-pendente' : 'status-baixado';

        let totalPecas = 0;
        pedido.dados_pedido.forEach(item => totalPecas += item.Quantidade);

        const statusIcon = pedido.status === 'Pendente' ? '<i class="ph-fill ph-clock"></i>' : '<i class="ph-fill ph-check-circle"></i>';

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong style="font-size: 1.05rem;">${pedido.referencia ? pedido.referencia + ' - ' : ''}${pedido.cliente}</strong>
                    ${pedido.observacoes ? `<div style="font-size:12px; color:#aaa; margin-top:4px;"><i class="ph ph-text-align-left"></i> ${pedido.observacoes}</div>` : ''}
                    <div style="font-size:13px; color:var(--text-hint); margin-top:6px; display:flex; align-items:center; gap:6px;">
                        <i class="ph ph-calendar-blank"></i> ${dataStr} às ${horaStr} &bull; 
                        <i class="ph ph-t-shirt"></i> ${totalPecas} Peça(s)
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <span class="status-tag ${statusClass}">${statusIcon} ${pedido.status}</span>
                    <div class="actions" style="display:flex; gap: 8px;">
                        <button class="btn-text btn-edit" onclick="editOrder('${pedido.id}')" title="Editar"><i class="ph ph-pencil"></i></button>
                        <button class="btn-text btn-status" onclick="changeStatus('${pedido.id}', '${pedido.status}')" title="Mudar Status"><i class="ph ph-arrows-clockwise"></i></button>
                        <button class="btn-text btn-delete" style="color:#ff5555;" onclick="deleteOrder('${pedido.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        lista.appendChild(li);
    });
}

// 6. AÇÕES DE GERENCIAMENTO
window.editOrder = function(id) {
    const pedido = window.loadedOrders.find(p => p.id === id);
    if (!pedido) return;

    editingOrderId = id;
    document.getElementById('cliente').value = pedido.cliente || "";
    document.getElementById('referencia').value = pedido.referencia || "";
    document.getElementById('observacoes').value = pedido.observacoes || "";
    tbodyItens.innerHTML = "";
    
    pedido.dados_pedido.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="inp-nome" value="${item.Nome || ''}"></td>
            <td><input type="text" class="inp-numero" value="${item.Numero || ''}"></td>
            <td><input type="text" class="inp-adic" value="${item.Adicional || ''}"></td>
            <td><input type="text" class="inp-tamanho" value="${item.Tamanho || ''}" list="lista-tamanhos" style="text-transform:uppercase;"></td>
            <td><input type="number" class="inp-qtd" value="${item.Quantidade || 1}" min="1" style="width:70px;"></td>
            <td style="text-align:center;"><button class="btn-text" onclick="this.closest('tr').remove()" title="Remover Linha">✖</button></td>
        `;
        tbodyItens.appendChild(tr);
    });

    if (tbodyItens.children.length === 0) adicionarLinha();

    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.innerHTML = '<i class="ph ph-pencil-simple"></i><span>Atualizar Pedido</span>';
    
    if (!document.getElementById('btn-cancel-edit')) {
        const btnCancel = document.createElement('button');
        btnCancel.id = 'btn-cancel-edit';
        btnCancel.className = 'btn-outline';
        btnCancel.style.marginLeft = '10px';
        btnCancel.innerHTML = 'Cancelar';
        btnCancel.onclick = cancelEditMode;
        btnSalvar.parentNode.appendChild(btnCancel);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteOrder = async function(id) {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    
    const { error } = await db.from('sublimaster_pedidos').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message);
    else loadOrders();
};

let statusOrderId = null;
const statusModal = document.getElementById('status-modal');

window.changeStatus = function(id, currentStatus) {
    statusOrderId = id;
    document.getElementById('novo-status').value = currentStatus.toUpperCase() || "PENDENTE";
    statusModal.classList.remove('hidden');
};

document.getElementById('btn-cancel-status').addEventListener('click', () => {
    statusModal.classList.add('hidden');
    statusOrderId = null;
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    if (!statusOrderId) return;
    const newStatus = document.getElementById('novo-status').value;
    statusModal.classList.add('hidden');
    
    const { error } = await db.from('sublimaster_pedidos').update({ status: newStatus }).eq('id', statusOrderId);
    if (error) alert("Erro ao mudar status: " + error.message);
    else loadOrders();
});
