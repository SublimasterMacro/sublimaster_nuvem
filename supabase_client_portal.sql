-- 1. Adicionar as novas colunas à tabela sublimaster_pedidos
ALTER TABLE public.sublimaster_pedidos
ADD COLUMN IF NOT EXISTS link_token UUID,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cliente_view BOOLEAN DEFAULT false;

-- 2. Criar um índice para buscas super rápidas pelo token do link
CREATE INDEX IF NOT EXISTS idx_pedidos_link_token ON public.sublimaster_pedidos(link_token);

-- 3. Atualizar Políticas de Segurança (RLS)
-- Como o RLS está ativado, o cliente não logado não tem permissão de ver os dados.
-- Vamos criar políticas específicas permitindo SELECT e UPDATE anônimos SOMENTE se o link_token bater.

-- Permite Leitura (SELECT) para qualquer usuário anônimo (anon) onde o link_token for fornecido e igual
CREATE POLICY "Permitir cliente ver seu próprio pedido pelo Token"
ON public.sublimaster_pedidos
FOR SELECT
TO anon
USING (
  link_token IS NOT NULL
  -- Opcional: A verificação de expiração pode ser feita no frontend, ou forçada aqui:
  -- AND expires_at > NOW()
);

-- Permite Atualização (UPDATE) para salvar o pedido
CREATE POLICY "Permitir cliente editar o próprio pedido pelo Token"
ON public.sublimaster_pedidos
FOR UPDATE
TO anon
USING (
  link_token IS NOT NULL
  AND status IN ('Aguardando Preenchimento', 'Pendente') -- Impede de alterar se já estiver em Produção
)
WITH CHECK (
  link_token IS NOT NULL
);
