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
async function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    // Preenche as datas de entrega automaticamente (Daqui a 20 dias)
    const d = new Date();
    d.setDate(d.getDate() + 20);
    const dataFormatada = d.toISOString().split('T')[0];
    if(document.getElementById('data-entrega')) document.getElementById('data-entrega').value = dataFormatada;
    if(document.getElementById('link-data-entrega')) document.getElementById('link-data-entrega').value = dataFormatada;

    window.setupRealtimeSubscription();
    loadOrders();
    suggestNextReference();
    if (tbodyItens.children.length === 0) adicionarLinha();

    // Decide a aba inicial: Dashboard (se tem dados) ou Meus Pedidos (se vazio)
    const { count, error } = await db
        .from('sublimaster_pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('codigo_acesso', currentCode);

    if (!error && count && count > 0) {
        switchTab('tab-dashboard');
    } else {
        switchTab('tab-pedidos');
    }
}

// 3. TABELA DINÂMICA DE TAMANHOS
function adicionarLinha() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="inp-nome" placeholder="Opcional"></td>
        <td><input type="text" class="inp-numero" placeholder="Opcional"></td>
        <td><input type="text" class="inp-adic" placeholder="Ex: Goleiro"></td>
        <td><input type="text" list="tamanhos-list" class="inp-tamanho" placeholder="P, M, G..." style="text-transform:uppercase;"></td>
        <td><input type="number" class="inp-qtd" value="1" min="1" style="width:70px;"></td>
        <td style="text-align:center;"><button class="btn-icon-only" onclick="this.closest('tr').remove()" title="Remover Linha"><i class="ph ph-x" style="font-weight: bold; font-size: 16px;"></i></button></td>
    `;
    tbodyItens.appendChild(tr);
}
window.adicionarLinha = adicionarLinha; // expõe para o onclick no HTML

document.getElementById('btn-add-item').addEventListener('click', adicionarLinha);

document.getElementById('btn-clear-list').addEventListener('click', () => {
    if(confirm("Deseja realmente limpar todos os itens da tabela?")) {
        tbodyItens.innerHTML = "";
        adicionarLinha();
    }
});

// checkSession() é chamado no final do arquivo para garantir que todas as funções já foram definidas

let editingOrderId = null;

// 4. LANÇAR OU ATUALIZAR PEDIDO (POST/UPDATE)
document.getElementById('btn-salvar').addEventListener('click', async () => {
    const clienteName = document.getElementById('cliente').value.trim();
    const referencia = document.getElementById('referencia').value.trim();
    const dataEntregaRaw = document.getElementById('data-entrega').value;
    
    if (!clienteName && !referencia) return alert("Digite o nome do cliente ou a referência do pedido!");

    // Formata a data de entrega
    let strEntrega = "";
    if (dataEntregaRaw) {
        const [y, m, d] = dataEntregaRaw.split('-');
        strEntrega = ` - Entrega: ${d}/${m}/${y}`;
    }

    // Concatena com separador " | " para o banco de dados (que usa apenas uma coluna)
    let clienteStr = "";
    if (referencia && clienteName) clienteStr = referencia + " | " + clienteName + strEntrega;
    else if (referencia) clienteStr = referencia + " | " + strEntrega;
    else clienteStr = " | " + clienteName + strEntrega;

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
                cliente: clienteStr,
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
                    cliente: clienteStr,
                    status: 'Pendente',
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
            document.getElementById('referencia').value = "";
            tbodyItens.innerHTML = "";
            adicionarLinha();
            loadOrders();
            suggestNextReference();
            setTimeout(() => msg.innerText = "", 4000);
        }
    }
});

function cancelEditMode() {
    editingOrderId = null;
    document.getElementById('cliente').value = "";
    document.getElementById('referencia').value = "";
    tbodyItens.innerHTML = "";
    adicionarLinha();
    document.getElementById('btn-salvar').innerHTML = '<i class="ph ph-paper-plane-tilt"></i><span>Enviar para Confecção</span>';
    
    const btnCancel = document.getElementById('btn-cancel-edit');
    if (btnCancel) btnCancel.remove();
    const btnShare = document.getElementById('btn-share-link');
    if (btnShare) btnShare.remove();
}

// Gera (ou reutiliza) um link compartilhável para o pedido
async function shareOrderLink(orderId) {
    const pedido = window.loadedOrders.find(p => p.id === orderId);
    if (!pedido) return;

    const msg = document.getElementById('save-msg');

    // Se já tem token, reutiliza
    if (pedido.link_token) {
        const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
        const link = urlBase + 'cliente.html?token=' + pedido.link_token;
        await navigator.clipboard.writeText(link);
        msg.style.color = 'var(--accent)';
        msg.innerText = '✅ Link copiado!';
        setTimeout(() => msg.innerText = '', 4000);
        return;
    }

    // Gera um novo token
    const token = generateUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias de validade

    const { error } = await db
        .from('sublimaster_pedidos')
        .update({ link_token: token, expires_at: expiresAt.toISOString(), cliente_view: true })
        .eq('id', orderId);

    if (error) {
        msg.style.color = 'var(--error)';
        msg.innerText = 'Erro ao gerar link: ' + error.message;
        return;
    }

    const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
    const link = urlBase + 'cliente.html?token=' + token;
    await navigator.clipboard.writeText(link);
    msg.style.color = 'var(--accent)';
    msg.innerText = '✅ Link gerado e copiado!';
    pedido.link_token = token; // Atualiza localmente
    setTimeout(() => msg.innerText = '', 4000);
}

// Variável global para armazenar a assinatura Realtime
let realtimeSubscription = null;

// Configura o ouvinte em tempo real para atualizar a lista de pedidos automaticamente
window.setupRealtimeSubscription = function() {
    if (realtimeSubscription) {
        db.removeChannel(realtimeSubscription);
    }
    
    // Inscreve no canal para escutar INSERT, UPDATE e DELETE na tabela sublimaster_pedidos
    realtimeSubscription = db.channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sublimaster_pedidos' },
            (payload) => {
                console.log('Mudança detectada no banco de dados:', payload);
                // Apenas recarrega a lista se o usuário já estiver com um código carregado
                if (currentCode) {
                    window.loadOrders();
                }
            }
        )
        .subscribe();
}

// 5. HISTÓRICO DE PEDIDOS DO CÓDIGO (GET)
async function loadOrders() {
    if (!currentCode) return;
    
    const lista = document.getElementById('lista-pedidos');
    lista.innerHTML = "<p style='color:#999; font-size:13px;'>Buscando histórico da confecção...</p>";

    // Puxa apenas os pedidos deste código! Aumentei o limite para pegar tanto os pendentes normais quanto os links gerados
    const { data, error } = await db
        .from('sublimaster_pedidos')
        .select('id, cliente, status, created_at, dados_pedido, link_token, expires_at')
        .eq('codigo_acesso', currentCode)
        .order('created_at', { ascending: false })
        .limit(50);

    const listaLinks = document.getElementById('lista-links');

    if (error) {
        lista.innerHTML = "Erro de conexão.";
        if(listaLinks) listaLinks.innerHTML = "Erro de conexão.";
        return;
    }

    lista.innerHTML = "";
    if(listaLinks) listaLinks.innerHTML = "";

    if (data.length === 0) {
        lista.innerHTML = "<p style='color:#999; font-size:13px;'>Nenhum pedido foi enviado para este código ainda.</p>";
        if(listaLinks) listaLinks.innerHTML = "<p style='color:#999; font-size:13px;'>Nenhum link ativo no momento.</p>";
        return;
    }

    // Guardar os dados em uma variável global temporária para facilitar a edição
    window.loadedOrders = data;

    data.forEach(pedido => {
        const li = document.createElement('li');
        const dataStr = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        const horaStr = new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let totalPecas = 0;
        if (pedido.dados_pedido && Array.isArray(pedido.dados_pedido)) {
            pedido.dados_pedido.forEach(item => totalPecas += item.Quantidade);
        }

        let statusClass = 'status-default';
        let statusIcon = '<i class="ph-fill ph-info"></i>';
        
        switch (pedido.status) {
            case 'Pendente':
                statusClass = 'status-pendente';
                statusIcon = '<i class="ph-fill ph-clock"></i>';
                break;
            case 'Baixado':
                statusClass = 'status-baixado';
                statusIcon = '<i class="ph-fill ph-download-simple"></i>';
                break;
            case 'Produção':
                statusClass = 'status-producao';
                statusIcon = '<i class="ph-fill ph-gear"></i>';
                break;
            case 'Concluído':
                statusClass = 'status-concluido';
                statusIcon = '<i class="ph-fill ph-check-circle"></i>';
                break;
            case 'Entregue':
                statusClass = 'status-entregue';
                statusIcon = '<i class="ph-fill ph-package"></i>';
                break;
            case 'Cancelado':
                statusClass = 'status-cancelado';
                statusIcon = '<i class="ph-fill ph-x-circle"></i>';
                break;
            case 'Aguardando Preenchimento':
                statusClass = 'status-aguardando';
                statusIcon = '<i class="ph-fill ph-hourglass-high"></i>';
                break;
        }

        let nomeVisual = pedido.cliente;
        // Limpar a data de entrega da exibição
        if (nomeVisual && nomeVisual.includes(' - Entrega:')) {
            nomeVisual = nomeVisual.split(' - Entrega:')[0];
        }
        if (nomeVisual && nomeVisual.includes(" | ")) {
            const pts = nomeVisual.split(" | ");
            const refP = pts[0] ? `<span style="color:var(--accent); font-weight:600; margin-right:6px;">[${pts[0]}]</span>` : "";
            nomeVisual = refP + pts[1];
        }

        let liHtml = "";

        if (pedido.status === 'Aguardando Preenchimento') {
            const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
            const linkMagico = `${urlBase}cliente.html?token=${pedido.link_token}`;
            
            let expText = "";
            if (pedido.expires_at) {
                const expDate = new Date(pedido.expires_at);
                expText = `(Expira: ${expDate.toLocaleDateString('pt-BR')} às ${expDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})})`;
            }

            liHtml = `
                <div style="display:flex; justify-content:space-between; width:100%; flex-wrap:wrap; gap:10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <strong style="font-size: 1.05rem;"><i class="ph ph-magic-wand text-accent"></i> ${nomeVisual}</strong>
                        <div style="font-size:13px; color:var(--text-hint); margin-top:6px;">
                            ${dataStr} às ${horaStr} &bull; ${expText}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                        <span class="status-tag status-pendente"><i class="ph-fill ph-hourglass-high"></i> Aguardando</span>
                        <div class="actions" style="display:flex; gap: 8px;">
                            <button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="navigator.clipboard.writeText('${linkMagico}'); alert('Link copiado!');" title="Copiar Link"><i class="ph ph-copy"></i> Copiar Link</button>
                            <button class="btn-icon-only btn-delete" style="color:#ff5555;" onclick="deleteOrder('${pedido.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
            li.innerHTML = liHtml;
            if(listaLinks) listaLinks.appendChild(li);
        } else {
            liHtml = `
                <div style="display:flex; justify-content:space-between; width:100%; flex-wrap:wrap; gap:10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <strong style="font-size: 1.05rem;">${nomeVisual}</strong>
                        <div style="font-size:13px; color:var(--text-hint); margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <i class="ph ph-calendar-blank"></i> ${dataStr} às ${horaStr} &bull; 
                            <i class="ph ph-t-shirt"></i> ${totalPecas} Peça(s)
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                        <span class="status-tag ${statusClass}">${statusIcon} ${pedido.status}</span>
                        <div class="actions" style="display:flex; gap: 8px;">
                            <button class="btn-icon-only" style="color:var(--accent);" onclick="shareOrderLink('${pedido.id}')" title="Copiar Link do Cliente"><i class="ph ph-share-network"></i></button>
                            <button class="btn-icon-only btn-edit" onclick="editOrder('${pedido.id}')" title="Editar"><i class="ph ph-pencil"></i></button>
                            <button class="btn-icon-only btn-status" onclick="changeStatus('${pedido.id}', '${pedido.status}')" title="Mudar Status"><i class="ph ph-arrows-clockwise"></i></button>
                            <button class="btn-icon-only btn-delete" style="color:#ff5555;" onclick="deleteOrder('${pedido.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
            li.innerHTML = liHtml;
            lista.appendChild(li);
        }
    });
}

// 6. AÇÕES DE GERENCIAMENTO
window.editOrder = function(id) {
    const pedido = window.loadedOrders.find(p => p.id === id);
    if (!pedido) return;

    editingOrderId = id;
    
    let ref = "";
    let cli = pedido.cliente;
    if (cli && cli.includes(" | ")) {
        const pts = cli.split(" | ");
        ref = pts[0];
        cli = pts[1];
    }
    
    // Extrair e remover a data de entrega do nome (para não duplicar ao salvar)
    if (cli && cli.includes(' - Entrega:')) {
        const entregaMatch = cli.match(/Entrega:\s*(\d{2})\/(\d{2})\/(\d{4})/);
        if (entregaMatch) {
            const isoDate = entregaMatch[3] + '-' + entregaMatch[2] + '-' + entregaMatch[1];
            document.getElementById('data-entrega').value = isoDate;
        }
        cli = cli.split(' - Entrega:')[0].trim();
    }
    
    document.getElementById('referencia').value = ref;
    document.getElementById('cliente').value = cli;
    tbodyItens.innerHTML = "";
    
    pedido.dados_pedido.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="inp-nome" value="${item.Nome || ''}"></td>
            <td><input type="text" class="inp-numero" value="${item.Numero || ''}"></td>
            <td><input type="text" class="inp-adic" value="${item.Adicional || ''}"></td>
            <td><input type="text" list="tamanhos-list" class="inp-tamanho" value="${item.Tamanho || ''}" style="text-transform:uppercase;"></td>
            <td><input type="number" class="inp-qtd" value="${item.Quantidade || 1}" min="1" style="width:70px;"></td>
            <td style="text-align:center;"><button class="btn-icon-only" onclick="this.closest('tr').remove()" title="Remover Linha"><i class="ph ph-x" style="font-weight: bold; font-size: 16px;"></i></button></td>
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

    // Botão Copiar Link (compartilhar pedido com o cliente)
    if (!document.getElementById('btn-share-link')) {
        const btnShare = document.createElement('button');
        btnShare.id = 'btn-share-link';
        btnShare.className = 'btn-secondary';
        btnShare.style.marginLeft = '10px';
        btnShare.innerHTML = '<i class="ph ph-share-network"></i> Copiar Link';
        btnShare.onclick = () => shareOrderLink(id);
        btnSalvar.parentNode.appendChild(btnShare);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteOrder = async function(id) {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
    
    const { error } = await db.from('sublimaster_pedidos').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message);
    else loadOrders();
};

window.changeStatus = async function(id, currentStatus) {
    const statuses = ['Aguardando Preenchimento', 'Pendente', 'Baixado', 'Produção', 'Concluído', 'Entregue', 'Cancelado'];
    let options = statuses.map(s => `<option value="${s}" style="background:#202024; color:#E1E1E6;" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('');
    
    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;";
    modal.innerHTML = `
        <div class="glass-panel" style="width:300px; text-align:center;">
            <h3 style="margin-bottom:15px; font-weight:600;">Alterar Status</h3>
            <select id="new-status-select" style="width:100%; padding:12px; border-radius:8px; margin-bottom:20px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border); font-size:1rem; outline:none; cursor:pointer;">
                ${options}
            </select>
            <div style="display:flex; gap:10px;">
                <button class="btn-outline" style="flex:1;" onclick="this.closest('div').parentElement.parentElement.remove()">Cancelar</button>
                <button class="btn-primary" style="flex:1; padding:8px;" onclick="confirmStatusChange('${id}', this.closest('.glass-panel').querySelector('select').value); this.closest('div').parentElement.parentElement.remove()">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmStatusChange = async function(id, newStatus) {
    const { error } = await db.from('sublimaster_pedidos').update({ status: newStatus }).eq('id', id);
    if (error) alert("Erro ao mudar status: " + error.message);
    else loadOrders();
};

// 7. SISTEMA DE ABAS E GERAÇÃO DE LINKS
window.switchTab = function(tabId) {
    document.getElementById('tab-pedidos').style.display = 'none';
    document.getElementById('tab-links').style.display = 'none';
    document.getElementById('tab-dashboard').style.display = 'none';
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--text-hint)';
    });
    
    document.getElementById(tabId).style.display = 'block';
    const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`);
    if(activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottomColor = 'var(--accent)';
        activeBtn.style.color = 'var(--text-main)';
    }

    if (tabId === 'tab-dashboard') refreshDashboard();
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

