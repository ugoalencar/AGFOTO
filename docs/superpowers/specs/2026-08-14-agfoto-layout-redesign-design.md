# AGFOTO Fase 1 - Redesign Visual Da Interface De Produtos

Data: 2026-08-14
Status: aprovado para especificacao

## Objetivo

Aplicar ao AGFOTO Fase 1 de produtos uma interface operacional baseada no arquivo de referencia visual `D:\AGFOTO\docs\layout\agfoto-layout.html`.

O HTML de referencia orienta disposicao, densidade, cores e hierarquia visual. Ele nao altera o funcionamento aprovado da Fase 1 e nao introduz os fluxos de carros, OCR, ADSET, FTP real, Redmine, Java ou consultas externas.

## Escopo

Entra neste redesign:

- Shell visual escuro com rail lateral fixo.
- Topbar compacta com identidade AG Foto, area Produtos, status local/camera e contexto do lote quando existir.
- Tela Captura reorganizada em tres zonas:
  - coluna esquerda para lote, GTIN/EAN e acoes;
  - centro para Palco Atual e Palco Anterior;
  - coluna direita para GTINs do lote e resumo de status.
- QA Hub dividido visualmente em Entregar, QA e Relatorios, seguindo a densidade do HTML de referencia.
- Tabelas densas, badges de status, botoes compactos e cards de ferramenta.
- Paleta preto/cinza com vermelho, laranja, amarelo e verde de sucesso.
- Remocao de qualquer aparencia de landing page; a primeira tela continua operacional.

Fica fora deste redesign:

- Implementar carros, OCR de placa ou ADSET real.
- Habilitar FTP real externo.
- Mudar regras de entrega, QA, captura, planilhas ou retrabalho.
- Adicionar dependencias externas de CDN.
- Reescrever backend.

## Regras Visuais

### Estrutura Geral

A aplicacao deve usar uma composicao de tela inteira:

- `rail` lateral com navegacao principal de produtos.
- `topbar` fixa e compacta.
- area principal com views operacionais.
- cards somente para ferramentas, listas, palcos e tabelas.

O rail da Fase 1 deve mostrar apenas:

- Captura;
- Entregar;
- QA;
- Relatorios.

O seletor visual de Produtos/Carros pode aparecer como indicador, mas Carros deve ficar desabilitado, oculto ou claramente fora da Fase 1.

### Paleta

Tokens visuais principais:

- fundo base: `#0B0B0D`;
- painel: `#131318`;
- painel secundario: `#1A1A21`;
- borda: `#2B2B34`;
- texto: `#EDEDF0`;
- texto secundario: `#8C8C99`;
- vermelho: `#E8262B`;
- laranja: `#FF6A13`;
- amarelo: `#FFC20E`;
- sucesso: `#2EA043`.

### Tipografia

O HTML de referencia usa Barlow Condensed, Inter e JetBrains Mono. Como a Fase 1 deve funcionar offline, o redesign deve:

- usar fontes locais se elas forem adicionadas ao projeto; ou
- usar fallback do sistema sem buscar Google Fonts/CDN.

Preferencia:

- titulos e botoes: fonte condensada local ou `Impact, Arial Narrow, sans-serif`;
- corpo: `Inter` local se empacotado, senao `system-ui`;
- codigos, GTIN e caminhos: `ui-monospace`.

## Telas

### Captura

A Captura deve continuar sendo a primeira tela.

Layout:

- coluna esquerda fixa com Entrada:
  - campo Lote;
  - campo GTIN/EAN;
  - status atual do produto;
  - botoes Salvar e Limpar TEMP;
  - mensagem curta de contexto.
- centro com card de palcos:
  - Palco Atual monitorando `images/temp`;
  - Palco Anterior para `Finalizadas/LOTE <lote>/<GTIN>`;
  - miniaturas em grid;
  - acoes de ampliar/excluir onde ja existirem.
- coluna direita:
  - lista de GTINs do lote;
  - quantidade de fotos;
  - status;
  - resumo do lote.

Comportamento preservado:

- salvar snapshot;
- preservar zeros a esquerda;
- manter lote e limpar GTIN apos salvar;
- nao bloquear por ausencia da camera;
- nao mover arquivos que chegaram depois do snapshot.

