-- =========================================================================================
-- ATUALIZAÇÃO DA FUNÇÃO DE GERAR TRIAL (CORREÇÃO DE CLIENTE)
-- =========================================================================================

CREATE OR REPLACE FUNCTION public.generate_trial_license(p_name text, p_whatsapp text, p_machine_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_key text;
    v_customer_id uuid;
BEGIN
    -- 1. Cria o cliente na tabela customers primeiro (para evitar erro de chave estrangeira)
    v_customer_id := gen_random_uuid();
    INSERT INTO public.customers (id, name, phone)
    VALUES (v_customer_id, p_name, p_whatsapp);

    -- 2. Gera uma chave aleatória no formato "A1B2-C3D4-E5F6", SEM a palavra TRIAL na frente
    v_new_key := upper(substring(md5(random()::text) from 1 for 4)) || '-' || 
                 upper(substring(md5(random()::text) from 5 for 4)) || '-' ||
                 upper(substring(md5(random()::text) from 9 for 4));

    -- 3. Insere na tabela de licenças amarrando ao cliente criado
    INSERT INTO public.licenses (license_key, customer_id, plan, status, max_machines, expires_at)
    VALUES (v_new_key, v_customer_id, 'trial', 'active', 1, now() + interval '15 days');

    -- 4. Registra imediatamente a máquina do cliente na tabela de ativações
    INSERT INTO public.license_activations (license_key, machine_id, machine_name)
    VALUES (v_new_key, p_machine_id, p_name);

    -- Retorna sucesso e a chave gerada para a Macro
    RETURN jsonb_build_object(
        'status', 'success',
        'trial_key', v_new_key,
        'message', 'Licença de teste gerada com sucesso.'
    );
END;
$$;
