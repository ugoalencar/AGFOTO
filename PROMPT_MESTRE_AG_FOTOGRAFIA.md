# PROMPT MESTRE — CONSTRUÇÃO DO SISTEMA AG FOTOGRAFIA

## Papel e missão

Atue como arquiteto de software sênior, engenheiro full stack, especialista em aplicações locais para Windows, processamento seguro de arquivos, automação de fluxos fotográficos, Excel, FTP, OCR, testes e segurança.

Sua missão é reconstruir e concluir o sistema **AG Fotografia**, com logotipo textual **AG Foto**, usando como base o repositório privado `ugoalencar/Agfotografia`. O resultado deve ser um sistema local independente, funcional e testado para captura, organização, QA, entrega e relatórios de fotografias de produtos e veículos.

Não entregue somente protótipos, telas estáticas, mocks, planos ou documentação. Implemente o sistema executável, os testes, as configurações de exemplo, os scripts de inicialização e a documentação operacional.

## Repositório e regra de precedência

1. Trabalhe no repositório existente `ugoalencar/Agfotografia` e crie uma branch exclusiva para a reconstrução.
2. Antes de alterar qualquer arquivo, inspecione:
   - a branch principal atual;
   - o histórico recente de commits;
   - o PR nº 1;
   - `README.md`, `README-SIMPLES.md`, `STATUS-FINAL.md` e `RESULTADO-TESTES.md`;
   - `docs/superpowers/specs/` e `docs/superpowers/plans/`;
   - `server.js`, `index.html`, `js/`, `lib/`, `routes/` e `tests/`.
3. A versão atual contém componentes reaproveitáveis, mas também apresenta documentação e código contraditórios. Uma simplificação recente removeu ou desconectou partes de QA, Excel, JSON, entrega e veículos. Não considere essa simplificação como requisito funcional.
4. Use esta ordem de precedência quando houver conflito:
   1. requisitos deste prompt;
   2. documento funcional fornecido pelo proprietário;
   3. comportamento comprovadamente útil do repositório atual;
   4. especificações antigas do repositório.
5. Não restaure cegamente um commit antigo e não recomece apagando o projeto. Faça uma reconstrução controlada, reaproveitando código validado e substituindo apenas o que estiver incompatível.
6. Preserve todos os dados operacionais existentes. Antes de qualquer migração de formato ou estrutura, faça backup, valide a migração e forneça rollback.

## Regras inegociáveis

- O AG Fotografia deve ser completamente independente de `C:\sphoto-terminais`, `D:\Syndi_qa`, Redmine, Java, `start.jar`, WebSocket ou qualquer serviço desses projetos.
- Os projetos antigos podem ser consultados apenas como referência de linguagem, visual e fluxo. O sistema em produção não pode importar arquivos deles, chamar suas APIs, depender de suas pastas nem compartilhar estado.
- A aplicação deve funcionar localmente em Windows e escutar, por padrão, somente em `127.0.0.1:3000`.
- Frontend: Vue 3 e Bootstrap, com ativos locais para funcionar sem internet.
- Backend: Node.js em versão LTS, servidor HTTP modular na porta 3000.
- Persistência operacional: pastas locais, arquivos JSON e planilhas Excel.
- Integrações externas permitidas: `simplusCamera.exe`, FTP/FTPS, GitHub para atualização controlada e, na fase de veículos, ADSET.
- Não armazenar senhas, tokens ou credenciais no Git. Nunca mostrar segredos na interface, API ou logs.
- Não declarar o sistema “pronto para produção” enquanto o FTP real e a operação real do ADSET não tiverem sido testados nos respectivos ambientes.
- Não remover funcionalidades para “simplificar”. Se algo não puder ser concluído por falta de acesso externo, implemente a interface, o adaptador, o modo simulado e os testes, documentando claramente o bloqueio.

## Identidade visual e experiência de uso

Crie uma identidade visual própria para o sistema:

- Nome institucional: **AG Fotografia**.
- Logotipo exibido: **AG Foto**.
- Paleta principal: preto, vermelho, amarelo e laranja.
- Crie o logotipo como SVG original versionado no repositório, usando o texto “AG Foto” e traços/riscos coloridos com as quatro cores.
- Centralize as cores em tokens CSS. Use amarelo e laranja como acentos; preserve contraste mínimo WCAG AA nos textos e controles.
- Interface limpa, moderna, rápida e adequada ao uso contínuo em estúdio.
- Desktop-first, responsiva para notebooks e tablets.
- Operação por teclado é prioritária: o leitor de código funciona como teclado, Enter confirma o GTIN e, após salvar, o foco volta ao campo GTIN.
- Toda ação destrutiva deve ter confirmação clara, informar o alvo exato e registrar auditoria.
- Miniaturas devem ter carregamento progressivo, estado de erro, ampliação em modal, navegação por teclado e zoom.

## Arquitetura obrigatória

Separe o sistema em camadas e módulos, evitando um `server.js` monolítico:

- `server/` ou equivalente: inicialização HTTP, roteamento e middleware.
- `routes/`: contratos HTTP e validação de entrada.
- `services/`: regras de captura, QA, Excel, entrega, FTP, OCR, veículos, ADSET, atualização e relatórios.
- `repositories/`: acesso seguro a JSON, planilhas e sistema de arquivos.
- `domain/`: estados, transições e validações.
- `frontend/` ou estrutura equivalente para Vue.
- `tests/unit`, `tests/integration`, `tests/e2e` e fixtures.

Implemente injeção de dependências para FTP, relógio, filesystem, OCR e ADSET, permitindo testes sem serviços reais.

Use escrita atômica para JSON: gravar em arquivo temporário na mesma pasta, sincronizar, renomear e manter backup da última versão válida. Proteja gravações concorrentes por lote com fila ou lock. Se um JSON estiver inválido, não o sobrescreva; preserve-o, restaure o backup válido e registre o incidente.

## Estrutura de dados e pastas

Use nomes de pastas seguros e compatíveis com Windows. A estrutura mínima é:

```text
AGFotografia/
├─ images/
│  └─ temp/                         # saída monitorada da câmera
├─ Captura/                         # staging transacional e recuperação, não fonte visual principal
├─ Finalizadas/
│  └─ LOTE 37/
│     └─ <GTIN>/
│        ├─ <fotos na raiz>         # entrega normal
│        ├─ AP/                     # apoio, fora da entrega
│        └─ AT/                     # atualização, usada apenas em entrega de atualização
├─ Entrega/
│  └─ LOTE 37/
│     └─ <CODIGO_INTERNO>/
├─ Carros/
│  └─ LOTE 37/
│     └─ <PLACA>/
│        ├─ <fotos>
│        └─ manifest.json
├─ dados/
│  ├─ jsons/
│  │  └─ Lote_37.json
│  ├─ xlsx/
│  │  ├─ entradas/
│  │  ├─ lookup-integrado.xlsx
│  │  └─ controle-lotes.xlsx
│  ├─ envios/
│  ├─ auditoria/
│  └─ backups/
├─ logs/
├─ ftp-config.json.example
├─ adset-config.json.example
└─ caminhos-locais.json.example
```

Arquivos reais de configuração, credenciais, fotos, JSONs operacionais, planilhas reais, logs e backups devem estar no `.gitignore`. Inclua somente exemplos sem segredo e fixtures sintéticas.

GTIN, EAN, código interno, lote e placa devem ser tratados como strings. Não converter GTIN/EAN para número, porque isso pode remover zeros à esquerda. O campo de identificação do produto deve aceitar qualquer sequência numérica autorizada pelo operador; a validação de dígito verificador do GTIN pode existir como aviso configurável, nunca como bloqueio obrigatório.

## Modelo JSON por lote

Crie um arquivo `dados/jsons/Lote_<numero>.json` para cada lote. Use versionamento de schema e histórico de eventos. Estrutura de referência:

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
      "descricao": "Produto de exemplo",
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

Estados mínimos do produto:

- `em_captura`;
- `pendente_qa`;
- `pronto_para_entrega`;
- `entregando`;
- `entregue`;
- `erro_entrega`;
- `retrabalho`.