window.gerarLinkMagico = async function() {
    const ref = document.getElementById('link-referencia').value.trim();
    const nome = document.getElementById('link-cliente').value.trim();
    const validadeHoras = parseInt(document.getElementById('link-validade').value);
    const dataEntregaRaw = document.getElementById('link-data-entrega').value;
    const msg = document.getElementById('link-msg');
    
    if (!nome) {
        msg.style.color = "#ff5555";
        msg.innerText = "Digite o nome ou a equipe do cliente!";
        return;
    }
    
    // Formata a data de entrega
    let strEntrega = "";
    if (dataEntregaRaw) {
        const [y, m, d] = dataEntregaRaw.split('-');
        strEntrega = ` - Entrega: ${d}/${m}/${y}`;
    }
    
    let clienteStr = nome + strEntrega;
    if (ref) {
        clienteStr = ref + " | " + nome + strEntrega;
    }
    
    msg.style.color = "var(--text-main)";
    msg.innerText = "Gerando Link...";
    
    const token = generateUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validadeHoras);
    
    const { error } = await db
        .from('sublimaster_pedidos')
        .insert([
            {
                codigo_acesso: currentCode,
                cliente: clienteStr,
                status: 'Aguardando Preenchimento',
                dados_pedido: [], // Array vazio
                link_token: token,
                expires_at: expiresAt.toISOString(),
                cliente_view: true
            }
        ]);
        
    if (error) {
        msg.style.color = "#ff5555";
        msg.innerText = "Erro ao gerar: " + error.message;
    } else {
        msg.style.color = "var(--accent)";
        msg.innerText = "✅ Link gerado com sucesso!";
        document.getElementById('link-cliente').value = "";
        document.getElementById('link-referencia').value = "";
        loadOrders();
        suggestNextReference();
        setTimeout(() => msg.innerText = "", 4000);
    }
};

