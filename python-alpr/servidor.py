"""
Mesma leitura de placa do reconhecer.py, mas como processo de vida longa: le
um caminho de imagem por linha do stdin, devolve um JSON por linha no stdout.

Existe porque carregar o modelo Fast-ALPR demora ~2s (a maior parte e so o
runtime ONNX inicializando) - inviavel repetir isso a cada foto de um lote
com centenas de imagens. Aqui o carregamento acontece uma vez so.

Protocolo: uma linha = um caminho de imagem = um JSON de resposta, na mesma
ordem. "SAIR" na entrada encerra o processo.
"""
import sys
import json

from fast_alpr import ALPR


def processar(alpr, caminho):
    try:
        resultados = alpr.predict(caminho)
    except Exception as err:
        return {"placa": None, "erro": str(err)}

    if not resultados:
        return {"placa": None}

    melhor = max(
        resultados,
        key=lambda r: (r.ocr.text is not None, r.ocr.confidence or 0)
    )

    if not melhor.ocr.text:
        return {"placa": None}

    confs = melhor.ocr.confidence
    if isinstance(confs, (list, tuple)) and confs:
        confianca_ocr = min(float(c) for c in confs)
    else:
        confianca_ocr = float(confs or 0)

    return {
        "placa": melhor.ocr.text.upper(),
        "confiancaOcr": round(confianca_ocr * 100, 1),
        "confiancaDeteccao": round(float(melhor.detection.confidence or 0) * 100, 1)
    }


def main():
    alpr = ALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
    )

    # Sinaliza pro processo Node que o modelo carregou e ja pode mandar linhas.
    print(json.dumps({"pronto": True}), flush=True)

    for linha in sys.stdin:
        caminho = linha.strip()
        if not caminho or caminho == "SAIR":
            break
        resposta = processar(alpr, caminho)
        print(json.dumps(resposta), flush=True)


if __name__ == "__main__":
    main()
