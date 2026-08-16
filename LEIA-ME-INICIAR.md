# Como ligar o AG Fotografia

## Primeira vez, uma vez so

Duplo-clique em **`criar-atalho.vbs`**.

Ele confere se o Node.js esta instalado e cria dois atalhos na Area de Trabalho:

| Atalho | O que faz |
|---|---|
| **AG Foto** | Liga o servidor, a camera e abre a tela |
| **AG Foto - Parar** | Encerra tudo |

Se o Node.js nao estiver instalado, ele avisa e nao cria nada — um atalho que
existe e nao abre nada e o pior jeito de descobrir o problema.

Os atalhos apontam para a pasta onde o `criar-atalho.vbs` estava. Se voce mover
o AGFOTO de lugar, rode o `criar-atalho.vbs` de novo.

## No dia a dia

Duplo-clique em **AG Foto**. Nao aparece janela de terminal nenhuma: o sistema
abre direto na tela de captura, em janela propria, sem barra de endereco.

Para encerrar, **AG Foto - Parar**.

## O que acontece por dentro

1. `iniciar-tudo.vbs` chama o `launcher.js` sem janela
2. o launcher sobe o `server.js` na porta 3000, com reinicio automatico:
   se o servidor cair no meio de uma sessao, ele volta sozinho em 3s
3. liga o `simplusCamera.exe` apontado para `images/temp`, que e a pasta que o
   palco Atual monitora
4. abre a interface

Se a porta 3000 ja estiver ocupada, o launcher entende que o sistema ja esta no
ar e so abre a tela — clicar duas vezes no atalho nao sobe dois servidores.

## A camera

A barra do topo mostra o estado da camera e sonda a cada 5 segundos:

| O que aparece | Significa |
|---|---|
| **Camera** (verde) | Tudo certo, pode fotografar |
| **Sem camera** (vermelho piscando) | Camera desligada, em espera ou cabo solto |
| **Camera parada** (vermelho piscando) | Camera ligada, mas o `simplusCamera.exe` caiu |

Clicar no indicador tenta religar o `simplusCamera.exe`.

Nao basta ver se o `simplusCamera.exe` esta rodando: ele **nao morre** quando a
camera e desligada ou tem o cabo puxado. Olhando so o processo, a tela diria
"conectada" para sempre depois da primeira conexao, e voce so descobriria o
problema quando a foto nao chegasse. Por isso o sistema confere junto se a EOS
esta fisicamente presente no USB.

## Se algo nao subir

Os logs ficam em `logs/`:

| Arquivo | O que registra |
|---|---|
| `launcher-boot.log` | falhas antes do launcher rodar (Node.js ausente, por exemplo) |
| `launcher.log` | cada passo da inicializacao |
| `server.log` | o servidor, incluindo cada reinicio automatico |
| `camera.log` | o simplusCamera |

## A pasta da camera

`simplusCameraLib/` fica **fora do git** por causa do tamanho. Numa maquina
nova, copie a pasta na mao. Sem ela o sistema sobe normalmente e o launcher
anota "simplusCamera.exe nao encontrado" — a captura por camera e que nao
funciona.

## Instalar numa maquina nova

Duplo-clique em **`instalar.bat`**. Ele:

1. confere Node.js e Git
2. instala as dependencias (`npm install`)
3. baixa o navegador do envio ao ADSET (Playwright + Chromium)
4. cria as pastas de trabalho
5. cria o `adset-config.json` a partir do modelo — usuario e senha voce preenche
   na tela de **Ajustes**, nunca no arquivo
6. liga a pasta ao GitHub para o botao Atualizar funcionar
7. cria os atalhos na Area de Trabalho

Rodar de novo numa pasta ja em uso e seguro: nao apaga foto, configuracao nem
trabalho.

## Atualizar o sistema

O botao **Atualizar**, ao lado de Produtos e Carros, fica cinza quando o sistema
esta em dia e **amarelo com um numero** quando ha novidade no GitHub. A checagem
acontece uma vez ao abrir a tela.

Em **Ajustes** ha o detalhe: versao daqui, versao no GitHub e o botao
**Verificar** para consultar na hora.

O que a atualizacao faz e nao faz:

- usa `git pull --ff-only`: avanca ou aborta. **Nunca** inventa um merge nem
  resolve conflito sozinho — numa maquina de producao, um merge automatico que
  da errado deixa voce sem sistema no meio do expediente
- se houver alteracao local na pasta, ela **para** e diz quais arquivos. A
  atualizacao nunca sobrescreve trabalho seu; rode o `instalar.bat` para guardar
  essas alteracoes num commit local
- ao terminar, ela diz se basta recarregar a tela ou se precisa reiniciar:
  mudanca em `server/`, `services/`, `routes/` ou `server.js` so vale com o
  servidor reiniciado, porque o Node carrega esses arquivos uma vez, no start
- se o `package.json` mudou, avisa para rodar o `instalar.bat` de novo

Suas fotos, o `adset-config.json` e os dados em `dados/` ficam **fora do git** e
nao sao tocados pela atualizacao.
