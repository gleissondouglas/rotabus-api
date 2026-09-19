import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { VoiceResponseButton } from '../../../src/components/VoiceResponseButton';
import { logUserInteraction } from '../../../src/utils/devLogger';

jest.mock('../../../src/utils/devLogger', () => ({
  logUserInteraction: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('VoiceResponseButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly for idle status', () => {
    render(<VoiceResponseButton status="idle" onPress={jest.fn()} />);
    expect(screen.getByText('Responder por voz')).toBeTruthy();
  });

  it('renders correctly for listening status', () => {
    render(<VoiceResponseButton status="listening" onPress={jest.fn()} />);
    expect(screen.getByText('Ouvindo...')).toBeTruthy();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders correctly for processing status', () => {
    render(<VoiceResponseButton status="processing" onPress={jest.fn()} />);
    expect(screen.getByText('Processando...')).toBeTruthy();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders correctly for error status', () => {
    render(<VoiceResponseButton status="error" onPress={jest.fn()} />);
    expect(screen.getByText('Tentar novamente')).toBeTruthy();
  });

  it('calls onPress when not disabled', () => {
    const onPress = jest.fn();
    render(<VoiceResponseButton status="idle" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
    expect(logUserInteraction).toHaveBeenCalled();
  });
});
