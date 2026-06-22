// Mágica! A Chave foi quebrada e a URL descoberta a partir dela.
const SUPABASE_URL = 'https://ckrxvzdpgintxnuzegxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh2emRwZ2dpbnR4bnV6ZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTk5ODEsImV4cCI6MjA5MTA3NTk4MX0.M-SLZdLROnynTyYE-iimwlrWFCMAizVr-z0X7suw1jg';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências HTML
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const tbodyItens = document.getElementById('tbody-itens');
const msgLogin = document.getElementById('login-msg');

let currentUser = null;

// 1. CHECAR SESSÃO AO ABRIR O SITE
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
    }
}
checkSession();

// 2. SISTEMA DE LOGIN
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('senha').value;
    
    msgLogin.innerText = "Conectando aos servidores...";
    msgLogin.style.color = "#E0E0E0";
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        msgLogin.style.color = "#ff5555";
        msgLogin.innerText = "Erro: " + error.message;
    } else {
        currentUser = data.user;
        showDashboard();
    }
});

// LOGOUT
document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    currentUser = null;
});

// TROCAR TELA
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadOrders();
    // Se a tabela estiver vazia, adiciona a primeira linha
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

    // Lendo a tabela
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
    msg.innerText = "Lançando pedido no banco de dados...";

    // Inserindo no Supabase (Mágica!)
    const { data, error } = await supabase
        .from('sublimaster_pedidos')
        .insert([
            {
                user_id: currentUser.id,
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
        
        // Limpar tela para o próximo pedido
        document.getElementById('cliente').value = "";
        tbodyItens.innerHTML = "";
        adicionarLinha();
        loadOrders(); // Atualiza histórico
        
        setTimeout(() => msg.innerText = "", 4000);
    }
});

// 5. HISTÓRICO DE PEDIDOS (GET)
async function loadOrders() {
    const lista = document.getElementById('lista-pedidos');
    lista.innerHTML = "<p style='color:#999; font-size:13px;'>Buscando histórico...</p>";

    // Graças ao RLS (Row Level Security), o cliente só vai ver os pedidos dele!
    const { data, error } = await supabase
        .from('sublimaster_pedidos')
        .select('cliente, status, created_at, dados_pedido')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        lista.innerHTML = "Erro de conexão.";
        return;
    }

    lista.innerHTML = "";
    if (data.length === 0) {
        lista.innerHTML = "<p style='color:#999; font-size:13px;'>Nenhum pedido foi lançado ainda.</p>";
        return;
    }

    data.forEach(pedido => {
        const li = document.createElement('li');
        const dataStr = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        const horaStr = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        const statusClass = pedido.status === 'Pendente' ? 'status-pendente' : 'status-baixado';
        
        // Quantidade total de peças no array JSON
        let totalPecas = 0;
        pedido.dados_pedido.forEach(item => totalPecas += item.Quantidade);

        li.innerHTML = `
            <div>
                <strong>${pedido.cliente}</strong>
                <div style="font-size:12px; color:var(--text-hint); margin-top:4px;">
                    ${dataStr} às ${horaStr} • ${totalPecas} Peça(s)
                </div>
            </div>
            <span class="${statusClass}">${pedido.status}</span>
        `;
        lista.appendChild(li);
    });
}