async function suggestNextReference() {
    if (!currentCode) return;

    // Busca o último pedido
    const { data, error } = await db
        .from('sublimaster_pedidos')
        .select('cliente')
        .eq('codigo_acesso', currentCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        const currentYear = new Date().getFullYear();
        document.getElementById('referencia').value = `PED-${currentYear}-0001`;
        document.getElementById('link-referencia').value = `PED-${currentYear}-0001`;
        return;
    }

    let lastRef = data.cliente;
    if (lastRef.includes(" | ")) {
        lastRef = lastRef.split(" | ")[0];
    } else {
        // Se não houver " | ", o pedido inteiro foi salvo como nome (ex: pedido antigo)
        // Não temos uma referência isolada garantida, mas podemos tentar extrair o número
    }

    // Tenta encontrar o ÚLTIMO bloco de números na string
    const match = lastRef.match(/^(.*?)(\d+)(\D*)$/);
    if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const suffix = match[3];
        
        const currentYear = new Date().getFullYear().toString();
        const lastYear = (new Date().getFullYear() - 1).toString();
        
        // Se o único número for o próprio ano, e houver texto depois (Ex: PED-2026-INTERCLASSE)
        // Isso significa que ele não usou número sequencial, então forçamos o reinício do padrão
        if ((numStr === currentYear || numStr === lastYear) && suffix.trim() !== "") {
            document.getElementById('referencia').value = `PED-${currentYear}-0001`;
            document.getElementById('link-referencia').value = `PED-${currentYear}-0001`;
            return;
        }
        
        let finalPrefix = prefix;
        let nextNumStr = "";

        // Verifica se a referência continha o ano anterior (virada de ano)
        if (prefix.includes(lastYear)) {
            finalPrefix = prefix.replace(lastYear, currentYear);
            nextNumStr = "1".padStart(numStr.length, '0'); // Reseta a contagem
        } else {
            // Mantém os zeros à esquerda (ex: 004 -> 005)
            const isPadded = numStr.startsWith('0') && numStr.length > 1;
            const nextNum = parseInt(numStr, 10) + 1;
            nextNumStr = nextNum.toString();
            if (isPadded) {
                nextNumStr = nextNumStr.padStart(numStr.length, '0');
            }
        }
        
        // Remove o sufixo (tudo o que o usuário digitar APÓS o número) para limpar o próximo
        const nextRef = finalPrefix + nextNumStr;
        document.getElementById('referencia').value = nextRef;
        document.getElementById('link-referencia').value = nextRef;
    } else {
        // Se não encontrou número nenhum, sugere o padrão inicial
        const currentYear = new Date().getFullYear();
        document.getElementById('referencia').value = `PED-${currentYear}-0001`;
        document.getElementById('link-referencia').value = `PED-${currentYear}-0001`;
    }
}
// =============================================================================
// 9. DASHBOARD — Cálculos feitos 100% no navegador, sem alterar o banco
// =============================================================================

