# Manual Operacional — AG Fotografia v1.0.0

## 🎯 Visão Geral

AG Fotografia é um sistema local (Windows) para gerenciar fluxo completo de fotografia de produtos e veículos:

1. **Captura** — Monitora câmera e organiza fotos por Lote/GTIN
2. **Planilhas** — Importa Excel com EAN/Código/Descrição, detecta conflitos
3. **QA Hub** — Classifica fotos (AP/AT), gera entregas, relatórios
4. **Veículos** — OCR de placas, agrupa fotos, prepara para ADSET
5. **ADSET** — Integração com plataforma (mock/real/dry-run)

---

## 📋 Requisitos Mínimos

- **Windows 10 Pro+** (versão 19045+)
- **Node.js 20+** (inclui npm)
- **Navegador moderno** (Chrome/Edge/Firefox)
- **PostgreSQL 17** (opcional — para futuras expansões)
- **Playwright** (instalado automaticamente se usar ADSET real)

---

## 🚀 Iniciar o Sistema

### 1. Primeira Vez

```bash
cd d:\AGFOTO
npm install                    # Instala dependências
npm start                      # Inicia servidor + watcher
```

Servidor estará disponível em: **http://127.0.0.1:3000**

### 2. Parar

Pressione **Ctrl+C** no terminal

### 3. Configurar Modo ADSET

Edite `adset-config.json` (criado automaticamente):

```json
{
  "mode": "mock",           // ou "real", "dry-run"
  "baseUrl": "https://www.adset.com.br",
  "email": "seu@email.com",
  "password": "sua_senha"
}
```

⚠️ **Aviso:** Não commite credenciais reais no git (já está em .gitignore)

---

## 📸 Fluxo de Uso

### Fase 1: Captura

1. Abra **http://127.0.0.1:3000** → Aba **📸 Captura**
2. Digite **Número do Lote** (ex: 37) e clique **Ir**
3. **Coloque cartão de câmera** em leitor USB
   - Sistema monitora `D:\AGFOTO\images\temp\` (configurável)
4. Digite **GTIN/EAN** no campo e aguarde **Enter**
   - Fotos aparecem em tempo real na aba **ATUAL (TEMP)**
5. Visualize **ANTERIOR** (últimas fotos deste GTIN) para comparar
6. Clique **Salvar** para mover para `Finalizadas/Lote_37/`
7. Limpe câmera e repita

**Saída:**
- Pasta: `Finalizadas/Lote_37/GTIN_123456789/` com JPG/PNG
- JSON: `dados/jsons/Lote_037.json` com metadados

---

### Fase 2: Planilhas

1. Aba **📊 Planilhas**
2. Upload arquivo `.xlsx` com colunas:
   - `EAN` / `Código` / `Descrição` (case-insensitive)
3. Sistema unifica com lookup master (`lookup-integrado.xlsx`)
4. **⚠️ Conflitos?** Tabela mostra divergências (valor existente vs novo)
5. Clique **Importar** para mesclar

**Saída:**
- `dados/xlsx/lookup-integrado.xlsx` atualizado
- Deduplicação automática (lote + EAN)
- Histórico em `dados/xlsx/backups/`

---

### Fase 3: QA Hub

#### 📤 Aba Entregar

1. Digite Lote
2. Clique **Carregar Produtos**
3. Tabela mostra GTINs prontos para entrega
4. Clique **Preparar** por produto → monta staging + manifest
5. Clique **Executar** → FTP upload (mock por padrão)

#### 🔍 Aba QA

1. Digite Lote + GTIN
2. Clique **Carregar Fotos**
3. Clique nos botões **AP** (apoio) ou **AT** (atualização)
4. Clique **Concluir QA** → marca como pronto
5. **Entregar** → FTP real ou mock

#### 📊 Aba Relatórios

1. Selecione **Status** (ou deixe vazio para todos)
2. Clique **Gerar Relatório**
3. Cards mostram: Total, Entregues, Pendentes, Erros
4. Tabela scrollável com detalhes
5. Scroll infinito carrega 20 itens por vez

---

### Fase 4: Veículos

1. Aba **🚗 Veículos**
2. Digite Lote
3. Clique **Carregar Veículos**
4. Tabela mostra placas, fotos, OCR, status
5. Clique **QA ✓** → valida e marca pronto
6. Clique **Entregar** → envia para ADSET (se logged in)

**Pré-requisitos para entregar:**
- ✔️ Fotos presentes
- ✔️ OCR de placa detectado
- ✔️ Confiança OCR ≥ 80%
- ✔️ Placa única (não existe em ADSET)

---

### Fase 5: ADSET Integration

#### Setup

```bash
# Editar credenciais
nano adset-config.json

# Ou usar environment variables
$env:ADSET_MODE="mock"
$env:ADSET_EMAIL="seu@email.com"
$env:ADSET_PASSWORD="sua_senha"
```

#### Modos de Operação

1. **Mock** (Padrão - Desenvolvimento)
   - Simula tudo sem conectar
   - Ideal para testes
   - Usar: `?mode=mock` na URL

2. **Dry-run** (Simulação)
   - Valida pré-requisitos
   - Registra em histórico
   - Não persiste em ADSET
   - Usar: `?mode=dry-run`

3. **Real** (Produção)
   - Conecta de verdade com Playwright
   - Requer acesso à conta ADSET
   - Upload de fotos real
   - Usar: `?mode=real`

#### API ADSET

```bash
# Login
curl -X POST http://127.0.0.1:3000/api/adset/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"sua_senha"}'

