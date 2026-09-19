import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AdaptiveIcon } from '../../../src/components/AdaptiveIcon';

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
  FontAwesome6: 'FontAwesome6',
}));

describe('AdaptiveIcon', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('renders SymbolView on ios', () => {
    Platform.OS = 'ios';
    const { toJSON } = render(<AdaptiveIcon iosSymbol="house" fallbackFamily="Ionicons" fallbackName="home" />);
    expect(toJSON()?.type).toBe('SymbolView');
  });

  it('renders MaterialCommunityIcons on android if family is MaterialCommunityIcons', () => {
    Platform.OS = 'android';
    const { toJSON } = render(<AdaptiveIcon iosSymbol="house" fallbackFamily="MaterialCommunityIcons" fallbackName="home" />);
    expect(toJSON()?.type).toBe('MaterialCommunityIcons');
  });

  it('renders FontAwesome6 on android if family is FontAwesome6', () => {
    Platform.OS = 'android';
    const { toJSON } = render(<AdaptiveIcon iosSymbol="house" fallbackFamily="FontAwesome6" fallbackName="home" />);
    expect(toJSON()?.type).toBe('FontAwesome6');
  });

  it('renders Ionicons on android if family is Ionicons', () => {
    Platform.OS = 'android';
    const { toJSON } = render(<AdaptiveIcon iosSymbol="house" fallbackFamily="Ionicons" fallbackName="home" />);
    expect(toJSON()?.type).toBe('Ionicons');
  });
});
