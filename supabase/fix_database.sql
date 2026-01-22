-- =====================================================
-- DIAGNÓSTICO E CORREÇÃO DO BANCO DE DADOS
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. VERIFICAR TABELAS EXISTENTES
-- =====================================================
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Resultado esperado:
-- - months
-- - expenses
-- - (salaries pode ou não existir)


-- 2. VERIFICAR ESTRUTURA DA TABELA MONTHS
-- =====================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'months'
ORDER BY ordinal_position;

-- Colunas esperadas:
-- - id (uuid)
-- - user_id (uuid)
-- - month_code (text)
-- - label (text)
-- - closed (boolean)
-- - salary1 (numeric) ← DEVE EXISTIR
-- - salary2 (numeric) ← DEVE EXISTIR
-- - created_at (timestamp)


-- 3. VERIFICAR ESTRUTURA DA TABELA EXPENSES
-- =====================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'expenses'
ORDER BY ordinal_position;


-- 4. VERIFICAR RLS (Row Level Security)
-- =====================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('months', 'expenses');

-- Se rowsecurity = true mas não há policies, NINGUÉM consegue acessar!


-- 5. VERIFICAR POLICIES EXISTENTES
-- =====================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('months', 'expenses');

-- Se retornar VAZIO e RLS está ativo = PROBLEMA!


-- =====================================================
-- CORREÇÕES NECESSÁRIAS
-- =====================================================

-- CORREÇÃO 1: Adicionar colunas salary1 e salary2 (se não existirem)
-- =====================================================
DO $$
BEGIN
    -- Adicionar salary1
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'months' AND column_name = 'salary1'
    ) THEN
        ALTER TABLE public.months ADD COLUMN salary1 numeric DEFAULT 0;
        RAISE NOTICE 'Coluna salary1 adicionada';
    ELSE
        RAISE NOTICE 'Coluna salary1 já existe';
    END IF;

    -- Adicionar salary2
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'months' AND column_name = 'salary2'
    ) THEN
        ALTER TABLE public.months ADD COLUMN salary2 numeric DEFAULT 0;
        RAISE NOTICE 'Coluna salary2 adicionada';
    ELSE
        RAISE NOTICE 'Coluna salary2 já existe';
    END IF;
END $$;


-- CORREÇÃO 2: Criar constraint único (necessário para upsert)
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'months_user_id_month_code_key'
    ) THEN
        ALTER TABLE public.months
        ADD CONSTRAINT months_user_id_month_code_key 
        UNIQUE (user_id, month_code);
        
        RAISE NOTICE 'Constraint único criado';
    ELSE
        RAISE NOTICE 'Constraint único já existe';
    END IF;
END $$;


-- CORREÇÃO 3: Remover tabela salaries (se existir)
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'salaries'
    ) THEN
        -- Migrar dados primeiro (se houver)
        UPDATE public.months m
        SET salary1 = s.value
        FROM public.salaries s
        WHERE s.month_id = m.id 
        AND s.person_identifier = 'salary1';
        
        UPDATE public.months m
        SET salary2 = s.value
        FROM public.salaries s
        WHERE s.month_id = m.id 
        AND s.person_identifier = 'salary2';
        
        -- Deletar tabela
        DROP TABLE public.salaries;
        RAISE NOTICE 'Tabela salaries removida';
    ELSE
        RAISE NOTICE 'Tabela salaries não existe';
    END IF;
END $$;


-- CORREÇÃO 4: Configurar RLS Policies (CRÍTICO!)
-- =====================================================

-- Desabilitar RLS temporariamente se estiver causando problemas
-- ALTER TABLE public.months DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- OU configurar policies corretas:

-- Limpar policies antigas
DROP POLICY IF EXISTS "Users can view own months" ON public.months;
DROP POLICY IF EXISTS "Users can insert own months" ON public.months;
DROP POLICY IF EXISTS "Users can update own months" ON public.months;
DROP POLICY IF EXISTS "Users can delete own months" ON public.months;

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

-- Criar policies corretas para MONTHS
CREATE POLICY "Users can view own months"
    ON public.months FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own months"
    ON public.months FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own months"
    ON public.months FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own months"
    ON public.months FOR DELETE
    USING (auth.uid() = user_id);

-- Criar policies corretas para EXPENSES
CREATE POLICY "Users can view own expenses"
    ON public.expenses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
    ON public.expenses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
    ON public.expenses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
    ON public.expenses FOR DELETE
    USING (auth.uid() = user_id);

-- Garantir que RLS está ativo
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;


-- CORREÇÃO 5: Criar índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_months_user_id 
    ON public.months(user_id);

CREATE INDEX IF NOT EXISTS idx_months_month_code 
    ON public.months(month_code);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id 
    ON public.expenses(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_month_id 
    ON public.expenses(month_id);


-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Contar registros
SELECT 
    'months' as tabela,
    COUNT(*) as total_registros
FROM public.months
UNION ALL
SELECT 
    'expenses' as tabela,
    COUNT(*) as total_registros
FROM public.expenses;


-- Verificar policies criadas
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('months', 'expenses')
ORDER BY tablename, cmd;


-- =====================================================
-- TESTE RÁPIDO
-- =====================================================

-- Tentar inserir um mês de teste (substitua USER_ID_AQUI)
-- INSERT INTO public.months (user_id, month_code, label, salary1, salary2, closed)
-- VALUES (
--     auth.uid(),
--     '2025-01',
--     'Janeiro 2025',
--     5000,
--     4000,
--     false
-- );

-- Se der erro de RLS, desabilite temporariamente:
-- ALTER TABLE public.months DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;


-- =====================================================
-- MENSAGEM FINAL
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Script de correção executado!';
    RAISE NOTICE 'Verifique os resultados acima.';
    RAISE NOTICE 'Se ainda houver problemas, desabilite RLS temporariamente.';
END $$;
