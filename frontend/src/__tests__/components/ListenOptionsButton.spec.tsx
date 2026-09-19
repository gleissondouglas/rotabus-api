import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ListenOptionsButton } from '../../../src/components/ListenOptionsButton';
import { speak } from '../../../src/services/speech.service';
import { logUserInteraction } from '../../../src/utils/devLogger';

jest.mock('../../../src/services/speech.service', () => ({
  speak: jest.fn(),
}));
jest.mock('../../../src/utils/devLogger', () => ({
  logUserInteraction: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ListenOptionsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default label', () => {
    render(<ListenOptionsButton />);
    expect(screen.getByText('Ouvir opções')).toBeTruthy();
  });

  it('renders correctly with custom label', () => {
    render(<ListenOptionsButton label="Falar agora" />);
    expect(screen.getByText('Falar agora')).toBeTruthy();
  });

  it('calls onPress if provided', () => {
    const onPress = jest.fn();
    render(<ListenOptionsButton onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(logUserInteraction).toHaveBeenCalled();
  });

  it('calls speak if no onPress provided', () => {
    render(<ListenOptionsButton textToSpeak="Test speech" />);
    fireEvent.press(screen.getByRole('button'));
    expect(speak).toHaveBeenCalledWith('Test speech');
    expect(logUserInteraction).toHaveBeenCalled();
  });

  it('calls speak with default text if no textToSpeak and no onPress', () => {
    render(<ListenOptionsButton />);
    fireEvent.press(screen.getByRole('button'));
    expect(speak).toHaveBeenCalledWith(expect.stringContaining('Você está usando o RotaBus'));
  });
});
