"""
Le uma placa de veiculo de uma foto usando Fast-ALPR (deteccao YOLO + OCR
treinado especificamente em caracteres de placa, tudo local via ONNX).

Chamado como processo isolado pelo Node (services/fast-alpr-provider.js),
igual ja se faz com PowerShell em outros pontos do sistema. Roda 100% na
maquina, sem servico externo.

Uso: python reconhecer.py <caminho-da-imagem>
Saida: JSON em stdout, uma linha, com a melhor leitura (ou null).
"""
import sys
import json

from fast_alpr import ALPR


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"erro": "informe o caminho da imagem"}))
        sys.exit(1)

    caminho = sys.argv[1]

    alpr = ALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
    )

    resultados = alpr.predict(caminho)

    if not resultados:
        print(json.dumps({"placa": None}))
        return

    # Confianca da deteccao (achou o retangulo da placa) multiplicada pela do
    # OCR (leu os caracteres certo) - as duas precisam estar boas.
    melhor = max(
        resultados,
        key=lambda r: (r.ocr.text is not None, r.ocr.confidence or 0)
    )

    if not melhor.ocr.text:
        print(json.dumps({"placa": None}))
        return

    # confidence vem uma por caractere lido; a confianca da placa inteira e a
    # do caractere mais fraco - um so errado ja invalida a leitura.
    confs = melhor.ocr.confidence
    if isinstance(confs, (list, tuple)) and confs:
        confianca_ocr = min(float(c) for c in confs)
    else:
        confianca_ocr = float(confs or 0)

    print(json.dumps({
        "placa": melhor.ocr.text.upper(),
        "confiancaOcr": round(confianca_ocr * 100, 1),
        "confiancaDeteccao": round(float(melhor.detection.confidence or 0) * 100, 1),
        "caixa": {
            "x1": melhor.detection.bounding_box.x1,
            "y1": melhor.detection.bounding_box.y1,
            "x2": melhor.detection.bounding_box.x2,
            "y2": melhor.detection.bounding_box.y2
        }
    }))


if __name__ == "__main__":
    main()
