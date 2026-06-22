const SUPABASE_URL = 'https://ckrxvzdpgintxnuzegxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh2emRwZ2dpbnR4bnV6ZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTk5ODEsImV4cCI6MjA5MTA3NTk4MX0.M-SLZdLROnynTyYE-iimwlrWFCMAizVr-z0X7suw1jg';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    if(tbodyItens.children.length === 0) adicionarLinha();
}

// 3. TABELA DINÂMICA DE TAMANHOS
document.getElementById('btn-add-item').addEventListener('click', adicionarLinha);

function adicionarLinha() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="inp-tamanho" placeholder="P, M, G, GG..." style="text-transform:uppercase;"></td>
        <td><input type="number" class="inp-qtd" value="1" min="1" style="width:70px;"></td>
        <td><input type="text" class="inp-nome" placeholder="Opcional"></td>
        <td><input type="text" class="inp-numero" placeholder="Opcional"></td>
        <td style="text-align:center;"><button class="btn-text" onclick="this.closest('tr').remove()" title="Remover Linha">✖</button></td>
    `;
    tbodyItens.appendChild(tr);
}

// 4. LANÇAR PEDIDO (POST)
document.getElementById('btn-salvar').addEventListener('click', async () => {
    const cliente = document.getElementById('cliente').value;
    if (!cliente) return alert("Digite a referência ou nome do cliente!");

    const linhas = tbodyItens.querySelectorAll('tr');
    let itens = [];

    linhas.forEach(tr => {
        const tamanho = tr.querySelector('.inp-tamanho').value.trim().toUpperCase();
        const qtd = parseInt(tr.querySelector('.inp-qtd').value) || 1;
        const nome = tr.querySelector('.inp-nome').value.trim();
        const numero = tr.querySelector('.inp-numero').value.trim();
        
        if (tamanho) {
            itens.push({ Tamanho: tamanho, Quantidade: qtd, Nome: nome, Numero: numero });
        }
    });

    if (itens.length === 0) return alert("Adicione pelo menos um tamanho!");

    const msg = document.getElementById('save-msg');
    msg.innerText = "Enviando pedido...";

    // Insere o pedido vinculado ao Código de Acesso atual
    const { data, error } = await supabase
        .from('sublimaster_pedidos')
        .insert([
            {
                codigo_acesso: currentCode,
                cliente: cliente,
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
        tbodyItens.innerHTML = "";
        adicionarLinha();
        loadOrders(); 
        
        setTimeout(() => msg.innerText = "", 4000);
    }
});

// 5. HISTÓRICO DE PEDIDOS DO CÓDIGO (GET)
async function loadOrders() {
    const lista = document.getElementById('lista-pedidos');
    lista.innerHTML = "<p style='color:#999; font-size:13px;'>Buscando histórico da confecção...</p>";

    // Puxa apenas os pedidos deste código!
    const { data, error } = await supabase
        .from('sublimaster_pedidos')
        .select('cliente, status, created_at, dados_pedido')
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

    data.forEach(pedido => {
        const li = document.createElement('li');
        const dataStr = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        const horaStr = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        const statusClass = pedido.status === 'Pendente' ? 'status-pendente' : 'status-baixado';
        
        let totalPecas = 0;
        pedido.dados_pedido.forEach(item => totalPecas += item.Quantidade);

        const statusIcon = pedido.status === 'Pendente' ? '<i class="ph-fill ph-clock"></i>' : '<i class="ph-fill ph-check-circle"></i>';

        li.innerHTML = `
            <div>
                <strong style="font-size: 1.05rem;">${pedido.cliente}</strong>
                <div style="font-size:13px; color:var(--text-hint); margin-top:6px; display:flex; align-items:center; gap:6px;">
                    <i class="ph ph-calendar-blank"></i> ${dataStr} às ${horaStr} &bull; 
                    <i class="ph ph-t-shirt"></i> ${totalPecas} Peça(s)
                </div>
            </div>
            <span class="status-tag ${statusClass}">${statusIcon} ${pedido.status}</span>
        `;
        lista.appendChild(li);
    });
}
