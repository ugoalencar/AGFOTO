# AGFOTO Fase 1 - Produtos, Captura, QA e Entrega Local

Data: 2026-08-14
Status: aprovado para planejamento

## Objetivo

Reconstruir a primeira etapa funcional do AG Fotografia como um sistema local e independente para captura, organizacao, QA, planilhas, entrega e relatorios de fotos de produtos.

Esta fase atende o documento funcional `Nome da empresa AG Fotografia.docx` e o `PROMPT_MESTRE_AG_FOTOGRAFIA.md` nos pontos de produtos. O sistema deve funcionar sem Redmine, sem Java, sem `start.jar`, sem consultas externas e sem depender de `C:\sphoto-terminais` ou `D:\Syndi_qa`.

Os projetos `C:\sphoto-terminais` e `D:\Syndi_qa` podem ser consultados apenas como referencia de fluxo e ergonomia:

- `C:\sphoto-terminais`: comportamento de captura, TEMP, palco atual/anterior, camera e movimentacao de imagens.
- `D:\Syndi_qa`: comportamento de QA Hub, miniaturas, zoom, exclusao, marcacoes e retrabalho.

Nenhum codigo, API, estado operacional, Redmine ou dependencia desses projetos sera acoplado ao AGFOTO.

## Escopo Da Fase 1

Entra nesta fase:

- Captura de produtos por lote e GTIN/EAN.
- Monitoramento local de `images/temp`.
- Integracao local com `simplusCameraLib/simplusCamera.exe`.
- JSON operacional por lote em `dados/jsons/Lote_<numero>.json`.
- Excel mestre de lookup e Excel de controle por lote.
- QA Hub de produtos com abas Entregar, QA e Relatorios.
- Classificacao AP e AT com movimentacao real de arquivos.
- Desfazer AP/AT.
- Entrega normal e entrega de atualizacao em modo seguro com staging e manifesto.
- FTP mock/local verificavel, sem marcar entregue antes de confirmar envio.
- Retrabalho por EAN/GTIN ou codigo interno.
- Auditoria local append-only.
- Testes unitarios e de integracao para os fluxos criticos.
- Correcao de documentacao que declare producao sem validacao externa.

Fica fora desta fase:

- Carros, OCR de placa e importacao por cartao de memoria.
- Integracao real com ADSET.
- Automacao real de FTP em servidor externo.
- GitHub updater.
- LAN/autenticacao multiusuario.

Esses itens ficam para fases posteriores.

## Regras De Independencia

- O AGFOTO nao consulta Redmine.
- O AGFOTO nao chama APIs ou scripts dos projetos antigos.
- O AGFOTO nao depende de `C:\sphoto-terminais`, `D:\Syndi_qa`, Java ou `start.jar`.
- Toda informacao operacional vem de pastas locais, JSONs, Excel e configuracoes locais ignoradas pelo Git.
- O servidor escuta em `127.0.0.1:3000` por padrao.

## Identidade E Interface

O frontend servido deve ser local/offline. Vue e Bootstrap devem vir de assets locais versionados ou empacotados no projeto, nao de CDN.

A interface deve exibir:

- Nome institucional: AG Fotografia.
- Logotipo textual: AG Foto.
- Paleta: preto, vermelho, amarelo e laranja.
- Navegacao principal: Captura, Planilhas, QA Hub, Relatorios/Configuracoes quando aplicavel.

Na Fase 1, a primeira tela operacional deve ser Captura. Nao deve haver landing page.

## Camera Local

O projeto agora contem `simplusCameraLib/simplusCamera.exe`. A integracao de camera e local e nao bloqueante.

Comportamentos:

- `GET /api/status/camera` detecta se ha processo `simplusCamera.exe` ou equivalente rodando.
- A interface mostra status da camera como informativo.
- Haver uma acao local para abrir `simplusCameraLib/simplusCamera.exe`.
- Se a camera nao estiver aberta, Captura, QA, Planilhas e Relatorios continuam funcionando.
- A camera grava arquivos em `images/temp`; o AGFOTO apenas monitora essa pasta.

## Captura De Produtos

### Lote

O operador informa um lote como string segura. Ao confirmar:

