import { PlateOcrResult, Vehicle } from '../domain/vehicle.js';

/**
 * Contrato para OCR de placas
 * Implementação local apenas (sem envio a serviços externos)
 */
export class PlateOcrProvider {
  /**
   * Detecta placa em uma imagem (deve ser implementado)
   * @param imagePath {string} Caminho da imagem
   * @returns {Promise<PlateOcrResult|null>}
   */
  async detectPlate(imagePath) {
    throw new Error('Not implemented');
  }

  /**
   * Normaliza texto OCR bruto para formato placa
   */
  normalizePlateText(rawText) {
    if (!rawText) return null;

    const text = String(rawText)
      .toUpperCase()
      .replace(/\s/g, '')
      .replace(/[OI]/g, c => c === 'O' ? '0' : '1'); // Common misrecognitions

    // Tenta formato antigo: ABC1234
    if (/^[A-Z]{3}\d{4}$/.test(text)) {
      return {
        normalized: text,
        format: 'old'
      };
    }

    // Tenta formato Mercosul: ABC1D23
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(text)) {
      return {
        normalized: text,
        format: 'mercosul'
      };
    }

    return {
      normalized: text,
      format: 'unknown'
    };
  }
}

/**
 * Mock OCR Provider para desenvolvimento
 * Simula OCR local sem enviar dados
 */
export class MockPlateOcrProvider extends PlateOcrProvider {
  constructor() {
    super();
    this.mockPlates = new Map([
      ['plate1.jpg', { text: 'ABC1234', format: 'old', confidence: 95 }],
      ['plate2.jpg', { text: 'XYZ9K87', format: 'mercosul', confidence: 88 }],
      ['plate3.jpg', { text: 'MNO5678', format: 'old', confidence: 92 }]
    ]);
  }

  async detectPlate(imagePath) {
    console.log(`🔍 Mock OCR: Detectando placa em ${imagePath}`);

    // Simula delay de processamento
    await new Promise(resolve => setTimeout(resolve, 100));

    // Procura mock data
    for (const [pattern, data] of this.mockPlates.entries()) {
      if (imagePath.includes(pattern)) {
        console.log(`✓ Mock OCR: Placa detectada: ${data.text}`);

        const normalized = this.normalizePlateText(data.text);
        return new PlateOcrResult(
          data.text,
          normalized.normalized,
          normalized.format,
          data.confidence
        );
      }
    }

    // Sem placa detectada
    console.log(`✗ Mock OCR: Nenhuma placa detectada`);
    return null;
  }
}

/**
 * Serviço de OCR de placas
 */
export class PlateOcrService {
  constructor(provider = null) {
    // Por padrão usa mock
    this.provider = provider || new MockPlateOcrProvider();
  }

  /**
   * Processa foto para detectar placa
   */
  async processPlatPhoto(imagePath) {
    try {
      const ocrResult = await this.provider.detectPlate(imagePath);

      if (!ocrResult) {
        return {
          ok: true,
          data: {
            detected: false,
            message: 'No plate detected'
          }
        };
      }

      if (!ocrResult.isReliable()) {
        return {
          ok: true,
          data: {
            detected: true,
            reliable: false,
            text: ocrResult.rawText,
            confidence: ocrResult.confidence,
            message: 'Low confidence - requires manual review'
          }
        };
      }

      return {
        ok: true,
        data: {
          detected: true,
          reliable: true,
          text: ocrResult.normalizedText,
          format: ocrResult.format,
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText,
          ocrResult: ocrResult.toJSON()
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Processa sequência de fotos agrupando por placa
   * Primeira foto de cada placa é marcada como "plate photo"
   */
  async processPhotoSequence(photos) {
    const groups = [];
    let currentGroup = null;
    let groupIndex = 0;

    for (const photo of photos) {
      const result = await this.processPlatPhoto(photo.path);

      if (result.ok && result.data.detected && result.data.reliable) {
        // Nova placa detectada
        if (currentGroup) {
          groups.push(currentGroup);
        }

        currentGroup = {
          groupIndex: groupIndex++,
          plate: result.data.text,
          format: result.data.format,
          confidence: result.data.confidence,
          photos: [],
          ocrResult: result.data.ocrResult
        };

        // Primeira foto deste grupo é foto de placa
        currentGroup.photos.push({
          ...photo,
          isPlatePhoto: true,
          sequence: 1
        });
      } else if (currentGroup) {
        // Adiciona foto ao grupo atual
        currentGroup.photos.push({
          ...photo,
          isPlatePhoto: false,
          sequence: currentGroup.photos.length + 1
        });
      }
      // Se não há placa detectada e nenhum grupo atual, ignora foto
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return {
      ok: true,
      data: {
        groups,
        totalPhotos: photos.length,
        vehiclesDetected: groups.length,
        photosProcessed: photos.length
      }
    };
  }
}

export default {
  PlateOcrProvider,
  MockPlateOcrProvider,
  PlateOcrService
};
