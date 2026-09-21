import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BottomActionBar } from '../../../src/components/BottomActionBar';
import { logUserInteraction } from "../../../src/utils/devLogger";


jest.mock('../../../src/utils/devLogger', () => ({
  logUserInteraction: jest.fn(),
}));

jest.mock('../../../src/components/BottomVoiceMicButton', () => ({
  BottomVoiceMicButton: ({ status, label, onPress }: any) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return <Pressable testID="mic-button" onPress={onPress}><Text>{label}</Text></Pressable>;
  }
}));

jest.mock('../../../src/components/LiquidGlassView', () => ({
  LiquidGlassView: ({ children }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="mock-liquid-glass">{children}</View>;
  }
}));

jest.mock('../../../src/components/AdaptiveIcon', () => ({
  AdaptiveIcon: () => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID="mock-adaptive-icon" />;
  }
}));

describe('BottomActionBar', () => {
  it('renders correctly', () => {
    render(<BottomActionBar status="idle" micLabel="Falar" onTypeDestination={jest.fn()} onMicPress={jest.fn()} />);
    expect(screen.getByText('Digitar destino')).toBeTruthy();
  });

  it('calls onTypeDestination and logs interaction on press', () => {
    const onType = jest.fn();
    render(<BottomActionBar status="idle" micLabel="Falar" onTypeDestination={onType} onMicPress={jest.fn()} />);
    fireEvent.press(screen.getByText('Digitar destino'));
    expect(onType).toHaveBeenCalled();
    expect(logUserInteraction).toHaveBeenCalled();
  });

  it('disables typing button when status is speaking, processing or success', () => {
    const { rerender } = render(<BottomActionBar status="speaking" micLabel="Falar" onTypeDestination={jest.fn()} onMicPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Digitar destino' })).toBeDisabled();

    rerender(<BottomActionBar status="processing" micLabel="Falar" onTypeDestination={jest.fn()} onMicPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Digitar destino' })).toBeDisabled();

    rerender(<BottomActionBar status="success" micLabel="Falar" onTypeDestination={jest.fn()} onMicPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Digitar destino' })).toBeDisabled();
  });

  it('calls onMicPress when mic button is pressed', () => {
    const onMicPress = jest.fn();
    render(<BottomActionBar status="idle" micLabel="Falar" onTypeDestination={jest.fn()} onMicPress={onMicPress} />);
    fireEvent.press(screen.getByTestId('mic-button'));
    expect(onMicPress).toHaveBeenCalled();
  });
});