- cria ou seleciona `Finalizadas/LOTE <lote>/`;
- cria ou carrega `dados/jsons/Lote_<lote>.json`;
- se ja existir, informa que sera adicionado material ao lote existente;
- lista lateral direita fica vazia enquanto nao houver lote selecionado;
- quando houver lote, lista GTIN/EAN, data da foto, quantidade e status.

### GTIN/EAN

O campo aceita leitor USB como teclado ou digitacao manual. O sistema preserva zeros a esquerda.

A Fase 1 aceita qualquer sequencia numerica nao vazia, respeitando tamanho maximo configuravel. Validacao formal de GTIN pode aparecer como aviso, nao como bloqueio obrigatorio.

Enter seleciona/prepara o GTIN, mas nao move imagens do TEMP.

### Palco Atual

O palco Atual fica sempre visivel e monitora `images/temp` mesmo sem lote/GTIN.

Ele deve:

- listar imagens permitidas;
- diferenciar arquivo estavel, instavel e com erro;
- permitir excluir com confirmacao;
- permitir ampliar em modal;
- permitir zoom e navegacao por teclado;
- atualizar via watcher com fallback de polling.

### Palco Anterior

O palco Anterior fica sempre visivel, mas so carrega imagens quando lote e GTIN estao selecionados.

Ele consulta somente:

```text
Finalizadas/LOTE <lote>/<GTIN>/
```

Quando AP/AT forem exibidos, a interface deve diferenciar raiz, AP e AT.

### Salvar

Salvar exige lote, GTIN/EAN e pelo menos uma imagem estavel no TEMP.

Fluxo:

1. cria snapshot dos arquivos estaveis no inicio;
2. move somente esse snapshot para `Finalizadas/LOTE <lote>/<GTIN>/`;
3. arquivos que chegarem depois ficam no TEMP;
4. nao sobrescreve nomes existentes;
5. em colisao, gera nome deterministico;
6. atualiza JSON do lote;
7. atualiza Excel de controle;
8. registra auditoria;
9. limpa o GTIN da tela, mantem o lote e devolve foco ao campo GTIN.

Se algum arquivo falhar, o item nao deve ser marcado como salvo completo sem registrar erro. Arquivos ja movidos precisam aparecer no historico.

### Limpar TEMP

Limpar TEMP:

- mostra quantidade e nomes;
- pede confirmacao;
- remove somente arquivos permitidos dentro de `images/temp`;
- nao aceita caminho arbitrario do cliente;
- registra auditoria.

## Modelo JSON

Cada lote possui:

```text
dados/jsons/Lote_<lote>.json
```

Estrutura minima:

```json
{
  "schemaVersion": 1,
  "lote": "37",
  "criadoEm": "2026-08-14T10:00:00-03:00",
  "atualizadoEm": "2026-08-14T10:10:00-03:00",
  "itens": {
    "07890000000001": {
      "gtin": "07890000000001",
      "codigo": "CODIGO_123",
      "descricao": "Produto",
      "status": "pendente_qa",
      "dataFotografia": "2026-08-14T10:10:00-03:00",
      "quantidadeFotos": 8,
      "ultimaEntregaEm": null,
      "ultimoErro": null,
      "historico": []
    }
  }
}
```

Estados da Fase 1:

- `em_captura`;
- `pendente_qa`;
- `pronto_para_entrega`;
- `entregando`;
- `entregue`;
- `erro_entrega`;
- `retrabalho`.

Regras:

- captura salva coloca `pendente_qa`;
- concluir QA coloca `pronto_para_entrega`;
- iniciar entrega coloca `entregando`;
- falha de entrega coloca `erro_entrega`;
- confirmacao de entrega coloca `entregue`;
- retrabalho coloca `retrabalho`;
- nova captura em retrabalho volta para `pendente_qa`;
- toda listagem de GTIN/EAN/codigo mostra status.

JSON deve ser escrito com backup e fila por arquivo. Se houver JSON corrompido, o sistema preserva o arquivo, tenta restaurar backup valido e registra auditoria.

## Planilhas

O sistema deve importar planilhas `.xlsx` e planilhas legadas `.xls`. Arquivos protegidos por senha, corrompidos ou com formato nao reconhecido devem ser rejeitados com mensagem clara, sem gravar dados parciais.

