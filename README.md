# DDS Control - GitHub Pages

Versão estática do DDS Control preparada para GitHub Pages.

Arquitetura:

```text
GitHub Pages
  -> React / Vite
  -> Firebase Authentication
  -> Cloud Firestore
  -> Cloudflare Worker
       -> Hashdata API
```

O token Hashdata fica apenas no Cloudflare Worker.

Leia `GUIA-PUBLICACAO.md` antes de publicar.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Build

```bash
npm run build
```

O resultado fica em `dist/`.
