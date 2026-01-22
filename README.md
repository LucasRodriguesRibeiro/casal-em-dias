# Casal em Dias

Aplicativo de organização financeira para casais.

## 🚀 Setup Local

1. Clone o repositório
2. Copie `.env.example` para `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Preencha as credenciais do Supabase em `.env.local`
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
6. Abra http://localhost:5173

## 🔧 Tecnologias

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Deploy:** Vercel
- **Estilo:** Tailwind CSS

## 📦 Scripts Disponíveis

```bash
npm run dev      # Inicia servidor de desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build de produção
```

## 🗄️ Banco de Dados

### Executar Migrations

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute os arquivos em `supabase/migrations/` na ordem

### Schema

- `months` - Dados mensais (salários, status)
- `expenses` - Despesas fixas e variáveis
- Ver `supabase/migrations/001_align_schema.sql` para detalhes

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env.local` com:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

**Importante:** Nunca commite `.env.local` no Git!

## 📝 Estrutura do Projeto

```
casal-em-dias/
├── components/          # Componentes React
├── services/           # Lógica de negócio e API
├── supabase/          # Migrations e Edge Functions
├── App.tsx            # Componente principal
├── types.ts           # TypeScript types
└── constants.ts       # Constantes da aplicação
```

## 🚢 Deploy

O projeto está configurado para deploy automático no Vercel.

1. Conecte o repositório no Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push na branch `main`

## 📄 Licença

Privado
