# DDS Control - Publicação no GitHub Pages

Esta versão foi adaptada para funcionar com:

- GitHub Pages: interface React/Vite
- Firebase Authentication: login
- Cloud Firestore: dados compartilhados do DDS Control
- Cloudflare Worker: proxy protegido para a API Hashdata

O token da Hashdata permanece somente no Cloudflare e nunca vai para o GitHub Pages.

## 1. Criar ou escolher o projeto Firebase

No Firebase Console:

1. Abra o projeto que será usado pelo DDS Control.
2. Em **Project settings > General**, crie um **Web App** caso ainda não exista.
3. Copie os dados de `firebaseConfig`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

Não é necessário guardar o `firebaseConfig` como segredo. A proteção dos dados é feita pelas regras do Firestore e pelo Firebase Authentication.

## 2. Habilitar o Firebase Authentication

Em **Build > Authentication > Sign-in method**:

1. Habilite **Email/Password**.
2. Google é opcional. Se não quiser usar login Google, deixe o provider Google desabilitado.
3. Em **Authentication > Settings > Authorized domains**, inclua:

```text
brunosth-rgb.github.io
```

Para teste local, `localhost` normalmente já aparece autorizado.

Crie os usuários que terão acesso em **Authentication > Users**.

## 3. Criar o Firestore

Em **Build > Firestore Database**:

1. Crie o banco padrão.
2. Comece em modo de produção.
3. Abra a aba **Rules**.
4. Copie o conteúdo do arquivo `firestore.rules` deste projeto.
5. Clique em **Publish**.

As regras do projeto permitem o acesso somente quando existe um documento de autorização para o UID do usuário.

## 4. Autorizar cada usuário

Depois de criar o usuário no Firebase Authentication:

1. Abra **Authentication > Users**.
2. Copie o **User UID**.
3. Abra **Firestore Database > Data**.
4. Crie a coleção:

```text
ddsUsers
```

5. Crie um documento usando exatamente o UID como Document ID.
6. Pode adicionar um campo apenas para identificação, por exemplo:

```text
name: "Nome do usuário"
```

Exemplo:

```text
ddsUsers
└── kL7x...abc   <- UID do Firebase Authentication
    └── name: "Operador"
```

O conteúdo desse documento não concede permissões adicionais. A existência dele é a autorização.

## 5. Configurar o Cloudflare Worker da Hashdata

A pasta `cloudflare-worker` contém o novo `worker.mjs`.

Você pode substituir o código do Worker atual por esse arquivo.

No Cloudflare, abra o Worker e configure:

### Variável normal

```text
FIREBASE_PROJECT_ID
```

Valor: o `projectId` do seu Firebase.

### Variável normal

```text
ALLOWED_ORIGINS
```

Para produção e teste local:

```text
https://brunosth-rgb.github.io,http://localhost:5173
```

### Secret

```text
HASHDATA_API_TOKEN
```

Use o token atual da API Hashdata.

O `DDS_SYNC_KEY` antigo não é mais necessário para esta versão.

Depois, faça o deploy do Worker.

Guarde a URL final. Exemplo:

```text
https://dds-hashdata-sync.SEUSUBDOMINIO.workers.dev
```

## 6. Criar o repositório no GitHub

Crie um repositório, por exemplo:

```text
dds-control
```

Envie o conteúdo desta pasta para a raiz do repositório.

A raiz deve ficar assim:

```text
.github/
app/
cloudflare-worker/
public/
src/
.env.example
firestore.rules
index.html
package.json
tsconfig.json
vite.config.ts
```

Não envie uma pasta externa contendo tudo. O `package.json` precisa estar na raiz do repositório.

## 7. Configurar as Repository Variables

No GitHub:

**Repository > Settings > Secrets and variables > Actions > Variables**

Crie estas variáveis:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
HASHDATA_WORKER_URL
```

Os seis primeiros valores vêm do `firebaseConfig`.

`HASHDATA_WORKER_URL` recebe a URL do Worker, sem barra no final. Exemplo:

```text
https://dds-hashdata-sync.SEUSUBDOMINIO.workers.dev
```

## 8. Ativar o GitHub Pages

No repositório:

1. Abra **Settings**.
2. Vá em **Pages**.
3. Em **Build and deployment > Source**, selecione:

```text
GitHub Actions
```

O arquivo `.github/workflows/deploy-pages.yml` já está pronto.

A cada `push` no branch `main`, o GitHub vai:

1. instalar as dependências;
2. compilar o Vite;
3. gerar a pasta `dist`;
4. publicar no GitHub Pages.

## 9. Primeiro acesso

Depois que o workflow terminar, abra algo como:

```text
https://brunosth-rgb.github.io/dds-control/
```

Entre com o usuário criado no Firebase Authentication.

Se aparecer:

```text
Sua conta está autenticada, mas ainda não foi autorizada para o DDS Control.
```

confira se o documento `ddsUsers/{UID}` foi criado com o UID correto.

No primeiro acesso autorizado, a aplicação cria automaticamente:

```text
ddsControl/main
```

Esse documento passa a guardar o estado compartilhado da aplicação.

## 10. Testar a Hashdata

Depois do login:

1. Abra **Configurações**.
2. Na seção Hashdata, clique em **Conferir campos**.
3. Selecione o mapeamento.
4. Faça a sincronização.

Se retornar `Acesso não autorizado`, verifique:

- se o login Firebase está ativo;
- se o UID está em `ddsUsers`;
- se `FIREBASE_PROJECT_ID` no Worker está correto;
- se as Firestore Rules foram publicadas.

Se retornar erro de origem, confira `ALLOWED_ORIGINS` no Worker.

## 11. Rodar localmente antes de publicar

Crie um arquivo `.env.local` usando `.env.example` como modelo:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_HASHDATA_WORKER_URL=https://...
```

Depois:

```bash
npm install
npm run dev
```

Abra a URL mostrada pelo Vite, normalmente:

```text
http://localhost:5173
```

## O que mudou em relação ao projeto original

### Removido do frontend

- Vinext / Next.js server runtime
- `/api/state`
- `/api/import-email`
- `/api/hashdata`
- autenticação por headers `oai-authenticated-user-*`
- dependência do D1 para o estado do painel

### Substituído por

- Firebase Authentication
- Firestore compartilhado
- importação `.msg/.eml` diretamente no navegador
- Cloudflare Worker autenticado pelo token Firebase
- build estático Vite compatível com GitHub Pages

## Observação sobre os dados atuais

Esta migração não copia automaticamente os registros que já estejam gravados no D1 do projeto antigo.

No primeiro acesso, o Firestore é inicializado com o `app/seed.json` incluído neste pacote. Se o D1 antigo já possuir dados que precisam ser preservados, faça a migração deles antes de usar a versão nova como produção.