Defina e teste todas as transições. O status deve acompanhar o item em toda listagem de GTIN, EAN ou código. O sucesso da captura coloca o item em `pendente_qa`; somente confirmação de FTP altera para `entregue`. Uma falha de FTP altera para `erro_entrega`, sem apagar ou mover a fonte local.

Use horário local `America/Sao_Paulo` nos relatórios e ISO 8601 com offset nos dados persistidos.

## Módulo 1 — Captura de produtos

Crie a interface **Captura** com:

1. Campo **Lote**:
   - aceita digitação de um identificador de lote seguro;
   - ao preencher, cria ou seleciona `Finalizadas/LOTE <numero>/` e `dados/jsons/Lote_<numero>.json`;
   - se o lote já existir, mostrar claramente “adicionando material ao lote existente”;
   - a listagem lateral direita fica vazia quando nenhum lote estiver selecionado;
   - quando um lote válido estiver selecionado, listar todos os seus GTINs existentes, com data, quantidade de fotos e status.
2. Campo **GTIN/EAN**:
   - recebe leitor USB em modo teclado ou digitação manual;
   - preserva zeros à esquerda;
   - Enter confirma e prepara a sessão, mas não deve retirar imagens do palco atual.
3. Palco **Atual**:
   - fica sempre visível;
   - monitora continuamente `images/temp/`, mesmo sem lote ou GTIN informado;
   - mostra todas as imagens válidas que estejam estáveis e prontas para leitura;
   - a atualização deve ser eficiente, preferindo watcher de filesystem com fallback de polling;
   - cada miniatura tem excluir, ampliar, navegar e zoom.
4. Palco **Anterior**:
   - fica sempre visível;
   - só carrega imagens quando lote e GTIN estiverem selecionados;
   - consulta exclusivamente `Finalizadas/LOTE <numero>/<GTIN>/`;
   - diferencia visualmente raiz, `AP` e `AT` quando essas subpastas forem exibidas.
5. Botão **Salvar**:
   - exige lote, GTIN e pelo menos uma imagem estável no TEMP;
   - cria um snapshot dos nomes disponíveis no início da operação;
   - move somente esse snapshot para `Finalizadas/LOTE <numero>/<GTIN>/`;
   - imagens novas que chegarem durante a operação permanecem no TEMP;
   - não sobrescreve arquivos existentes; em colisão, usa nome determinístico e registra a alteração;
   - atualiza o JSON do lote e `controle-lotes.xlsx`;
   - após sucesso, limpa o GTIN da tela, mantém o lote e devolve o foco ao campo GTIN.
6. Botão **Limpar TEMP**:
   - informa quantidade e nomes que serão removidos;
   - exige confirmação explícita;
   - remove apenas arquivos permitidos dentro da pasta TEMP resolvida e validada;
   - não aceita caminho vindo diretamente do cliente;
   - registra auditoria com data, usuário/local e quantidade.

Antes de mover qualquer arquivo capturado, confirme que ele terminou de ser gravado, verificando estabilidade de tamanho e possibilidade de abertura. Ignore temporariamente arquivos incompletos e mostre seu estado na interface.

## Módulo 2 — Planilhas e unificação de demandas

O cliente recebe várias planilhas parciais ao longo do mesmo lote. Implemente uma área **Planilhas** dentro de Configurações ou QA Hub:

- upload/importação de `.xlsx` e, se necessário, `.xls`;
- leitura de cabeçalhos equivalentes a `EAN`, `Código`/`Codigo` e `Descrição`/`Descricao`/`Descrição SAP`;
- associação da importação a um lote;
- pré-visualização antes de confirmar;
- unificação no arquivo mestre `dados/xlsx/lookup-integrado.xlsx`;
- chave de deduplicação composta por lote + EAN;
- nenhuma substituição silenciosa quando o mesmo lote + EAN vier com código ou descrição diferente;
- conflitos devem aparecer numa tela de resolução e ficar registrados;
- importação idempotente do mesmo arquivo;
- validação de tamanho, extensão, assinatura do arquivo e limites de linhas;
- tratamento seguro de células e prevenção de formula injection na exportação.

O sistema também deve gerar e manter `dados/xlsx/controle-lotes.xlsx`, com uma aba por lote e colunas:

