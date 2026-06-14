import { formatBusWaitingTimeToFriendlyText, getNext7Days, formatBusWaitingTimeToFriendlyTextShort } from './date-time';

describe('date-time.ts - formatBusWaitingTimeToFriendlyText', () => {
  // Fixando a data de referência como: Sábado, 13 de Junho de 2026 às 12:00:00
  const refDate = new Date('2026-06-13T12:00:00');

  it('deve retornar "Chegando agora" para tempos entre 0 e -2 minutos', () => {
    // 1 minuto atrás
    const target = new Date(refDate.getTime() - 60000);
    expect(formatBusWaitingTimeToFriendlyText(target.toISOString(), refDate)).toBe('Chegando agora');
  });

  it('deve retornar "Horário passou" para tempos mais antigos que -2 minutos', () => {
    // 5 minutos atrás
    const target = new Date(refDate.getTime() - 300000);
    expect(formatBusWaitingTimeToFriendlyText(target.toISOString(), refDate)).toBe('Horário passou');
  });

  it('deve retornar "em X min" para tempos menores que 60 minutos', () => {
    // 25 minutos no futuro
    const target = new Date(refDate.getTime() + 25 * 60000);
    expect(formatBusWaitingTimeToFriendlyText(target.toISOString(), refDate)).toBe('em 25 min');
  });

  it('deve retornar "em XhY" para tempos entre 60 minutos e 12 horas', () => {
    // 2 horas e 15 minutos no futuro (135 minutos)
    const target = new Date(refDate.getTime() + 135 * 60000);
    expect(formatBusWaitingTimeToFriendlyText(target.toISOString(), refDate)).toBe('em 2h15');

    // 3 horas exatas (180 minutos)
    const targetExact = new Date(refDate.getTime() + 180 * 60000);
    expect(formatBusWaitingTimeToFriendlyText(targetExact.toISOString(), refDate)).toBe('em 3h');
  });

  it('deve retornar "hoje às HH:mm" para tempos maiores que 12 horas no mesmo dia', () => {
    // 12 horas e 30 minutos no futuro (ainda no mesmo dia)
    // Vamos testar: refDate às 08:00 e target às 22:00 (14 horas de diferença)
    const morningRef = new Date('2026-06-13T08:00:00');
    const nightTarget = new Date('2026-06-13T22:30:00');
    expect(formatBusWaitingTimeToFriendlyText(nightTarget.toISOString(), morningRef)).toBe('hoje às 22:30');
  });

  it('deve retornar "amanhã às HH:mm" para o dia seguinte', () => {
    // Domingo, 14 de Junho de 2026 às 15:45
    const target = new Date('2026-06-14T15:45:00');
    expect(formatBusWaitingTimeToFriendlyText(target.toISOString(), refDate)).toBe('amanhã às 15:45');
  });

  it('deve retornar o dia da semana correto em português para datas entre 2 e 7 dias no futuro', () => {
    // Segunda-feira, 15 de Junho de 2026 às 10:00 (2 dias no futuro)
    const targetMon = new Date('2026-06-15T10:00:00');
    expect(formatBusWaitingTimeToFriendlyText(targetMon.toISOString(), refDate)).toBe('segunda-feira às 10:00');

    // Quarta-feira, 17 de Junho de 2026 às 14:15 (4 dias no futuro)
    const targetWed = new Date('2026-06-17T14:15:00');
    expect(formatBusWaitingTimeToFriendlyText(targetWed.toISOString(), refDate)).toBe('quarta-feira às 14:15');
  });

  it('deve retornar "Escolha outro horário" para datas além de 7 dias no futuro', () => {
    // Terça-feira, 23 de Junho de 2026 às 12:00 (10 dias no futuro)
    const targetFar = new Date('2026-06-23T12:00:00');
    expect(formatBusWaitingTimeToFriendlyText(targetFar.toISOString(), refDate)).toBe('Escolha outro horário');
  });
});

describe('date-time.ts - getNext7Days', () => {
  const refDate = new Date('2026-06-13T12:00:00');

  it('deve retornar exatamente 7 dias', () => {
    const days = getNext7Days(refDate);
    expect(days).toHaveLength(7);
  });

  it('deve retornar "Hoje" para o primeiro dia e a data correta', () => {
    const days = getNext7Days(refDate);
    expect(days[0].label).toBe('Hoje');
    expect(days[0].dayNum).toBe(13);
    expect(days[0].dateText).toBe('2026-06-13');
  });

  it('deve retornar "Amanhã" para o segundo dia e a data correta', () => {
    const days = getNext7Days(refDate);
    expect(days[1].label).toBe('Amanhã');
    expect(days[1].dayNum).toBe(14);
    expect(days[1].dateText).toBe('2026-06-14');
  });

  it('deve retornar a label curta do dia da semana para os dias seguintes', () => {
    const days = getNext7Days(refDate);
    // 15 de junho é segunda-feira -> 'Seg'
    expect(days[2].label).toBe('Seg');
    expect(days[2].dayNum).toBe(15);
    expect(days[2].dateText).toBe('2026-06-15');

    // 16 de junho é terça-feira -> 'Ter'
    expect(days[3].label).toBe('Ter');
    expect(days[3].dayNum).toBe(16);
    expect(days[3].dateText).toBe('2026-06-16');
  });

  it('deve retornar o último dia permitido (dia 7, index 6)', () => {
    const days = getNext7Days(refDate);
    // 19 de junho é sexta-feira -> 'Sex'
    expect(days[6].label).toBe('Sex');
    expect(days[6].dayNum).toBe(19);
    expect(days[6].dateText).toBe('2026-06-19');
  });
});

describe('date-time.ts - formatBusWaitingTimeToFriendlyTextShort', () => {
  const refDate = new Date('2026-06-13T12:00:00'); // Sábado

  it('deve retornar "Chegando agora" para tempos entre 0 e -2 minutos', () => {
    const target = new Date(refDate.getTime() - 60000);
    expect(formatBusWaitingTimeToFriendlyTextShort(target.toISOString(), refDate)).toBe('Chegando agora');
  });

  it('deve retornar "em X min" para tempos menores que 60 minutos', () => {
    const target = new Date(refDate.getTime() + 25 * 60000);
    expect(formatBusWaitingTimeToFriendlyTextShort(target.toISOString(), refDate)).toBe('em 25 min');
  });

  it('deve retornar "hoje, HH:mm" para o mesmo dia em tempos maiores que 12 horas', () => {
    const morningRef = new Date('2026-06-13T08:00:00');
    const nightTarget = new Date('2026-06-13T22:30:00');
    expect(formatBusWaitingTimeToFriendlyTextShort(nightTarget.toISOString(), morningRef)).toBe('hoje, 22:30');
  });

  it('deve retornar "amanhã, HH:mm" para o dia seguinte', () => {
    const target = new Date('2026-06-14T15:45:00');
    expect(formatBusWaitingTimeToFriendlyTextShort(target.toISOString(), refDate)).toBe('amanhã, 15:45');
  });

  it('deve retornar o dia da semana curto e o horário para datas de 2 a 7 dias no futuro', () => {
    // Segunda-feira, 15 de Junho
    const targetMon = new Date('2026-06-15T10:00:00');
    expect(formatBusWaitingTimeToFriendlyTextShort(targetMon.toISOString(), refDate)).toBe('segunda, 10:00');

    // Terça-feira, 16 de Junho
    const targetTue = new Date('2026-06-16T09:10:00');
    expect(formatBusWaitingTimeToFriendlyTextShort(targetTue.toISOString(), refDate)).toBe('terça, 09:10');
  });
});
