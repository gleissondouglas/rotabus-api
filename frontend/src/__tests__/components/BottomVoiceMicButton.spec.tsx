import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BottomVoiceMicButton } from '../../../src/components/BottomVoiceMicButton';
import { logUserInteraction } from '../../../src/utils/devLogger';

jest.mock('../../../src/utils/devLogger', () => ({
  logUserInteraction: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useSharedValue = jest.fn(() => ({ value: 1 }));
  Reanimated.useAnimatedStyle = jest.fn(() => ({}));
  Reanimated.withTiming = jest.fn((val) => val);
  Reanimated.withRepeat = jest.fn((val) => val);
  Reanimated.withSequence = jest.fn((...args) => args);
  return Reanimated;
});
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('BottomVoiceMicButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<BottomVoiceMicButton status="idle" label="Test Label" />);
    expect(screen.getByText('Test Label')).toBeTruthy();
  });

  it('handles press correctly', () => {
    const onPress = jest.fn();
    render(<BottomVoiceMicButton status="idle" label="Test Label" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
    expect(logUserInteraction).toHaveBeenCalled();
  });

  it('shows ActivityIndicator when processing or success', () => {
    const { rerender } = render(<BottomVoiceMicButton status="processing" label="Test" />);
    expect(screen.getByRole('button')).toBeDisabled();
    
    rerender(<BottomVoiceMicButton status="success" label="Test" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled prop is true or status is speaking', () => {
    const { rerender } = render(<BottomVoiceMicButton status="idle" label="Test" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();

    rerender(<BottomVoiceMicButton status="speaking" label="Test" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders helper text if provided', () => {
    render(<BottomVoiceMicButton status="idle" label="Test" helperText="Helper text" />);
    expect(screen.getByText('Helper text')).toBeTruthy();
  });
});