```text
EAN | Código | Descrição | Data da foto | Quantidade de fotos | Status | Última entrega | Último erro
```

O JSON por lote é a fonte operacional de estado; o Excel de controle é uma visão/exportação reconstruível. Não permita divergência silenciosa: forneça comando de reconciliação e relatório de diferenças.

## Módulo 3 — QA Hub de produtos

Crie uma interface **QA Hub** com as abas **Entregar**, **QA** e **Relatórios**.

### Aba Entregar

- Painel lateral direito com todos os lotes.
- Ao selecionar um lote, mostrar no centro seus GTINs fotografados, data, código interno, descrição, quantidade de fotos e status.
- Cada linha tem ação individual de entrega e checkbox.
- Permitir seleção múltipla e mostrar um resumo antes de enviar.
- A entrega é por item: uma falha não cancela nem mascara o resultado dos demais.
- Antes do envio, validar o mapeamento lote + EAN no Excel mestre.
- Se não houver código, bloquear somente o item afetado e mostrar instrução objetiva.
- A pasta enviada usa o código interno, mas os arquivos mantêm os nomes originais.

Estratégia padrão de destino FTP:

```text
<pastaRemota>/LOTE <numero>/<CODIGO_INTERNO>/<fotos na raiz>
```

Deixe o template do caminho remoto configurável sem permitir `..`, caminho absoluto indevido ou separadores maliciosos vindos da planilha.

Fluxo seguro de entrega:

1. montar/reconstruir o staging local em `Entrega/LOTE <numero>/<CODIGO_INTERNO>/`;
2. criar um manifesto com GTIN, código, tipo de entrega, lista, tamanho e hash dos arquivos;
3. apresentar preflight na interface;
4. enviar para pasta remota temporária identificada por UUID;
5. verificar quantidade e tamanho quando o servidor permitir;
6. renomear remotamente para o destino final;
7. somente após confirmação marcar `entregue` no JSON e no Excel de controle;
8. registrar tentativa, duração, resultado e erro sanitizado em `dados/envios/`;
9. preservar todo o material local em qualquer falha.

Suportar FTP e FTPS conforme o servidor real. Preferir conexão segura quando disponível. Nunca registrar a senha.

### Retrabalho/Reiniciar

Na aba Entregar, adicione busca por EAN/GTIN ou código interno e ação **Reiniciar para retrabalho**:

- localizar inequivocamente lote, GTIN e código;
- pedir confirmação e mostrar origem/destino;
- alterar o status para `retrabalho`;
- se a pasta GTIN já existir em Finalizadas, não duplicar nem sobrescrever;
- se só houver staging por código em Entrega, restaurar uma cópia para `Finalizadas/LOTE <numero>/<GTIN>/`;
- manter histórico dos envios anteriores;
- após nova captura e salvamento, retornar a `pendente_qa` e repetir o fluxo normal.

### Aba QA

- Navegação por lote e GTIN.
- Grade de miniaturas com modal, zoom e navegação.
- Excluir foto com confirmação.
- Marcar foto como **AP — Apoio**: mover para `AP/`; essa foto não participa da entrega normal.
- Marcar foto como **AT — Atualização**: mover para `AT/`.
- Permitir desfazer AP ou AT, devolvendo à raiz sem sobrescrever.
- Entrega normal usa somente imagens da raiz.
- Quando o operador marcar **Enviar como atualização**, enviar somente imagens de `AT/`, colocando-as na raiz da pasta remota do produto, sem criar subpasta `AT` no FTP.
- Nunca misturar entrega normal e atualização na mesma tentativa. Registre o tipo no manifesto.
- Permitir concluir QA e mudar o status para `pronto_para_entrega` somente se existir pelo menos uma imagem elegível para o tipo escolhido.

### Aba Relatórios

Ofereça filtros por:

- período inicial/final;
- lote;
- status;
- GTIN/EAN;
- código interno;
- descrição;
- tipo de entrega;
- sucesso ou erro.