### Entregar

Layout:

- coluna esquerda com selecao/lista de lote.
- area principal com tabela de produtos prontos para entrega.
- acoes por item continuam usando o fluxo local:
  - preparar staging;
  - executar com `attemptId`;
  - verificar manifesto;
  - marcar entregue somente apos verificacao.

Textos devem refletir a Fase 1:

- usar "Entrega local" ou "Entrega mock local";
- nao exibir "FTP conectado" como se fosse servidor real.

Selecao multipla pode aparecer apenas se for implementada de verdade. Caso contrario, manter acao individual.

### QA

Layout:

- coluna esquerda de navegacao por lote/GTIN.
- centro com grid de imagens.
- painel direito com legenda curta para AP e AT.

Comportamento preservado:

- AP move para `AP/`;
- AT move para `AT/`;
- desfazer volta para raiz sem sobrescrever;
- excluir exige confirmacao e auditoria;
- entrega normal nao usa AP;
- entrega de atualizacao usa somente AT.

### Relatorios

Layout:

- coluna esquerda com filtros e KPIs.
- area principal com tabela detalhada.
- manter exportacao CSV quando disponivel.

Filtros minimos preservados:

- periodo;
- lote;
- status;
- GTIN/EAN;
- codigo;
- descricao.

## Componentes

Criar ou adaptar componentes visuais reutilizaveis no proprio frontend atual:

- App shell;
- Rail navigation;
- Topbar;
- Card;
- Badge de status;
- Action button;
- Thumbnail grid;
- Data table.

Como o frontend atual esta concentrado em `frontend/src/App.vue`, a implementacao pode ser incremental. Se a alteracao ficar grande demais, dividir em componentes Vue locais sera permitido desde que nao mude o contrato das APIs.

## Dados E API

Nenhuma API nova e obrigatoria para o redesign.

O frontend deve continuar usando:

- `/api/captura/*`;
- `/api/lotes/*`;
- `/api/imagens/*`;
- `/api/qa/*`;
- `/api/entregas/*`;
- `/api/retrabalhos`;
- `/api/relatorios/*`;
- `/api/status/camera`.

Todas as chamadas mutaveis continuam enviando `operationId`.

## Responsividade

Desktop e prioridade, pois o sistema e operacional/local.

Regras minimas:

- em telas largas, manter layout multi-coluna;
- em telas estreitas, empilhar cards sem perder a ordem operacional;
- texto de botoes e badges nao pode sobrepor;
- palcos e tabelas devem rolar dentro da area disponivel, nao a pagina inteira.

## Acessibilidade Operacional

- foco visivel em inputs e botoes;
- contraste adequado em fundo escuro;
- botoes destrutivos visualmente distintos;
- status sempre mostrado em texto e cor;
- GTIN, codigo e caminhos em fonte monoespacada.

## Testes E Verificacao

Verificacoes obrigatorias apos implementar:

- `npm.cmd test`;
- checagem sintatica do bloco Vue, se nao houver build frontend;
- teste manual local das telas:
  - Captura carrega TEMP;
  - Salvar atualiza JSON/Excel;
  - QA classifica AP/AT;
  - Entregar executa preparo + execucao;
  - Retrabalho preserva historico;
  - Relatorios abrem e filtram.

Se houver ambiente de browser disponivel, capturar screenshot desktop e verificar:

- rail aparece corretamente;
- topbar nao sobrepoe conteudo;
- palcos Atual/Anterior cabem na tela;
- tabela de entrega nao corta botoes;
- layout nao exibe elementos de Carros como fluxo ativo da Fase 1.

## Criterios De Aceite

1. A interface deve ficar visualmente alinhada ao HTML de referencia.
2. A primeira tela deve continuar sendo Captura.
3. O sistema deve continuar local/offline.
4. Nenhum fluxo de carros/ADSET deve ficar ativo como Fase 1.
5. Entrega deve continuar usando mock/local e manifesto.
6. Todos os testes automatizados existentes devem continuar passando.
7. O usuario deve conseguir homologar a Fase 1 com menos troca de contexto visual entre Captura, Entrega, QA e Relatorios.
