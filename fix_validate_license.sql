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

    -- 2. Licença expirada ou inativa (Corrigido para 'active' em inglês devido a constraint da tabela)
    IF v_licenca.status != 'active' THEN
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
            'secrets', jsonb_build_object('fator_escala', 1.0)
        );
    END IF;

    -- 4. Conta quantas máquinas já estão ativadas para esta licença
    SELECT count(*) INTO v_total_ativas FROM public.license_activations WHERE license_key = p_license_key;

    -- 5. Se já atingiu o limite de máquinas, bloqueia!
    IF v_total_ativas >= v_licenca.max_machines THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Limite de máquinas atingido para esta licença.');
    END IF;

    -- 6. Como tem vaga, registra a nova máquina!
    INSERT INTO public.license_activations (license_key, machine_id, machine_name)
    VALUES (p_license_key, p_machine_id, p_machine_name);

    -- 7. Registra LOG de validação com ID real da licença (para auditoria)
    INSERT INTO public.validation_log (license_id, machine_id, ip_address)
    VALUES (v_licenca.id, p_machine_id, '127.0.0.1');

    -- Retorna sucesso
    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Ativado com sucesso.',
        'secrets', jsonb_build_object('fator_escala', 1.0)
    );
END;
$$;
