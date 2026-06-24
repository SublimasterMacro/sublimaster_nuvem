-- =========================================================================================
-- SETUP DO SISTEMA DE CONTAS NUVEM (APELIDOS)
-- =========================================================================================

-- 1. Criar a tabela que faz a ligação entre o Apelido (código) e a Licença oficial
CREATE TABLE IF NOT EXISTS public.cloud_accounts (
    codigo_acesso text PRIMARY KEY,
    license_key text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- Ativar segurança na tabela
ALTER TABLE public.cloud_accounts ENABLE ROW LEVEL SECURITY;

-- 2. Função para a Macro (C#) registrar um código novo ou alterar um existente
CREATE OR REPLACE FUNCTION public.register_cloud_code(p_codigo text, p_license text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_antigo text;
BEGIN
    -- Se o código já existe mas pertence a OUTRA licença, bloqueia!
    IF EXISTS (SELECT 1 FROM public.cloud_accounts WHERE codigo_acesso = p_codigo AND license_key != p_license) THEN
        RAISE EXCEPTION 'Esse código já está em uso por outra confecção. Escolha outro.';
    END IF;

    -- Descobre se essa licença já tinha um código diferente antes
    SELECT codigo_acesso INTO v_antigo FROM public.cloud_accounts WHERE license_key = p_license;

    IF v_antigo IS NOT NULL THEN
        -- Se o usuário está MUDANDO o código dele, precisamos migrar os pedidos antigos
        IF v_antigo != p_codigo THEN
            UPDATE public.sublimaster_pedidos SET codigo_acesso = p_codigo WHERE codigo_acesso = v_antigo;
            UPDATE public.cloud_accounts SET codigo_acesso = p_codigo WHERE license_key = p_license;
        END IF;
    ELSE
        -- Primeira vez criando a conta
        INSERT INTO public.cloud_accounts (codigo_acesso, license_key) VALUES (p_codigo, p_license);
    END IF;

    RETURN true;
END;
$$;

-- 3. Atualizar a função de checagem do WebAPP para olhar a nova tabela de Apelidos
CREATE OR REPLACE FUNCTION public.check_license_web(p_chave text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license text;
BEGIN
    -- Passo 1: Busca a licença oficial ligada a esse apelido (código)
    SELECT license_key INTO v_license FROM public.cloud_accounts WHERE codigo_acesso = p_chave;
    
    -- Se não achou nenhum apelido registrado, já retorna Falso
    IF v_license IS NULL THEN
        RETURN false;
    END IF;

    -- Passo 2: Opcional, aqui verificamos se a licença é válida batendo na tabela licenses.
    -- Troque 'license_key' pelo nome da coluna certa se for diferente na tabela licenses
    RETURN EXISTS (SELECT 1 FROM public.licenses WHERE license_key = v_license);
END;
$$;