Exiba totais de lotes, itens esperados, fotografados, pendentes, entregues, em retrabalho, erros e quantidade de fotos. Permita exportação para XLSX e CSV. Os resultados devem ser derivados dos JSONs e do catálogo mestre, com indicação de inconsistência quando pastas e dados não coincidirem.

## Módulo 4 — Veículos

Crie um domínio separado chamado **Carros**. Ele não usa `Finalizadas/` de produtos.

### Importação de cartão de memória

- Permitir selecionar uma pasta de origem autorizada no cartão/unidade ou enviar um conjunto de arquivos pela interface.
- Validar a raiz selecionada no backend; não aceitar caminho arbitrário sem allowlist/configuração.
- Listar e ordenar as fotos por metadados confiáveis, com fallback documentado para data de modificação e nome.
- A primeira foto de cada veículo é uma foto da placa.
- Execute OCR local na sequência: uma placa válida inicia um novo grupo e todas as fotos seguintes pertencem a esse veículo até que outra placa válida seja detectada.
- Reconhecer formatos brasileiros antigos e Mercosul após normalização.
- O OCR deve ser implementado por uma interface `PlateOcrProvider`, com implementação local/offline. Não enviar fotos de veículos a serviços externos por padrão.
- Guardar confiança, texto bruto e texto normalizado.
- Placa incerta, duplicada ou inválida deve ir para uma fila de revisão manual; nunca criar ou entregar silenciosamente uma pasta com placa incerta.
- Após confirmação, criar `Carros/LOTE <numero>/<PLACA>/` e mover/copiar as fotos conforme opção explícita do operador.
- Criar `manifest.json` por veículo com origem, ordem, hashes, OCR e histórico.

### QA de veículos

- Abas **Importar**, **QA**, **Entregar** e **Relatórios**.
- Exibir miniaturas por lote e placa.
- Permitir excluir, ampliar, zoom e arrastar miniaturas para definir a ordem.
- Persistir a ordem no `manifest.json`; não depender apenas do nome do arquivo ou do estado do navegador.
- Recarregar a página deve preservar exatamente a ordem.
- Impedir números de ordem duplicados e registrar cada alteração.

### Integração ADSET

Implemente a automação por um adaptador isolado `AdsetProvider`, preferencialmente com Playwright e sessão local protegida. O fluxo esperado é:

1. autenticar no ADSET;
2. pesquisar a placa primeiro em **Veículos → Estoque publicados**;
3. somente se não encontrar, pesquisar em **Estoque não publicados**;
4. exigir correspondência única do veículo;
5. abrir a edição de fotos;
6. validar que todas as fotos locais estão presentes, legíveis e ordenadas;
7. remover as fotos atuais do veículo;
8. enviar as novas fotos exatamente na ordem persistida pelo QA;
9. verificar quantidade e ordem após o upload;
10. registrar resultado, evidências e erro sanitizado.

Dados insuficientes para implementar e certificar a integração real com ADSET sem acesso ao site, conta autorizada, seletores e validação do fluxo. Portanto:

- primeiro implemente contrato, mock, modo `dry-run`, fixtures e testes do adaptador;
- não codifique seletores inventados;
- não inclua credenciais no código;
- quando o acesso for fornecido, faça uma fase de descoberta controlada e registre seletores em configuração versionada sem segredos;
- nas primeiras execuções reais, exigir confirmação humana imediatamente antes de excluir fotos existentes;
- se houver zero ou mais de uma correspondência de placa, bloquear a operação;
- se o upload falhar após a exclusão, manter estado `erro_entrega`, preservar os arquivos locais e permitir retomada idempotente;
- não declarar esta integração pronta até um teste real supervisionado ser concluído.

## Integração com `simplusCamera.exe`

- O programa da câmera grava JPG em `images/temp/`.
- O sistema monitora a pasta; não precisa de Java, WebSocket ou Redmine.
- Detectar localmente se o processo `simplusCamera.exe` está ativo, apenas para informar.
- Câmera desconectada gera aviso não bloqueante.
- Inclua opção **Off** para o operador declarar que trabalhará sem a câmera.
- A ausência da câmera nunca deve travar navegação, QA, relatórios ou importação de cartão.

## Atualização pelo GitHub

Na tela Configurações, implemente atualização controlada:

