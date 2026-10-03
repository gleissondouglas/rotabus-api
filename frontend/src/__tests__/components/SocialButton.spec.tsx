import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';
import { SocialButton } from '../../components/SocialButton';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Ionicons: (props: any) => <View testID={`icon-${props.name}`} {...props} />,
  };
});

describe('SocialButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue('light');
  });

  describe('Provider Apple', () => {
    it('renderiza corretamente no tema claro (light)', () => {
      (useColorScheme as jest.Mock).mockReturnValue('light');
      const onPressMock = jest.fn();

      const { getByRole, getByText, getByTestId } = render(
        <SocialButton provider="apple" onPress={onPressMock} />
      );

      const label = 'Continuar com a Apple';
      const button = getByRole('button');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe(label);

      // Texto
      const textElement = getByText(label);
      expect(textElement).toBeTruthy();
      const flattenedTextStyle = StyleSheet.flatten(textElement.props.style);
      expect(flattenedTextStyle.color).toBe('#FFFFFF');

      // Ícone
      const icon = getByTestId('icon-logo-apple');
      expect(icon).toBeTruthy();
      expect(icon.props.color).toBe('#FFFFFF');
      expect(icon.props.name).toBe('logo-apple');

      // Estilo do Botão (Fundo preto no tema claro)
      const buttonStyle = typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;
      const flattenedButtonStyle = StyleSheet.flatten(buttonStyle);
      expect(flattenedButtonStyle.backgroundColor).toBe('#000000');
      expect(flattenedButtonStyle.borderColor).toBe('transparent');
    });

    it('renderiza com cores invertidas no tema escuro (dark)', () => {
      (useColorScheme as jest.Mock).mockReturnValue('dark');
      const onPressMock = jest.fn();

      const { getByRole, getByText, getByTestId } = render(
        <SocialButton provider="apple" onPress={onPressMock} />
      );

      const label = 'Continuar com a Apple';
      const button = getByRole('button');

      // Texto
      const textElement = getByText(label);
      const flattenedTextStyle = StyleSheet.flatten(textElement.props.style);
      expect(flattenedTextStyle.color).toBe('#000000');

      // Ícone
      const icon = getByTestId('icon-logo-apple');
      expect(icon.props.color).toBe('#000000');

      // Estilo do Botão (Fundo branco no tema escuro)
      const buttonStyle = typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;
      const flattenedButtonStyle = StyleSheet.flatten(buttonStyle);
      expect(flattenedButtonStyle.backgroundColor).toBe('#FFFFFF');
      expect(flattenedButtonStyle.borderColor).toBe('transparent');
    });
  });

  describe('Provider Google', () => {
    it('renderiza corretamente no tema claro', () => {
      (useColorScheme as jest.Mock).mockReturnValue('light');
      const onPressMock = jest.fn();

      const { getByRole, getByText, getByTestId } = render(
        <SocialButton provider="google" onPress={onPressMock} />
      );

      const label = 'Continuar com o Google';
      const button = getByRole('button');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe(label);

      // Texto
      const textElement = getByText(label);
      expect(textElement).toBeTruthy();

      // Ícone
      const icon = getByTestId('icon-logo-google');
      expect(icon).toBeTruthy();
      expect(icon.props.name).toBe('logo-google');

      // Estilo do Botão no tema claro
      const buttonStyle = typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;
      const flattenedButtonStyle = StyleSheet.flatten(buttonStyle);
      expect(flattenedButtonStyle.borderColor).toBe('#E0EAFF');
    });

    it('renderiza corretamente no tema escuro', () => {
      (useColorScheme as jest.Mock).mockReturnValue('dark');
      const onPressMock = jest.fn();

      const { getByRole, getByText, getByTestId } = render(
        <SocialButton provider="google" onPress={onPressMock} />
      );

      const label = 'Continuar com o Google';
      const button = getByRole('button');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe(label);

      // Ícone
      const icon = getByTestId('icon-logo-google');
      expect(icon).toBeTruthy();

      // Estilo do Botão no tema escuro
      const buttonStyle = typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;
      const flattenedButtonStyle = StyleSheet.flatten(buttonStyle);
      expect(flattenedButtonStyle.backgroundColor).toBe('#1E293B');
      expect(flattenedButtonStyle.borderColor).toBe('#334155');
    });
  });

  describe('Interatividade e acessibilidade', () => {
    it('dispara a prop onPress ao ser clicado', () => {
      const onPressMock = jest.fn();
      const { getByRole } = render(
        <SocialButton provider="apple" onPress={onPressMock} />
      );

      const button = getByRole('button');
      fireEvent.press(button);

      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('aplica o estilo pressed quando pressionado', () => {
      const onPressMock = jest.fn();
      const { getByRole } = render(
        <SocialButton provider="apple" onPress={onPressMock} />
      );

      const button = getByRole('button');

      // Testa a função style passando pressed: true e pressed: false
      const styleFunc = button.props.style;
      if (typeof styleFunc === 'function') {
        const pressedStyle = StyleSheet.flatten(styleFunc({ pressed: true }));
        expect(pressedStyle.opacity).toBe(0.7);

        const unpressedStyle = StyleSheet.flatten(styleFunc({ pressed: false }));
        expect(unpressedStyle.opacity).toBeUndefined();
      }

      fireEvent(button, 'pressIn');
      fireEvent(button, 'pressOut');
    });
  });
});
