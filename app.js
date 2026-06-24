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
function showDashboard() {
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

// Iniciar a sessão SOMENTE após todas as funções estarem definidas
checkSession();