- mostrar branch, commit atual e disponibilidade de atualização;
- `git fetch` somente após ação do usuário;
- recusar atualização se o worktree tiver alterações locais;
- aplicar apenas fast-forward (`git pull --ff-only`);
- nunca resolver conflito automaticamente;
- nunca incluir token do GitHub na interface ou nos arquivos versionados;
- indicar quando é necessário reiniciar o servidor;
- registrar commit anterior para rollback manual documentado;
- não executar atualização automática em segundo plano.

## API mínima

Defina contratos consistentes, validação por schema e erros no formato `{ ok, data, error, requestId }`. A API deve cobrir, no mínimo:

```text
GET    /api/health
GET    /api/version
GET    /api/status/camera
GET    /api/captura/temp
POST   /api/captura/salvar
DELETE /api/captura/temp
GET    /api/lotes
GET    /api/lotes/:lote/itens
GET    /api/imagens/anterior
DELETE /api/imagens
POST   /api/qa/classificar
POST   /api/qa/concluir
POST   /api/planilhas/importar
POST   /api/planilhas/unificar
GET    /api/planilhas/conflitos
GET    /api/planilhas/controle
POST   /api/entregas
POST   /api/retrabalhos
GET    /api/relatorios/produtos
POST   /api/carros/importar
GET    /api/carros/lotes/:lote
PATCH  /api/carros/:lote/:placa/ordem
POST   /api/carros/:lote/:placa/entregar
GET    /api/relatorios/carros
GET    /api/atualizacao/verificar
POST   /api/atualizacao/aplicar
```

Os nomes podem ser ajustados se houver justificativa técnica, mas todos os comportamentos são obrigatórios. Rotas mutáveis devem ser idempotentes quando possível e receber um `operationId` para impedir repetição acidental.

## Segurança e confiabilidade

Implemente e teste:

- bind em `127.0.0.1` por padrão;
- modo LAN desativado por padrão; se habilitado, exigir autenticação, controle de sessão e autorização;
- validação estrita de corpo, query, parâmetros e planilhas;
- proteção contra path traversal, caminhos absolutos, separadores, nomes reservados do Windows, symlinks e junctions que escapem das raízes permitidas;
- comparação de caminhos com `path.resolve` e verificação de pertencimento real à raiz;
- allowlist de extensões de imagem e validação por assinatura, não somente extensão;
- limites de requisição, quantidade de arquivos e tamanho;
- headers de segurança, política de origem local e proteção contra CSRF em operações mutáveis;
- rate limit para ações destrutivas, login e integrações;
- credenciais em variáveis de ambiente, Windows Credential Manager ou arquivo local ignorado com permissão restrita;
- logs estruturados com `requestId`, sem senhas, tokens, cookies, conteúdo integral de planilhas ou dados sensíveis;
- trilha de auditoria append-only para exclusão, classificação, importação, entrega, retrabalho, reordenação e atualização;
- backup e recuperação de JSON/Excel;
- tratamento de queda de energia ou encerramento durante movimentação;
- staging transacional para evitar entrega parcial;
- nenhuma exclusão automática da fonte local após FTP/ADSET.

## Testes obrigatórios

### Unitários

- normalização de lote, GTIN/EAN, código e placa;
- segurança de caminhos, inclusive `..`, UNC, nomes reservados, symlink e junction;
- transições de status;
- escrita atômica, lock e recuperação de JSON corrompido;
- merge de Excel, aliases de colunas, zeros à esquerda, duplicatas e conflitos;
- geração de workbook por lote;
- seleção raiz versus AP versus AT;
- criação de manifesto e idempotência;
- agrupamento de fotos por placas e baixa confiança de OCR;
- persistência da ordem de veículos.

### Integração

- TEMP → Salvar → Finalizadas → JSON → Excel de controle;
- acréscimo a GTIN existente sem sobrescrever;
- QA → AP/AT → desfazer;
- entrega normal e atualização com FTP fake;
- falha e reenvio FTP mantendo histórico;
- seleção múltipla com sucesso parcial;
- retrabalho por EAN e por código;
- importação de várias planilhas parciais e conflito;
- importação de cartão, agrupamento por placa e revisão manual;
- ADSET mock e `dry-run`.