async function refreshDashboard() {
    if (!currentCode) return;

    // Buscar TODOS os pedidos do mês atual
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await db
        .from('sublimaster_pedidos')
        .select('id, cliente, status, created_at, dados_pedido, link_token, expires_at')
        .eq('codigo_acesso', currentCode)
        .gte('created_at', firstOfMonth)
        .order('created_at', { ascending: false })
        .limit(500);

    if (error || !data) return;

    // ---------- KPIs ----------
    let pendentes = 0, producao = 0, concluidos = 0, pecasTotal = 0;
    let aguardando = [];
    let pedidosComPrazo = [];

    data.forEach(p => {
        let pecas = 0;
        if (p.dados_pedido && Array.isArray(p.dados_pedido)) {
            p.dados_pedido.forEach(item => pecas += (item.Quantidade || 0));
        }
        pecasTotal += pecas;

        switch (p.status) {
            case 'Pendente': pendentes++; break;
            case 'Produção': producao++; break;
            case 'Concluído': concluidos++; break;
        }

        if (p.status === 'Aguardando Preenchimento') {
            aguardando.push(p);
        }

        // Extrair data de entrega do campo cliente
        if (p.cliente && p.cliente.includes(' - Entrega:')) {
            const match = p.cliente.match(/Entrega:\s*(\d{2})\/(\d{2})\/(\d{4})/);
            if (match) {
                const entrega = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                if (!['Concluído', 'Entregue', 'Cancelado'].includes(p.status)) {
                    let nomeVisual = p.cliente;
                    if (nomeVisual.includes(' | ')) {
                        const pts = nomeVisual.split(' | ');
                        nomeVisual = pts[1];
                    }
                    if (nomeVisual.includes(' - Entrega:')) {
                        nomeVisual = nomeVisual.split(' - Entrega:')[0].trim();
                    }
                    pedidosComPrazo.push({
                        nome: nomeVisual,
                        ref: p.cliente.includes(' | ') ? p.cliente.split(' | ')[0] : '',
                        entrega: entrega,
                        status: p.status,
                        diasRestantes: Math.ceil((entrega - now) / (1000 * 60 * 60 * 24))
                    });
                }
            }
        }
    });

    // Animar os KPIs
    animateKPI('kpi-pendentes', pendentes);
    animateKPI('kpi-producao', producao);
    animateKPI('kpi-concluidos', concluidos);
    animateKPI('kpi-pecas-total', pecasTotal);

    // ---------- Alertas de Prazo ----------
    const alertasDiv = document.getElementById('dash-alertas');
    pedidosComPrazo.sort((a, b) => a.diasRestantes - b.diasRestantes);
    const urgentes = pedidosComPrazo.filter(p => p.diasRestantes <= 5);

    if (urgentes.length === 0) {
        alertasDiv.innerHTML = '<p style="color: var(--accent);"><i class="ph-fill ph-check-circle" style="margin-right: 6px;"></i>Nenhum prazo urgente nos próximos 5 dias. Tudo sob controle!</p>';
        document.getElementById('dash-alertas-card').style.borderColor = 'rgba(0,179,126,0.3)';
    } else {
        let html = '';
        urgentes.forEach(p => {
            let cor = 'var(--warning)';
            let icone = 'ph-warning';
            let texto = p.diasRestantes + ' dia(s)';
            if (p.diasRestantes <= 0) {
                cor = 'var(--error)';
                icone = 'ph-fire';
                texto = p.diasRestantes === 0 ? 'HOJE!' : 'ATRASADO ' + Math.abs(p.diasRestantes) + ' dia(s)';
            }
            const refTag = p.ref ? '<span style="color:var(--accent); font-weight:600; margin-right:6px;">[' + p.ref + ']</span>' : '';
            const statusKey = p.status === 'Produção' ? 'producao' : 'pendente';
            html += '<div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);">'
                + '<i class="ph-fill ' + icone + '" style="color:' + cor + '; font-size:20px; flex-shrink:0;"></i>'
                + '<div style="flex:1;">' + refTag + '<strong>' + p.nome + '</strong></div>'
                + '<span style="color:' + cor + '; font-weight:600; white-space:nowrap; font-size:0.9rem;">' + texto + '</span>'
                + '<span class="status-tag status-' + statusKey + '" style="font-size:0.75rem; padding:4px 8px;">' + p.status + '</span>'
                + '</div>';
        });
        alertasDiv.innerHTML = html;
        document.getElementById('dash-alertas-card').style.borderColor = 'rgba(247,90,104,0.4)';
    }

    // ---------- Barras de Status ----------
    const statusBars = document.getElementById('dash-status-bars');
    const statusConfig = [
        { key: 'Pendente', label: 'Pendente', color: '#FBA94C', icon: 'ph-clock' },
        { key: 'Baixado', label: 'Baixado', color: '#00B37E', icon: 'ph-download-simple' },
        { key: 'Produção', label: 'Em Produção', color: '#4da6ff', icon: 'ph-gear' },
        { key: 'Concluído', label: 'Concluído', color: '#b366ff', icon: 'ph-check-circle' },
        { key: 'Entregue', label: 'Entregue', color: '#20c997', icon: 'ph-package' },
        { key: 'Cancelado', label: 'Cancelado', color: '#ff5555', icon: 'ph-x-circle' },
    ];

    const totalPedidos = data.filter(p => p.status !== 'Aguardando Preenchimento').length;
    let barsHtml = '';
    statusConfig.forEach(s => {
        const count = data.filter(p => p.status === s.key).length;
        const pct = totalPedidos > 0 ? Math.round((count / totalPedidos) * 100) : 0;
        barsHtml += '<div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">'
            + '<div style="width:130px; display:flex; align-items:center; gap:8px; flex-shrink:0;">'
            + '<i class="ph-fill ' + s.icon + '" style="color:' + s.color + '; font-size:16px;"></i>'
            + '<span style="font-size:0.85rem; color:var(--text-hint);">' + s.label + '</span></div>'
            + '<div style="flex:1; background:rgba(255,255,255,0.05); border-radius:6px; height:24px; overflow:hidden; position:relative;">'
            + '<div class="dash-bar-fill" style="width:' + pct + '%; background:' + s.color + '; height:100%; border-radius:6px; transition: width 0.8s ease;"></div></div>'
            + '<span style="width:50px; text-align:right; font-weight:600; font-size:0.95rem; color:' + s.color + ';">' + count + '</span>'
            + '</div>';
    });
    statusBars.innerHTML = barsHtml;

    // ---------- Links Aguardando ----------
    const linksDiv = document.getElementById('dash-links-aguardando');
    if (aguardando.length === 0) {
        linksDiv.innerHTML = '<p style="color: var(--text-hint);"><i class="ph ph-check" style="margin-right:6px;"></i>Nenhum link pendente no momento.</p>';
    } else {
        let lHtml = '';
        aguardando.forEach(p => {
            let nomeVisual = p.cliente || 'Sem nome';
            if (nomeVisual.includes(' | ')) {
                const pts = nomeVisual.split(' | ');
                nomeVisual = '<span style="color:var(--accent); font-weight:600;">[' + pts[0] + ']</span> ' + pts[1];
            }
            if (nomeVisual.includes(' - Entrega:')) nomeVisual = nomeVisual.split(' - Entrega:')[0];
            const criado = new Date(p.created_at);
            const horasAtras = Math.round((now - criado) / (1000 * 60 * 60));
            let tempoStr = horasAtras < 1 ? 'Agora' : horasAtras < 24 ? horasAtras + 'h atrás' : Math.round(horasAtras / 24) + ' dia(s) atrás';
            
            lHtml += '<div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">'
                + '<div><i class="ph ph-hourglass-high" style="color:#aaa; margin-right:8px;"></i>' + nomeVisual + '</div>'
                + '<span style="color:var(--text-hint); font-size:0.85rem;">' + tempoStr + '</span>'
                + '</div>';
        });
        linksDiv.innerHTML = lHtml;
    }
}

// Animação suave nos contadores do KPI
function animateKPI(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    
    const duration = 600;
    const start = performance.now();
    
    function step(timestamp) {
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(current + (target - current) * ease);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Iniciar a sessão SOMENTE após todas as funções estarem definidas
checkSession();
