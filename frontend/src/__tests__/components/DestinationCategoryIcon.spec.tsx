import React from 'react';
import { render } from '@testing-library/react-native';
import { DestinationCategoryIcon } from '../../../src/components/DestinationCategoryIcon';

jest.mock('../../../src/components/AdaptiveIcon', () => ({
  AdaptiveIcon: () => <mock-adaptive-icon />,
}));

describe('DestinationCategoryIcon', () => {
  it('renders correctly with known category', () => {
    const { toJSON } = render(<DestinationCategoryIcon category="health" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders correctly with unknown category', () => {
    const { toJSON } = render(<DestinationCategoryIcon category="unknown" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders correctly with small size', () => {
    const { toJSON } = render(<DestinationCategoryIcon category="health" size="small" />);
    expect(toJSON()).toBeTruthy();
  });
});
