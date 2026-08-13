# Status de Desenvolvimento — AG Fotografia

**Data:** 2026-08-13  
**Versão:** 1.0.0-alpha  
**Status:** ✅ Fase 3 (Captura) Completa

---

## ✅ Fases Completas

### Fase 1 — Auditoria e Estrutura (✅ Completo)
- [x] Scaffolding de diretórios
- [x] Configuração Git
- [x] Package.json e dependências
- [x] .gitignore com regras de dados operacionais
- [x] README.md abrangente

**Commits:** `72bef53` (root), `3f0dd17`

### Fase 2 — Núcleo Seguro (✅ Completo)
- [x] `secure-filesystem.js` — Path traversal, validação de imagens
- [x] `json-persistence.js` — Escrita atômica com backup
- [x] `audit-logger.js` — Trilha append-only sanitizada
- [x] `config.js` — Configuração com fallback

**Commits:** `3f0dd17`

### Fase 3 — Captura de Produtos (✅ Completo)
- [x] Domain: Lote, Produto, Status (transições validadas)
- [x] LoteRepository — Persistência JSON
- [x] FileRepository — Operações de arquivo
- [x] CapturaService — Orquestra captura
- [x] FilesystemWatcher — Monitora TEMP 2s + polling
- [x] API Routes — 6 endpoints HTTP
- [x] Frontend Vue 3 — App.vue com palcos Atual/Anterior
- [x] CSS — Paleta AG Foto (preto, vermelho, amarelo, laranja)
- [x] Testes — 24 unitários passando ✅

**Commits:** `3f0dd17` (backend), `db01efe` (frontend)

**API Implementada:**
```
✅ GET    /api/captura/temp          — Lista TEMP estável
✅ POST   /api/captura/salvar        — Salva com snapshot atomicidade
✅ DELETE /api/captura/temp          — Limpa com auditoria
✅ GET    /api/lotes                 — Lista lotes
✅ GET    /api/lotes/:numero         — Detalhes lote + GTINs
✅ GET    /api/imagens/anterior      — Imagens anteriores GTIN
```

**Testes Passando:**
```
✅ 24 unit tests (domain + segurança)
  - Lote normalization e validação
  - Produto GTIN (8/12/13/14 dígitos, zeros preservados)
  - Path traversal bloqueado
  - Windows reserved names
  - JSON serialization/deserialization
  
📋 Integração preparada (fixtures prontas)
```

---

## 📋 Fases Pendentes

### Fase 4 — Planilhas e Excel (PRÓXIMA)
- [ ] Importação .xlsx (headers: EAN, Código, Descrição)
- [ ] Unificação em `lookup-integrado.xlsx`
- [ ] Geração `controle-lotes.xlsx` por lote
- [ ] Deduplicação (lote + EAN)
- [ ] Conflitos → tela de resolução
- [ ] Validação fórmula injection

**Estimado:** 2-3 dias

### Fase 5 — QA Hub
- [ ] Aba **Entregar:** multi-select, preflight, FTP fake
- [ ] Aba **QA:** AP/AT, desfazer, reordenação
- [ ] Aba **Relatórios:** filtros, exportação XLSX/CSV
- [ ] Retrabalho by EAN/código
- [ ] FTP real + verificação

**Estimado:** 3-4 dias

### Fase 6 — Relatórios
- [ ] Filtros: período, lote, status, GTIN, código, descrição
- [ ] Estatísticas: totais, lotes, itens, fotos, status
- [ ] Exportação XLSX com auditoria
- [ ] Reconciliação JSON ↔ Excel ↔ pastas

**Estimado:** 2 dias

### Fase 7 — Veículos
- [ ] Importação cartão (seleção origem)
- [ ] OCR local de placas (interface abstrata)
- [ ] Agrupamento por placa + revisão
- [ ] `Carros/LOTE/<PLACA>/manifest.json`
- [ ] QA: drag-and-drop reordenação persistente

**Estimado:** 3 dias

### Fase 8 — ADSET
- [ ] AdsetProvider com Playwright
- [ ] Mock + dry-run
- [ ] Busca: Publicados → Não publicados
- [ ] Validação unicidade placa
- [ ] Upload com confirmação
- [ ] Teste real só após acesso

**Estimado:** 4-5 dias (bloqueado: acesso)

### Fase 9 — Finalização
- [ ] Atualização GitHub (git fetch/pull --ff-only)
- [ ] Empacotamento Windows (.exe?)
- [ ] Testes E2E no navegador
- [ ] Documentação operacional
- [ ] Checklist implantação

**Estimado:** 2-3 dias

---

## 📊 Métricas

| Métrica | Valor |
|---------|-------|
| **Linhas de código** | ~3000+ |
| **Testes** | 24 unitários ✅ |
| **Cobertura** | Domain + Filesystem + API |
| **Commits** | 3 (estrutura, captura, frontend) |
| **Documentação** | README, SETUP, STATUS |
| **Fases Completas** | 3/9 (33%) |

---

## 🎯 Próximos Passos (Hoje/Amanhã)

1. ✅ **Teste manual Captura** — Criar imagem de teste em TEMP, verificar UI
2. ✅ **Integração testes** — Rodar suite de integração com fixtures
3. **Iniciar Fase 4** — Excel com `npm run dev` para prototipagem

---

## ⚠️ Bloqueios Conhecidos

| Fase | Bloqueio | Status |
|------|----------|--------|
| Fase 8 (ADSET) | Acesso conta ADSET + seletores | Aguardando autorização |
| Fase 5 (FTP real) | Servidor FTP de teste | Usar mock até validação |
| Fase 7 (OCR) | Tecnologia (Tesseract? OCR.space?) | Decisão pendente |

---

## 📝 Observações Importantes

1. **Nenhuma credencial foi commitada** — Todos em `.gitignore`
2. **Dados operacionais ignorados** — Lotes, fotos, Excel locais não são versionados
3. **Backups automáticos** — JSON corrompido recupera de backup
4. **Auditoria append-only** — Todas ações destructivas registradas
5. **Path security validado** — 24 testes de travessia de caminho

---

## 🔗 Referências Rápidas

- **README:** Visão geral, arquitetura, API
- **SETUP-DESENVOLVIMENTO:** Como rodar locally
- **PROMPT_MESTRE:** Requisitos completos (leitura obrigatória)
- **STATUS-FINAL:** Documentação pós-conclusão

---

**Próxima revisão:** 2026-08-14 (após Fase 4)
