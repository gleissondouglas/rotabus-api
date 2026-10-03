import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { AssistantPresence } from '../../components/AssistantPresence';

describe('AssistantPresence', () => {
  let isReduceMotionSpy: jest.SpyInstance;
  let loopSpy: jest.SpyInstance;
  let mockStart: jest.Mock;
  let mockStop: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStart = jest.fn();
    mockStop = jest.fn();

    loopSpy = jest.spyOn(Animated, 'loop').mockReturnValue({
      start: mockStart,
      stop: mockStop,
      reset: jest.fn(),
    } as any);

    isReduceMotionSpy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    isReduceMotionSpy.mockRestore();
    loopSpy.mockRestore();
  });

  describe('Renderização e Tamanhos', () => {
    it('renderiza com tamanho padrão (156x156) e atributos de acessibilidade', async () => {
      const { getByLabelText } = render(<AssistantPresence />);

      const container = getByLabelText('Assistente RotaBus');
      expect(container).toBeTruthy();
      expect(container.props.accessibilityRole).toBe('image');
      expect(container.props.accessibilityLabel).toBe('Assistente RotaBus');

      const containerStyle = StyleSheet.flatten(container.props.style);
      expect(containerStyle.width).toBe(156);
      expect(containerStyle.height).toBe(156);

      await waitFor(() => {
        expect(isReduceMotionSpy).toHaveBeenCalled();
      });
    });

    it('renderiza no modo compacto (116x116) quando compact={true}', async () => {
      const { getByLabelText } = render(<AssistantPresence compact={true} />);

      const container = getByLabelText('Assistente RotaBus');
      expect(container).toBeTruthy();
      expect(container.props.accessibilityRole).toBe('image');

      const containerStyle = StyleSheet.flatten(container.props.style);
      expect(containerStyle.width).toBe(116);
      expect(containerStyle.height).toBe(116);

      await waitFor(() => {
        expect(isReduceMotionSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Controle de Animação e Acessibilidade (Reduce Motion)', () => {
    it('inicia o loop de animação quando isReduceMotionEnabled for false', async () => {
      isReduceMotionSpy.mockResolvedValue(false);

      render(<AssistantPresence />);

      await waitFor(() => {
        expect(isReduceMotionSpy).toHaveBeenCalledTimes(1);
        expect(loopSpy).toHaveBeenCalled();
        expect(mockStart).toHaveBeenCalledTimes(1);
      });
    });

    it('não inicia a animação se o usuário ativou Redução de Movimento (reduceMotion = true)', async () => {
      isReduceMotionSpy.mockResolvedValue(true);

      render(<AssistantPresence />);

      await waitFor(() => {
        expect(isReduceMotionSpy).toHaveBeenCalledTimes(1);
      });

      expect(loopSpy).not.toHaveBeenCalled();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('interrompe a animação (chama stop) quando o componente é desmontado', async () => {
      isReduceMotionSpy.mockResolvedValue(false);

      const { unmount } = render(<AssistantPresence />);

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledTimes(1);
      });

      unmount();

      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('não inicia a animação se for desmontado antes de a Promise isReduceMotionEnabled resolver', async () => {
      let resolvePromise: (value: boolean) => void = () => {};
      const pendingPromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      isReduceMotionSpy.mockReturnValue(pendingPromise);

      const { unmount } = render(<AssistantPresence />);

      // Desmonta imediatamente antes de resolver a verificação de reduceMotion
      unmount();

      await act(async () => {
        resolvePromise(false);
      });

      expect(loopSpy).not.toHaveBeenCalled();
      expect(mockStart).not.toHaveBeenCalled();
    });
  });
});
