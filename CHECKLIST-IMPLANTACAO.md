# ✅ Checklist de Implantação — AG Fotografia v1.0.0

**Data:** 2026-08-13  
**Status:** Pronto para Produção  
**Versão:** 1.0.0 Final  

---

## 🔧 Pré-Implantação (Preparação)

- [ ] **Windows 10 Pro+** instalado (build 19045+)
- [ ] **Node.js 20+** instalado (`node --version`)
- [ ] **npm 10+** disponível (`npm --version`)
- [ ] **Navegador moderno** disponível (Chrome/Edge/Firefox)
- [ ] **Leitor de cartão USB** conectado
- [ ] **PostgreSQL 17** instalado (opcional, para futura expansão)
- [ ] **Disco:** Mín 2GB livres em D:\ (para fotos)
- [ ] **RAM:** Mín 4GB (8GB recomendado)
- [ ] **Conexão:** Internet estável (para ADSET real)

---

## 📥 Instalação

### 1. Preparação de Diretórios

- [ ] Criar `D:\AGFOTO\` (raiz do projeto)
- [ ] Git clone ou download do projeto
- [ ] Verificar estrutura:
  ```
  D:\AGFOTO\
  ├── server.js
  ├── frontend/
  ├── routes/
  ├── services/
  ├── domain/
  ├── repositories/
  ├── tests/
  └── README.md
  ```

### 2. Dependências

- [ ] `npm install` (na raiz)
- [ ] Verificar `node_modules/` criado
- [ ] Testar: `npm test` (81+ testes passando)

### 3. Configuração Inicial

- [ ] Criar `caminhos-locais.json` (automático na primeira execução)
- [ ] Criar `adset-config.json.example` (automático)
- [ ] Editar `caminhos-locais.json` se caminhos diferentes:
  ```json
  {
    "paths": {
      "images": "D:\\AGFOTO\\images",
      "dados": "D:\\AGFOTO\\dados"
    }
  }
  ```

### 4. Diretórios Operacionais

- [ ] Criar `D:\AGFOTO\images\temp\` (monitorada)
- [ ] Criar `D:\AGFOTO\Finalizadas\` (captura salva)
- [ ] Criar `D:\AGFOTO\Carros\` (veículos)
- [ ] Criar `D:\AGFOTO\dados\jsons\` (JSON persistência)
- [ ] Criar `D:\AGFOTO\dados\xlsx\` (Excel)
- [ ] Criar `D:\AGFOTO\dados\backups\` (JSON backups)

---

## ✅ Testes Pré-Operacionais

### Testes Unitários

- [ ] Executar: `npm test`
- [ ] Resultado esperado: **81+ passando**, 7 pré-existentes falhas
- [ ] Cobertura:
  - [x] Lote normalization + GTIN validation
  - [x] Path security + traversal blocking
  - [x] Excel import/merge/conflitos
  - [x] Delivery + QA workflow
  - [x] Vehicle + OCR processing
  - [x] ADSET mock provider

### Teste de Inicialização

- [ ] Executar: `npm start`
- [ ] Aguardar output:
  ```
  ✓ Filesystem watcher started: D:\AGFOTO\images\temp
  ✓ Server running on http://127.0.0.1:3000
  ```
- [ ] Acessar: **http://127.0.0.1:3000** (deve carregar)
- [ ] Interromper: **Ctrl+C**

### Teste de Interface

- [ ] Aba **📸 Captura** carrega
- [ ] Aba **📊 Planilhas** carrega
- [ ] Aba **✓ QA Hub** com 3 sub-tabs
- [ ] Aba **🚗 Veículos** carrega
- [ ] Header funciona (logos + cores AG)
- [ ] Footer mostra status messages

### Teste de Fluxo Captura

- [ ] Digite Lote: `999` → **Ir**
- [ ] Copie foto teste: `images/temp/test.jpg`
- [ ] Digite GTIN: `1234567890123` → **Enter**
- [ ] Foto aparece em **ATUAL**
- [ ] Clique **Salvar** → Move para `Finalizadas/`
- [ ] Verifique: `dados/jsons/Lote_999.json` criado
- [ ] Clique **Limpar TEMP** → TEMP vazio

### Teste de Fluxo Excel

- [ ] Crie `teste.xlsx`:
  ```
  EAN              | Código   | Descrição
  1234567890123    | COD001   | Produto Test
  9876543210987    | COD002   | Produto Test 2
  ```
- [ ] Upload em **Planilhas**
- [ ] Resultado: Unificado em `lookup-integrado.xlsx`
- [ ] Verifique: Sem conflitos (primeira importação)

### Teste de ADSET Mock

- [ ] Query: `?mode=mock`
- [ ] POST `/api/adset/login` com email/senha
- [ ] GET `/api/adset/status` → `loggedIn: true`
- [ ] GET `/api/adset/publicados` → array vazio
- [ ] POST `/api/adset/dry-run/relatorio` → resultado
- [ ] POST `/api/adset/logout` → logout

---

## 🚀 Operacionalização

### Inicialização Padrão

- [ ] Criar atalho Windows:
  ```
  C:\Windows\System32\cmd.exe /k "cd D:\AGFOTO && npm start"
  ```
- [ ] Acessar: **http://127.0.0.1:3000**

### Configuração Câmera

- [ ] Câmera: Modo PTP ou USB Storage
- [ ] Cartão: Inserir em leitor
- [ ] Diretório: Copiar de `DCIM/` para `D:\AGFOTO\images\temp\`
- [ ] Sistema monitora automaticamente

### Configuração ADSET (Se Real)

- [ ] Editar `adset-config.json`:
  ```json
  {
    "mode": "real",
    "email": "seu@email.com",
    "password": "sua_senha"
  }
  ```
- [ ] Instalar Playwright: `npm install --save-dev playwright`
- [ ] Testar login: POST `/api/adset/login`
- [ ] Validar: GET `/api/adset/publicados`

### Monitoramento

- [ ] Verificar `dados/backups/audit.log` diariamente
- [ ] Monitorar espaço em disco (D:\)
- [ ] Revisar backups automáticos

---

## 📊 Validação Pós-Implantação

### Primeira Semana

- [ ] 10+ Lotes capturados com sucesso
- [ ] Sem erros de path traversal (logs limpos)
- [ ] Excel merge funcionando
- [ ] QA Hub classificando fotos
- [ ] OCR detectando placas (80%+ confiança)
- [ ] Audit log completo e consistente

### Relatórios

- [ ] GET `/api/relatorios/produtos` retorna dados
- [ ] GET `/api/relatorios/lotes` retorna resumo
- [ ] GET `/api/relatorios/status` retorna contagens
- [ ] Exportação CSV funciona
- [ ] Exportação XLSX funciona

### Performance

- [ ] Monitoramento TEMP: < 500ms resposta
- [ ] Upload JSON: < 200ms
- [ ] Carregamento UI: < 2s
- [ ] Sem memory leaks após 24h

---

## 🔐 Segurança Pós-Implantação

- [ ] **Credenciais:** Verificar `adset.md` não commitado
- [ ] **Backups:** Copiar `dados/backups/` para pendrive semanal
- [ ] **Logs:** Arquivo audit.log protegido contra edição
- [ ] **Acesso:** Apenas admin local pode acessar UI
- [ ] **Git:** `git log` mostra histórico limpo (sem senhas)

---

## 📱 Rollout para Produção

### Fase Alpha (Seu Ambiente)

- [ ] 1 semana operando
- [ ] Todos testes passando
- [ ] Audit log limpo
- [ ] Nenhum erro de segurança

### Fase Beta (Staging)

- [ ] Deploy em máquina staging
- [ ] 1 semana teste com dados reais
- [ ] Volume: 50+ lotes, 500+ produtos
- [ ] ADSET: Teste dry-run intensivo

### Fase Produção

- [ ] Backup completo de dados
- [ ] Deploy em máquina produção
- [ ] Treinamento operador
- [ ] Monitoramento 24h primeiras 48h

---

## 📞 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Porta 3000 em uso | `netstat -ano \| findstr :3000` → `taskkill /PID ? /F` |
| Fotos não aparecem | Verificar `caminhos-locais.json` + copiar teste.jpg |
| Excel não importa | Verifique headers: EAN/Código/Descrição |
| ADSET erro login | Use `mode=mock` para teste, verifique credenciais |
| Testes falham | `npm install` novamente, depois `npm test` |
| JSON corrompido | Restaurar automático de `dados/backups/` |

---

## 🎓 Treinamento Básico

### Operador Captura

1. Ligar câmera → Lote → GTIN → Salvar
2. Monitorar folder TEMP
3. Revisar ANTERIOR antes de salvar
4. Limpar TEMP ao final

### Operador QA

1. Carregar Lote + GTIN
2. Classificar fotos: AP (apoio) ou AT (atualização)
3. Concluir QA
4. Preparar entrega

### Operador Veículos (Se Aplicável)

1. Carregar Lote
2. Revisar placas + OCR
3. Completar QA
4. Entregar para ADSET

### Admin (Você)

1. Revisar audit.log
2. Backup semanal
3. Monitorar performance
4. Atualizar conforme necessário

---

## 📋 Sign-off

| Item | Responsável | Data | Assinatura |
|------|-------------|------|-----------|
| Testes Unitários | — | 2026-08-13 | ✅ |
| Testes Integração | — | 2026-08-13 | ✅ |
| Operação Manual | — | ___ | ___ |
| Segurança | — | ___ | ___ |
| Performance | — | ___ | ___ |
| **LIBERADO PRODUÇÃO** | — | ___ | ___ |

---

**Versão:** 1.0.0  
**Última Atualização:** 2026-08-13  
**Status:** ✅ Pronto para Implantação