### E2E no navegador

- leitor simulado enviando Enter;
- palcos sempre visíveis;
- palco Atual exibindo TEMP antes de lote/GTIN;
- lateral vazia sem lote e populada ao selecionar lote existente;
- ampliar, zoom, excluir e confirmação;
- salvar e devolver foco ao GTIN;
- todas as abas de QA e Carros;
- filtros e exportação de relatório;
- reordenação drag-and-drop persistente após reload;
- mensagens de erro claras e sem vazamento técnico.

### Validação externa obrigatória

- FTP/FTPS real em servidor de teste, verificando estrutura remota, arquivos, repetição e falha controlada.
- ADSET real somente após fornecimento de acesso autorizado, em teste supervisionado, com uma placa de teste e confirmação antes de excluir imagens.

## Critérios de aceite funcional

Considere a entrega aceita somente quando todos os cenários abaixo estiverem demonstrados:

1. Com TEMP contendo imagens e nenhum lote selecionado, o palco Atual mostra as imagens e a lateral permanece vazia.
2. Ao informar Lote 37 e um GTIN, Salvar move o snapshot para `Finalizadas/LOTE 37/<GTIN>/`, cria/atualiza `Lote_37.json`, coloca status `pendente_qa` e atualiza o Excel.
3. Repetir o mesmo lote e GTIN adiciona material sem sobrescrever.
4. O palco Anterior mostra apenas as imagens do lote e GTIN selecionados.
5. AP fica preservada localmente e fora da entrega normal.
6. Entrega de atualização usa somente AT e não cria subpasta AT no FTP.
7. Entrega normal resolve EAN → código no Excel, cria a pasta remota pelo código e mantém o nome das fotos.
8. Falha de FTP preserva arquivos, registra erro e permite reenvio.
9. Toda listagem mostra status coerente.
10. Retrabalho localizado por EAN ou código volta ao circuito pelo GTIN sem destruir histórico.
11. Várias planilhas do mesmo lote são unificadas sem perda e sem sobrescrever conflitos silenciosamente.
12. Relatórios filtram período, lote e status e conciliam JSON, Excel e pastas.
13. Importação de cartão separa veículos pela próxima foto de placa e exige revisão em OCR incerto.
14. Ordem das fotos do veículo definida no QA permanece após reiniciar o navegador e é usada pelo adaptador ADSET.
15. O sistema inicia em Windows pela porta 3000, funciona sem conexão com os projetos antigos e não contém credenciais versionadas.

## Entregáveis

Entregue no repositório:

- código funcional;
- migrações e backups necessários;
- testes automatizados;
- fixtures sintéticas;
- `.gitignore` revisado;
- arquivos `.example` de configuração;
- `README.md` único e coerente;
- manual operacional curto para Captura, QA, FTP, Relatórios, Carros e recuperação;
- documento de arquitetura;
- matriz requisito → implementação → teste;
- checklist de implantação no Windows;
- checklist separado para validar FTP real;
- checklist separado para habilitar ADSET após acesso autorizado.

Remova ou arquive documentação contraditória somente depois de preservar o histórico no Git e substituir por documentação correta. Não mantenha arquivos dizendo “pronto para produção” quando ainda houver validações externas pendentes.

## Ordem de execução

1. Auditoria do repositório e mapa de reaproveitamento.
2. Branch, backup e plano de migração.
3. Núcleo seguro de filesystem, JSON, configuração e auditoria.
4. Captura de produtos conforme TEMP sempre visível.
5. Excel, catálogo mestre e controle por lote.
6. QA, AP, AT, entrega FTP e retrabalho.
7. Relatórios e reconciliação.
8. Importação/OCR/QA de veículos.
9. Adaptador ADSET mock + dry-run; integração real somente após acesso.
10. Atualização GitHub, empacotamento Windows, testes e documentação.

Ao final de cada etapa, execute os testes relevantes e apresente evidências objetivas. Não avance ocultando testes quebrados. Se encontrar requisito impossível de confirmar, marque como bloqueio factual, implemente o que puder ser validado localmente e não invente comportamento externo.
