import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Service para gerenciar feedback tátil (Haptic Feedback) no aplicativo.
 */
export const vibrationService = {
  /**
   * Feedback leve para interações simples (ex: toque em botões secundários).
   */
  light: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  /**
   * Feedback médio para ações importantes (ex: abrir painel de voz).
   */
  medium: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  /**
   * Feedback pesado para confirmações ou erros críticos.
   */
  heavy: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },

  /**
   * Feedback de sucesso (vibração dupla rápida).
   */
  success: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },

  /**
   * Feedback de erro (vibração de alerta).
   */
  error: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },

  /**
   * Feedback de seleção (clique sutil de dial).
   */
  selection: async () => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
  },

  /**
   * Vibração forte e ritmada para alerta de descida do ônibus.
   * Acorda o passageiro mesmo com o celular no bolso ou na bolsa.
   */
  dropoffAlert: async () => {
    if (Platform.OS !== 'web') {
      // Combina haptics pesado com vibração nativa em sequência
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 300);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }, 600);
    }
  }
};
