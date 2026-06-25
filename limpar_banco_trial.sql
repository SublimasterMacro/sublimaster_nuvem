-- =========================================================================================
-- SCRIPT DE LIMPEZA GERAL DE CHAVES "TRIAL" ANTIGAS
-- =========================================================================================

-- 0. Limpar os logs de validação primeiro! 
-- (Se não apagarmos os logs, o Supabase bloqueia a exclusão da licença por segurança)
DELETE FROM public.validation_log
WHERE license_id IN (
    SELECT id FROM public.licenses WHERE license_key LIKE 'TRIAL-%'
);

-- 1. Limpar os pedidos antigos que ficaram orfãos dessas chaves.
-- (Fazemos isso antes de apagar a tabela cloud_accounts para sabermos de quem eram os pedidos)
DELETE FROM public.sublimaster_pedidos
WHERE codigo_acesso IN (
    SELECT codigo_acesso FROM public.cloud_accounts WHERE license_key LIKE 'TRIAL-%'
);

-- 2. Limpar a tabela de contas nuvem que estavam ligadas a essas chaves.
DELETE FROM public.cloud_accounts
WHERE license_key LIKE 'TRIAL-%';

-- 3. Finalmente, deletar todas as licenças que começam com a palavra "TRIAL-"
-- (Isso apaga automaticamente a licença e as máquinas atreladas na license_activations).
DELETE FROM public.licenses 
WHERE license_key LIKE 'TRIAL-%';
