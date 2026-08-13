# AG Fotografia

**Sistema de captura, QA, entrega e relatórios de fotografias de produtos e veículos**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Platform](https://img.shields.io/badge/platform-Windows-blue)

## 🎯 Visão Geral

O **AG Fotografia** é um sistema local independente para gerenciar o ciclo completo de fotografia de produtos e veículos:

1. **Captura** — Integração com câmera, armazenamento em lotes
2. **Planilhas** — Importação de EAN, código e descrição
3. **QA Hub** — Revisão, classificação e preparação para entrega
4. **Entrega** — Envio via FTP/FTPS com rastreamento
5. **Veículos** — Importação por placa, OCR, integração ADSET
6. **Relatórios** — Filtros, estatísticas e reconciliação
7. **Configuração** — Atualização GitHub, gestão de credenciais

## 🚀 Quick Start

### Pré-requisitos

- **Node.js** 18+ (LTS recomendado)
- **Windows 10** ou posterior
- **Git** (para atualizações)

### Instalação

```bash
# 1. Clone ou navegue ao repositório
cd d:\AGFOTO

# 2. Instale dependências
npm install

# 3. Crie arquivos de configuração
npm run create-examples

# 4. Edite as configurações locais (opcional)
# - caminhos-locais.json
# - ftp-config.json
# - adset-config.json

# 5. Inicie o servidor
npm start
```

O servidor estará disponível em `http://127.0.0.1:3000`

### Desenvolvimento

```bash
# Com auto-reload ao salvar arquivos
npm run dev

# Executar testes
npm test

# Testes específicos
npm run test:unit
npm run test:integration
```

## 📁 Estrutura de Diretórios

```
AGFotografia/
├─ server/                 # Backend Node.js
│  ├─ secure-filesystem.js # Validação de caminhos, imagens
│  ├─ json-persistence.js  # Escrita atômica, backups
│  ├─ audit-logger.js      # Trilha de auditoria
│  └─ config.js            # Configurações
├─ frontend/               # Vue 3 + Bootstrap
│  ├─ public/             # Assets
│  └─ src/                # Componentes, pages
├─ routes/                 # Endpoints HTTP
├─ services/               # Lógica de negócios
├─ repositories/           # Acesso a dados
├─ domain/                 # Entidades e validações
├─ tests/                  # Testes automatizados
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  └─ fixtures/
├─ docs/                   # Documentação
├─ dados/                  # Dados operacionais (git-ignored)
│  ├─ jsons/              # Lotes (Lote_37.json, etc)
│  ├─ xlsx/               # Planilhas
│  ├─ envios/             # Histórico de entrega
│  ├─ auditoria/          # Logs de auditoria
│  └─ backups/            # Backups de JSON
├─ images/temp/            # Câmera → staging transacional
├─ Captura/                # Staging durante captura
├─ Finalizadas/            # LOTE <número>/<GTIN>/<fotos>
├─ Entrega/                # LOTE <número>/<CODIGO>/
├─ Carros/                 # LOTE <número>/<PLACA>/<fotos>
├─ logs/                   # Application logs
└─ .gitignore              # Exclui dados operacionais
```

## ⚙️ Configuração

### Arquivos de Configuração

Todos os arquivos de configuração (reais) estão em `.gitignore`. Use os arquivos `.example`:

#### `caminhos-locais.json`
Define caminhos locais e parametrização de servidor:
```json
{
  "paths": {
    "imagesTemp": "D:/Cameras/temp",
    "finalizadas": "D:/Fotos/Finalizadas"
  },
  "server": {
    "port": 3000,
    "host": "127.0.0.1"
  }
}
```

#### `ftp-config.json`
Credenciais FTP/FTPS (NUNCA versionar):
```json
{
  "host": "ftp.server.com",
  "port": 21,
  "username": "user",
  "password": "NUNCA VERSIONE ISTO",
  "secure": true
}
```

#### `adset-config.json`
Configurações ADSET (apenas quando acesso fornecido):
```json
{
  "enabled": false,
  "username": "adset_user",
  "password": "CHANGE_ME",
  "dryRun": true
}
```

### Variáveis de Ambiente

```bash
# Servidor
PORT=3000
HOST=127.0.0.1
LAN_ENABLED=false

# FTP (se arquivo de config não fornecido)
FTP_HOST=ftp.server.com
FTP_PORT=21
FTP_USER=user
FTP_PASS=password
FTP_SECURE=true

# ADSET
ADSET_ENABLED=false
ADSET_USER=adset_user
ADSET_PASS=password
ADSET_DRY_RUN=true

# Camera
CAMERA_EXE=simplusCamera.exe
```

## 📊 Modelo de Dados

### Lote (JSON)

Cada lote cria `dados/jsons/Lote_<numero>.json`:

```json
{
  "schemaVersion": 1,
  "lote": "37",
  "criadoEm": "2026-08-13T14:00:00-03:00",
  "atualizadoEm": "2026-08-13T14:20:00-03:00",
  "itens": {
    "07890000000001": {
      "gtin": "07890000000001",
      "codigo": "CODIGO_123",
      "descricao": "Produto exemplo",
      "status": "pendente_qa",
      "dataFotografia": "2026-08-13T14:18:00-03:00",
      "quantidadeFotos": 8,
      "ultimaEntregaEm": null,
      "ultimoErro": null,
      "historico": [
        {
          "evento": "captura_salva",
          "em": "2026-08-13T14:18:00-03:00",
          "detalhes": { "quantidadeFotos": 8 }
        }
      ]
    }
  }
}
```

### Estados de Produto

- `em_captura` — Capturando
- `pendente_qa` — Aguardando revisão
- `pronto_para_entrega` — QA aprovado
- `entregando` — Em processo de envio
- `entregue` — Enviado com sucesso
- `erro_entrega` — Falha de envio
- `retrabalho` — Retornado para recaptura

## 🔐 Segurança

### Proteção de Caminhos

Todos os caminhos são validados antes do uso:
- ✅ Path traversal (`../`) bloqueado
- ✅ Caminhos UNC bloqueados
- ✅ Nomes reservados Windows validados
- ✅ Symlinks não permitidos
- ✅ Todas as operações contidas em raízes permitidas

### Assinatura de Imagens

Validação de imagens por assinatura, não somente extensão:
- ✅ JPG/JPEG
- ✅ PNG
- ✅ GIF
- ✅ WebP

### Credenciais

- Nunca armazenar em Git
- Usar arquivo local com `.gitignore`
- Logs sempre sanitizam passwords/tokens
- Windows Credential Manager (futuro)

### Auditoria

Todas as ações destrutivas são registradas:
- Exclusão de arquivos/fotos
- Classificação (AP/AT)
- Importação de planilhas
- Entrega/Retrabalho
- Reordenação
- Atualizações de sistema

Logs em `dados/auditoria/audit_YYYY-MM-DD.jsonl` (append-only)

## 🧪 Testes

### Executar Todos

```bash
npm test
```

### Unitários
```bash
npm run test:unit
```

Cobertura:
- Normalização GTIN/EAN/placa
- Validação de caminhos (path traversal)
- Transições de status
- Escrita atômica JSON
- Merge de Excel
- OCR agrupamento

### Integração
```bash
npm run test:integration
```

Cobertura:
- Fluxo TEMP → Salvar → Finalizadas
- Acréscimo sem sobrescrever
- QA → AP/AT → Desfazer
- FTP fake
- Retrabalho
- Importação de planilhas
- Cartão de memória

### E2E

Testes no navegador (quando frontend implementado):
- Leitor de barras
- Palcos sempre visíveis
- Ampliar/zoom/delete
- Filtros e exportação
- Drag-and-drop persistente

## 📡 API Mínima

| Método | Rota | Status |
|--------|------|--------|
| GET | `/api/health` | ✅ |
| GET | `/api/version` | ✅ |
| GET | `/api/status/camera` | 📋 |
| GET | `/api/captura/temp` | 📋 |
| POST | `/api/captura/salvar` | 📋 |
| DELETE | `/api/captura/temp` | 📋 |
| GET | `/api/lotes` | 📋 |
| POST | `/api/planilhas/importar` | 📋 |
| GET | `/api/entregas` | 📋 |
| POST | `/api/carros/importar` | 📋 |

✅ = Implementado | 📋 = Planejado

## 🚦 Fase de Desenvolvimento

- [x] **Fase 1** — Audit e estrutura base
- [ ] **Fase 2** — Núcleo seguro (filesystem, JSON, config, auditoria)
- [ ] **Fase 3** — Captura de produtos (TEMP, Lote, GTIN)
- [ ] **Fase 4** — Excel e catálogo unificado
- [ ] **Fase 5** — QA Hub (AP, AT, FTP)
- [ ] **Fase 6** — Relatórios e reconciliação
- [ ] **Fase 7** — Importação/OCR de veículos
- [ ] **Fase 8** — ADSET (mock + dry-run)
- [ ] **Fase 9** — Atualização GitHub
- [ ] **Fase 10** — Testes, empacotamento e documentação

## 📖 Documentação

- [Arquitetura](./docs/ARQUITETURA.md) — Decisões técnicas
- [Manual Operacional](./docs/MANUAL-OPERACIONAL.md) — Como usar
- [Guia de Integração FTP](./docs/FTP-INTEGRATION.md) — Validação real
- [ADSET Integration](./docs/ADSET-INTEGRATION.md) — Quando acesso fornecido

## ⚠️ Limitações Conhecidas

- **FTP/FTPS:** Testes com servidor real necessários
- **ADSET:** Apenas mock até acesso autorizado fornecido
- **OCR:** Não implementado; requer decisão de tecnologia
- **Camera:** Detecção de processo não implementada

## 🤝 Contribuição

Este é um repositório privado. Mudanças devem respeitar:

1. Branches exclusivas para features
2. Testes automatizados passando
3. Sem credenciais versionadas
4. Auditoria de todas as ações destrutivas

## 📝 Licença

PROPRIETARY — AG Fotografia

---

**Desenvolvido por:** Claude (Anthropic)  
**Data de Início:** 2026-08-13  
**Última Atualização:** 2026-08-13
