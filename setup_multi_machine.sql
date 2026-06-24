-- =========================================================================================
-- SETUP: SUPORTE A MÚLTIPLAS MÁQUINAS POR LICENÇA (CENÁRIO 1)
-- =========================================================================================

-- 1. Adicionar a coluna max_maquinas na tabela existente licenses
-- O padrão será 1, assim todas as licenças existentes (e trials) continuarão funcionando
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_maquinas integer DEFAULT 1;

-- Opcional: Se a tabela licenses já tinha uma coluna machine_id, 
-- não vamos deletá-la para não quebrar scripts antigos, mas vamos parar de usar.

-- 2. Criar a nova tabela de registros de ativação por máquina
CREATE TABLE IF NOT EXISTS public.license_activations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    license_key text NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
    machine_id text NOT NULL,
    machine_name text,
    activated_at timestamptz DEFAULT now(),
    -- Uma mesma máquina não precisa ser inserida duas vezes para a mesma licença
    UNIQUE(license_key, machine_id)
);

-- Ativar segurança RLS (opcional)
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

-- 3. Substituir a função de validação de licenças
CREATE OR REPLACE FUNCTION public.validate_license(p_license_key text, p_machine_id text, p_machine_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_licenca record;
    v_total_ativas integer;
BEGIN
    -- Busca a licença
    SELECT * INTO v_licenca FROM public.licenses WHERE license_key = p_license_key;

    -- 1. Licença não encontrada
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Chave de licença não encontrada.');
    END IF;

    -- 2. Licença expirada ou inativa
    IF v_licenca.status != 'ativa' THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Sua licença está inativa ou expirada.');
    END IF;
    IF v_licenca.expires_at IS NOT NULL AND v_licenca.expires_at < now() THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Seu período de acesso expirou.');
    END IF;

    -- 3. Verifica se esta máquina JÁ está ativada para esta licença
    IF EXISTS (SELECT 1 FROM public.license_activations WHERE license_key = p_license_key AND machine_id = p_machine_id) THEN
        -- Já ativada! Apenas atualiza o nome da máquina e libera
        UPDATE public.license_activations SET machine_name = p_machine_name WHERE license_key = p_license_key AND machine_id = p_machine_id;
        
        -- Retorna sucesso
        RETURN jsonb_build_object(
            'status', 'success',
            'message', 'Ativado com sucesso.',
            'secrets', jsonb_build_object('fator_escala', COALESCE(v_licenca.fator_escala, 1.0))
        );
    END IF;

    -- 4. É uma máquina nova tentando usar a chave. Verifica o limite.
    SELECT COUNT(*) INTO v_total_ativas FROM public.license_activations WHERE license_key = p_license_key;

    IF v_total_ativas >= v_licenca.max_maquinas THEN
        RETURN jsonb_build_object(
            'status', 'error', 
            'message', 'Limite de máquinas atingido. Desative um computador ou contate o suporte.'
        );
    END IF;

    -- 5. Se tem espaço, registra a nova máquina e libera!
    INSERT INTO public.license_activations (license_key, machine_id, machine_name)
    VALUES (p_license_key, p_machine_id, p_machine_name);

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Máquina ativada e vinculada com sucesso!',
        'secrets', jsonb_build_object('fator_escala', COALESCE(v_licenca.fator_escala, 1.0))
    );
END;
$$;