O importador reconhece colunas equivalentes:

- EAN, GTIN ou EAN/GTIN;
- Codigo ou Codigo Interno;
- Descricao, Descricao SAP ou Produto.

Fluxo:

1. operador seleciona lote e arquivo;
2. backend valida extensao, assinatura, tamanho e limite de linhas;
3. backend faz preview dos itens;
4. operador confirma importacao;
5. sistema unifica em `dados/xlsx/lookup-integrado.xlsx`;
6. chave de deduplicacao: lote + EAN;
7. divergencia de codigo/descricao gera conflito;
8. conflito nao e sobrescrito automaticamente.

O sistema tambem gera `dados/xlsx/controle-lotes.xlsx`, com uma aba por lote:

```text
EAN | Codigo | Descricao | Data da foto | Quantidade de fotos | Status | Ultima entrega | Ultimo erro
```

O JSON e a fonte operacional. O Excel de controle e uma visao reconstruivel.

## QA Hub

O QA Hub possui tres abas.

### Entregar

Mostra lotes e itens fotografados. Cada linha exibe:

- GTIN/EAN;
- codigo interno;
- descricao;
- data;
- quantidade de fotos;
- status;
- acao individual;
- checkbox para selecao multipla.

Antes de enviar, o sistema mostra preflight com itens, codigos resolvidos, fotos elegiveis e destino.

Se nao houver codigo no Excel mestre, bloqueia apenas o item afetado e mostra mensagem objetiva.

### QA

Permite navegar por lote e GTIN/EAN.

Cada miniatura permite:

- ampliar;
- zoom;
- excluir com confirmacao;
- marcar AP;
- marcar AT;
- desfazer AP/AT.

Marcar AP move a imagem para:

```text
Finalizadas/LOTE <lote>/<GTIN>/AP/
```

Marcar AT move a imagem para:

```text
Finalizadas/LOTE <lote>/<GTIN>/AT/
```

Desfazer move de volta para a raiz sem sobrescrever.

Entrega normal usa somente fotos da raiz. Entrega de atualizacao usa somente fotos de `AT/`.

Concluir QA so e permitido quando existir pelo menos uma foto elegivel para o tipo escolhido.

### Relatorios

Filtros minimos:

- periodo;
- lote;
- status;
- GTIN/EAN;
- codigo;
- descricao.

Relatorio mostra totais de lotes, itens, pendentes, prontos, entregues, erro, retrabalho e quantidade de fotos.

Exportacao CSV entra nesta fase. Exportacao XLSX pode usar o mesmo servico de Excel.

## Entrega

Entrega e por item.

Entrega normal:

```text
Entrega/LOTE <lote>/<CODIGO_INTERNO>/<fotos da raiz>
```

Destino remoto configuravel:

```text
<remoteRoot>/LOTE <lote>/<CODIGO_INTERNO>/<fotos>
```

Entrega de atualizacao:

- usa somente fotos de `AT/`;
- coloca as fotos na raiz do produto no destino;
- nao cria subpasta `AT` no FTP;
- nao mistura normal e atualizacao na mesma tentativa.

Fluxo seguro:

1. resolver codigo interno pelo lookup Excel;
2. montar staging local em `Entrega`;
3. criar manifesto com lote, GTIN/EAN, codigo, tipo, arquivos, tamanhos e hashes;
4. apresentar preflight;
5. enviar via provider mock/local nesta fase;
6. verificar quantidade e tamanho no destino simulado;
7. marcar `entregue` somente apos verificacao;
8. registrar tentativa em `dados/envios/`;
9. preservar fonte local em qualquer falha.

O provider FTP real so deve ser habilitado em fase posterior, com checklist proprio e servidor de teste.

## Retrabalho

O operador pode buscar por GTIN/EAN ou codigo interno.

Ao reiniciar:

- localiza lote e item inequivocamente;
- pede confirmacao;
- muda status para `retrabalho`;
- preserva historico;
- nao duplica nem sobrescreve pasta existente;
- nova captura do mesmo item retorna para `pendente_qa`.

## API Da Fase 1

As rotas devem retornar:

```json
{ "ok": true, "data": {}, "requestId": "..." }
```

ou:

