import React from 'react';
import { render } from '@testing-library/react-native';
import { RouteStep } from '../components/RouteStep';
import { useColorScheme } from 'react-native';

// Mock useColorScheme to test dark mode
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

describe('RouteStep', () => {
  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a start step correctly', () => {
    const { getByText } = render(
      <RouteStep
        type="start"
        time="08:00"
        title="Saia de casa"
        description="Comece agora"
      />
    );

    expect(getByText('08:00')).toBeTruthy();
    expect(getByText('Saia de casa')).toBeTruthy();
    expect(getByText('Comece agora')).toBeTruthy();
  });

  it('renders a walk step correctly', () => {
    const { getByText } = render(
      <RouteStep
        type="walk"
        title="Caminhe 5 min"
        description="Até o ponto"
      />
    );

    expect(getByText('Caminhe 5 min')).toBeTruthy();
    expect(getByText('Até o ponto')).toBeTruthy();
  });

  it('renders a bus step correctly with highlights', () => {
    const { getByText, queryByText } = render(
      <RouteStep
        type="bus"
        time="08:15"
        title="Pegue o ônibus 100"
        description="Destino Centro"
        highlight="Ponto A"
        highlightSecondary="Ponto B"
      />
    );

    expect(getByText('08:15')).toBeTruthy();
    expect(getByText('Pegue o ônibus 100')).toBeTruthy();
    
    // Em modo bus, description é renderizado no chip de itinerário
    expect(getByText('Destino Centro')).toBeTruthy();

    expect(getByText('Ponto')).toBeTruthy(); // detailLabel
    expect(getByText('Ponto A')).toBeTruthy(); // highlight value
    expect(getByText('● Próxima parada para desembarcar')).toBeTruthy(); // novo label de destaque
    expect(getByText('Ponto B')).toBeTruthy(); // highlightSecondary value
  });

  it('renders a finish step correctly', () => {
    const { getByText } = render(
      <RouteStep
        type="finish"
        time="09:00"
        title="Chegada"
        description="Destino Final"
        isLast={true}
      />
    );

    expect(getByText('09:00')).toBeTruthy();
    expect(getByText('Chegada')).toBeTruthy();
    expect(getByText('Destino Final')).toBeTruthy();
  });

  it('renders correctly in dark mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');

    const { getByText } = render(
      <RouteStep
        type="bus"
        time="20:00"
        title="Ônibus Noturno"
        description="Vai pra casa"
        highlight="Ponto Escuro"
      />
    );

    // Should still render texts properly
    expect(getByText('20:00')).toBeTruthy();
    expect(getByText('Ônibus Noturno')).toBeTruthy();
    expect(getByText('Ponto Escuro')).toBeTruthy();
  });
});
