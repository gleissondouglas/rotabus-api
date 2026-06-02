import { parseJsonParam, calculateDistance, cleanVoiceTranscript } from './helpers';

describe('helpers.ts', () => {
  describe('parseJsonParam', () => {
    it('deve retornar o fallback para valor nulo ou indefinido', () => {
      expect(parseJsonParam(null, [])).toEqual([]);
      expect(parseJsonParam(undefined, {})).toEqual({});
    });

    it('deve fazer o parse de uma string JSON válida', () => {
      const data = { id: 1, name: 'Teste' };
      const json = JSON.stringify(data);
      expect(parseJsonParam(json, null)).toEqual(data);
    });

    it('deve retornar o fallback para uma string JSON inválida', () => {
      expect(parseJsonParam('{invalid: json}', 'fallback')).toBe('fallback');
    });
  });

  describe('calculateDistance', () => {
    it('deve retornar 0 para as mesmas coordenadas', () => {
      const lat = -19.7472;
      const lon = -47.9392;
      expect(calculateDistance(lat, lon, lat, lon)).toBe(0);
    });

    it('deve calcular a distância corretamente entre dois pontos conhecidos', () => {
      // Exemplo: Uberaba (Praça Rui Barbosa) para Hospital Mário Palmério
      const p1 = { lat: -19.7472, lon: -47.9392 };
      const p2 = { lat: -19.7618, lon: -47.9547 };
      
      const distance = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
      
      // A distância aproximada é de ~2200 metros
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2500);
    });
  });

  describe('cleanVoiceTranscript', () => {
    it('deve remover prefixos comuns', () => {
      expect(cleanVoiceTranscript('Eu quero ir para o Hospital Mário Palmério')).toBe('o hospital mário palmério');
      expect(cleanVoiceTranscript('me leve até a Praça Rui Barbosa')).toBe('praça rui barbosa');
      expect(cleanVoiceTranscript('como chego no Terminal Univerde')).toBe('terminal univerde');
    });

    it('deve manter o texto se não houver prefixo conhecido', () => {
      expect(cleanVoiceTranscript('Shopping Uberaba')).toBe('shopping uberaba');
    });

    it('deve remover pontuação final', () => {
      expect(cleanVoiceTranscript('Quero ir para o centro.')).toBe('o centro');
    });
  });
});
