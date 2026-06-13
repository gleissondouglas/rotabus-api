const { 
  validatePlanJourneyInput, 
  validateResolveDestinationInput 
} = require('../../../src/modules/journeys/journeys.validator');

describe('Journeys Validator (Baseline)', () => {
  describe('validatePlanJourneyInput', () => {
    const validOrigin = { lat: -19.747, lng: -47.939 };
    const validDestination = { text: 'Praça Rui Barbosa' };

    test('deve validar e normalizar destino', () => {
      const input = { 
        origin: validOrigin, 
        destination: { text: '  Shopping   Uberaba  ' } 
      };
      const result = validatePlanJourneyInput(input);
      expect(result.destination.text).toBe('Shopping Uberaba');
    });

    test('deve validar limite de 200 caracteres no destino', () => {
      const longText = 'a'.repeat(201);
      const input = { origin: validOrigin, destination: { text: longText } };
      expect(() => validatePlanJourneyInput(input)).toThrow('O texto do destino é muito longo.');
    });

    test('deve validar range de latitude e longitude', () => {
      const input = { 
        origin: { lat: -91, lng: 0 }, 
        destination: validDestination 
      };
      expect(() => validatePlanJourneyInput(input)).toThrow('A latitude da origem deve estar entre -90 e 90.');
    });

    test('deve gerar timePreference padrão se omitido', () => {
      const input = { origin: validOrigin, destination: validDestination };
      const result = validatePlanJourneyInput(input);
      expect(result.timePreference.type).toBe('DEPARTURE');
      expect(result.timePreference.dateTime).toBeDefined();
    });

    test('deve suportar campo legado departureTime', () => {
      const departureTime = "2026-06-13T14:20:00Z";
      const input = { 
        origin: validOrigin, 
        destination: validDestination,
        departureTime
      };
      const result = validatePlanJourneyInput(input);
      expect(result.timePreference.type).toBe('DEPARTURE');
      expect(result.timePreference.dateTime).toBe(departureTime);
    });

    test('deve normalizar routingPreference para UPPERCASE', () => {
      const input = { 
        origin: validOrigin, 
        destination: validDestination,
        routingPreference: 'less_walking'
      };
      const result = validatePlanJourneyInput(input);
      expect(result.routingPreference).toBe('LESS_WALKING');
    });
  });

  describe('validateResolveDestinationInput', () => {
    test('deve validar texto mínimo de 2 caracteres', () => {
      const input = { text: 'A', origin: { lat: 0, lng: 0 } };
      expect(() => validateResolveDestinationInput(input)).toThrow('Digite pelo menos 2 caracteres para o destino.');
    });
  });
});