```json
{ "ok": false, "error": "mensagem", "requestId": "..." }
```

Contratos minimos:

```text
GET    /api/health
GET    /api/version
GET    /api/status/camera
POST   /api/status/camera/open
GET    /api/captura/temp
POST   /api/captura/salvar
DELETE /api/captura/temp
GET    /api/lotes
GET    /api/lotes/:lote
GET    /api/lotes/:lote/itens
GET    /api/imagens/anterior
DELETE /api/imagens
POST   /api/qa/classificar
POST   /api/qa/desclassificar
POST   /api/qa/concluir
POST   /api/planilhas/importar
POST   /api/planilhas/confirmar
GET    /api/planilhas/conflitos
GET    /api/planilhas/controle
POST   /api/entregas/preparar
POST   /api/entregas/executar
POST   /api/retrabalhos
GET    /api/relatorios/produtos
GET    /api/relatorios/csv
```

Todas as rotas mutaveis da Fase 1 devem receber `operationId`. O backend deve registrar operacoes concluidas por `operationId` e evitar repeticao acidental de salvamento, classificacao, exclusao, entrega e retrabalho.

## Seguranca Local

Requisitos minimos:

- bind em `127.0.0.1`;
- validacao de body, query e parametros;
- bloqueio de path traversal, caminho absoluto indevido e nomes reservados do Windows;
- validacao de extensao e assinatura para imagens;
- limites de quantidade e tamanho;
- headers basicos de seguranca;
- logs sem senha/token;
- auditoria para exclusao, captura, QA, entrega e retrabalho;
- dados operacionais ignorados pelo Git.

## Testes Da Fase 1

Unitarios:

- normalizacao e validacao de lote, GTIN/EAN e codigo;
- transicoes de status;
- filesystem seguro;
- JSON atomico, backup e recuperacao;
- importacao Excel, deduplicacao e conflitos;
- AP/AT/desfazer;
- manifesto de entrega;
- camera status/open com provider fake.

Integracao:

- TEMP -> salvar -> Finalizadas -> JSON -> Excel;
- repetir mesmo GTIN sem sobrescrever;
- palco anterior por lote/GTIN;
- limpar TEMP seguro;
- QA AP/AT/desfazer;
- entrega normal com provider mock;
- entrega de atualizacao com AT;
- falha de entrega preservando arquivos;
- retrabalho por GTIN/EAN e por codigo;
- relatorios por status/lote.

E2E simples:

- Captura mostra TEMP sem lote;
- salvar devolve foco ao GTIN;
- QA classifica AP/AT;
- preflight de entrega bloqueia item sem codigo;
- relatorio filtra status.

Testes devem usar diretorios temporarios/fixtures, nunca dados operacionais reais em `dados/`.

## Documentacao

A Fase 1 deve corrigir documentos que afirmam producao completa. O texto correto deve dizer:

- produtos Fase 1 implementados quando verificados;
- FTP real ainda pendente de validacao externa;
- Carros/ADSET fora da Fase 1;
- sistema local, independente e sem Redmine.

## Criterios De Aceite Da Fase 1

1. Com imagens no TEMP e nenhum lote selecionado, o palco Atual mostra as imagens e a lateral fica vazia.
2. Informar lote cria/seleciona `Finalizadas/LOTE <lote>` e JSON do lote.
3. Salvar move snapshot para `Finalizadas/LOTE <lote>/<GTIN>`, atualiza JSON e Excel, e volta foco ao GTIN.
4. Repetir lote/GTIN adiciona sem sobrescrever.
5. Palco Anterior mostra apenas imagens do lote/GTIN selecionados.
6. AP fica fora da entrega normal.
7. AT e entrega de atualizacao usam somente fotos de `AT/`.
8. Entrega normal usa codigo interno do Excel no staging.
9. Falha de entrega preserva arquivos e registra erro.
10. Toda listagem mostra status coerente.
11. Retrabalho preserva historico e volta ao fluxo.
12. Planilhas unificam sem sobrescrever conflito silencioso.
13. Sistema roda localmente sem Redmine, Java ou projetos antigos.
14. `simplusCamera.exe` pode ser detectado/aberto localmente e sua ausencia nao bloqueia o sistema.