# Validar antes de entregar
curl http://127.0.0.1:3000/api/adset/validar/37/ABC1234

# Entregar
curl -X POST http://127.0.0.1:3000/api/adset/entregar/37/ABC1234

# Listar publicados
curl http://127.0.0.1:3000/api/adset/publicados

# Dry-run report
curl http://127.0.0.1:3000/api/adset/dry-run/relatorio

# Logout
curl -X POST http://127.0.0.1:3000/api/adset/logout
```

---

## 🔧 Configuração Avançada

### Caminhos Locais

Edite `caminhos-locais.json` (criado automaticamente):

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 3000,
    "lanEnabled": false
  },
  "paths": {
    "root": "D:\\AGFOTO",
    "images": "D:\\AGFOTO\\images",
    "dados": "D:\\AGFOTO\\dados"
  }
}
```

### Variáveis de Ambiente

```bash
# Habilitar LAN (ver em outros computadores)
$env:LAN_ENABLED="true"

# Mudar porta
$env:PORT="8080"

# ADSET
$env:ADSET_MODE="mock"
$env:ADSET_EMAIL="seu@email.com"
$env:ADSET_PASSWORD="sua_senha"
```

---

## 📊 Estrutura de Dados

### Pastas Operacionais

```
D:\AGFOTO\
├── images/
│   └── temp/                    # Monitora câmera aqui
├── Finalizadas/
│   └── Lote_037/
│       └── GTIN_123456789/      # Fotos salvas
├── Carros/
│   └── Lote_037/
│       └── ABC1234/             # Fotos + OCR
├── dados/
│   ├── jsons/
│   │   ├── Lote_037.json        # Metadados produtos
│   │   └── Veiculo_037.json     # Metadados veículos
│   ├── xlsx/
│   │   ├── lookup-integrado.xlsx
│   │   └── backups/
│   └── backups/                 # JSON backups automáticos
├── logs/                        # Auditoria (append-only)
└── dados/envios/               # Histórico FTP
```

### JSON Schema

**Lote_037.json:**
```json
{
  "numero": "037",
  "produtos": [
    {
      "gtin": "123456789",
      "status": "entregue",
      "fotos": 5,
      "quantidadeFotos": 5,
      "criadoEm": "2026-08-13T10:00:00Z"
    }
  ]
}
```

**Veiculo_037.json:**
```json
{
  "lote": "037",
  "vehicles": [
    {
      "placa": "ABC1234",
      "fotos": 3,
      "status": "entregue",
      "ocrConfidence": 95
    }
  ]
}
```

---

## 🔍 Troubleshooting

### Porta 3000 em Uso

```bash
# Encontrar processo
netstat -ano | findstr :3000

# Matar processo (PID = ?)
taskkill /PID 12345 /F

# Ou mudar porta em config
$env:PORT="8080"
```

### Fotos Não Aparecem

1. Verifique caminho em `caminhos-locais.json`
2. Confirme leitor USB conectado
3. Copie teste: `D:\AGFOTO\images\temp\test.jpg`
4. Revise logs: `dados/backups/audit.log`

### Excel Não Importa

- Verifique colunas: `EAN` / `Código` / `Descrição`
- Não pode ter fórmulas (bloqueadas automaticamente)
- Extensão deve ser `.xlsx` (não `.xls`)

### ADSET Conexão Falha

1. **Mock?** Use `?mode=mock` (não precisa acesso)
2. **Real?** Verifique credenciais em `adset-config.json`
3. **Playwright?** Instale: `npm install --save-dev playwright`
4. **Firewall?** Libere porta HTTPS (443)

---

## 📝 Auditoria

Todos logs em `dados/backups/audit.log` (append-only):

```
[2026-08-13T10:00:00.123Z] SERVER_START {host, port}
[2026-08-13T10:01:00.456Z] CAPTURA_SAVE {lote, gtin, fotos}
[2026-08-13T10:02:00.789Z] EXCEL_IMPORT {items, conflicts}
[2026-08-13T10:03:00.012Z] QA_CLASSIFY {lote, gtin, classification}
[2026-08-13T10:04:00.345Z] DELIVERY_EXECUTE {lote, destination}
[2026-08-13T10:05:00.678Z] VEHICLE_IMPORT {lote, vehiclesImported}
[2026-08-13T10:06:00.901Z] ADSET_DELIVER_SUCCESS {lote, placa, vehicleId}
```

---

## ⚡ Performance

- **Monitoramento TEMP:** 2s + polling fallback
- **Writes JSON:** Atômicas (temp → sync → rename)
- **Backups:** Automáticos antes de escrita
- **Timeouts:** 30s padrão (configurável)

---

## 🔐 Segurança

✔️ **Path Traversal Bloqueado:** Validação de `../` e nomes Windows reservados  
✔️ **Formula Injection Prevenido:** Bloqueia `=`, `+`, `-`, `@` em Excel  
✔️ **JSON Corrompido:** Recuperação automática de backup  
✔️ **Credenciais:** Nunca em git (.gitignore ativo)  
✔️ **Auditoria:** Todas ações registradas com redação de senhas  

---

## 📞 Suporte

- **Logs:** `dados/backups/audit.log`
- **Erros:** Console + footer (3s de exibição)
- **Git History:** `git log --oneline` para ver todas operações
- **Status:** `GET /api/health` ou `GET /api/version`

---

**Desenvolvido com ❤️ — AG Fotografia v1.0.0**  
*Sistema de Gerenciamento de Fotografia para AG Foto*
