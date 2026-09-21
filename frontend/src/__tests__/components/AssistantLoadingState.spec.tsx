import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AssistantLoadingState } from '../../../src/components/AssistantLoadingState';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.FadeIn = { delay: () => Reanimated.FadeIn };
  return Reanimated;
});
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('AssistantLoadingState', () => {
  it('renders title and destination', () => {
    render(<AssistantLoadingState title="Loading" destinationName="Please wait" />);
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.getByText('Please wait')).toBeTruthy();
  });

  it('renders transcript', () => {
    render(<AssistantLoadingState title="Loading" transcript="Test transcript" />);
    expect(screen.getByText('"Test transcript"')).toBeTruthy();
  });

  it('renders steps', () => {
    const steps = [
      { id: '1', label: 'Step 1', status: 'completed' as const },
      { id: '2', label: 'Step 2', status: 'loading' as const },
      { id: '3', label: 'Step 3', status: 'pending' as const },
    ];
    render(<AssistantLoadingState title="Loading" steps={steps} />);
    
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.getByText('Step 3')).toBeTruthy();
  });
});
