# Setup para Desenvolvimento — AG Fotografia

## Pré-requisitos

- **Node.js** 18+ LTS
- **npm** 9+
- **Windows 10** ou posterior (compatível com Linux/macOS)
- **Git** 2.40+

## Instalação Rápida

```bash
# 1. Clone ou navegue ao repositório
cd d:\AGFOTO

# 2. Instale dependências
npm install

# 3. Crie arquivos de configuração (exemplos)
cp ftp-config.json.example ftp-config.json
cp adset-config.json.example adset-config.json
cp caminhos-locais.json.example caminhos-locais.json
```

## Executar Desenvolvimento

### Terminal 1 — Servidor (Backend)

```bash
# Auto-reload ao salvar
npm run dev

# Ou modo normal
npm start
```

Servidor disponível em: `http://127.0.0.1:3000`

### Testes

```bash
# Todos os testes
npm test

# Apenas unitários
npm run test:unit

# Apenas integração
npm run test:integration
```

## Estrutura Frontend

```
frontend/
├─ public/
│  ├─ index.html          # Entrada HTML
│  ├─ favicon.svg         # Logo AG Foto
│  └─ css/
│     └─ main.css         # Estilos (paleta AG Foto)
└─ src/
   ├─ main.js            # Entry point Vue
   ├─ App.vue            # Componente raiz
   └─ services/
      └─ api.js          # Cliente HTTP
```

## Fluxo de Desenvolvimento — Captura

1. **Câmera grava** → `images/temp/`
2. **Frontend monitora** `GET /api/captura/temp` (2s polling)
3. **Palco Atual** mostra imagens estáveis
4. **Operador** digita Lote + GTIN
5. **Palco Anterior** carrega `GET /api/imagens/anterior`
6. **Clica Salvar** → `POST /api/captura/salvar`
   - Backend faz snapshot de TEMP
   - Copia para `Finalizadas/LOTE <N>/<GTIN>/`
   - Atualiza JSON do lote
   - Retorna contagem
7. **GTIN é limpo**, foco volta ao input

## Workflow Recomendado

### Feature nova
```bash
git checkout -b feature/nome-da-feature
npm run dev
# ... edite código
npm test
git add -A
git commit -m "Descrição"
git push origin feature/nome-da-feature
```

### Hotfix crítico
```bash
git checkout -b hotfix/nome-do-fix main
# ... corrija
npm test
git commit -m "Fix: descrição"
git checkout main
git merge --no-ff hotfix/nome-do-fix
```

## Debug

### Backend (Node.js)
```bash
# Com debug logging
DEBUG=ag-fotografia:* npm run dev

# Ou com inspector
node --inspect server.js
```

### Frontend (Vue)
```bash
# Vue DevTools extension no Chrome
# Inspecionar em http://127.0.0.1:3000

# Ou console.log no App.vue
console.log('Debug:', this.selectedLote);
```

## Configurações

### caminhos-locais.json
```json
{
  "paths": {
    "imagesTemp": "D:/Cameras/temp",
    "finalizadas": "E:/Fotos/Finalizadas"
  },
  "server": {
    "port": 3000,
    "host": "127.0.0.1"
  }
}
```

### ftp-config.json
```json
{
  "host": "ftp.seu-servidor.com",
  "port": 21,
  "username": "seu-usuario",
  "password": "sua-senha",
  "secure": true,
  "remoteRoot": "/fotos"
}
```

## Troubleshooting

### "Port 3000 already in use"
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Windows CMD
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Cannot find module 'express'"
```bash
rm -r node_modules package-lock.json
npm install
```

### Frontend não carrega imagens
- Verificar `images/temp/` existe
- Verificar permissões de leitura
- Verificar console do navegador (F12)

### JSON corrompido
- Verificar `dados/backups/` para restaurar
- Renomear arquivo inválido
- Backend restaurará automaticamente

## Próximas Fases

- [ ] **Fase 4** — Excel: importação, unificação, controle-lotes.xlsx
- [ ] **Fase 5** — QA Hub: AP, AT, FTP, retrabalho
- [ ] **Fase 6** — Relatórios: filtros, exportação, reconciliação
- [ ] **Fase 7** — Veículos: OCR, importação cartão
- [ ] **Fase 8** — ADSET: mock, dry-run, integração real
- [ ] **Fase 9** — Atualização GitHub, empacotamento

---

**Última atualização:** 2026-08-13
