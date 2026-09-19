import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TextField } from '../../../src/components/TextField';

describe('TextField', () => {
  it('renders correctly without label', () => {
    render(<TextField placeholder="Placeholder test" />);
    expect(screen.getByPlaceholderText('Placeholder test')).toBeTruthy();
  });

  it('renders correctly with label', () => {
    render(<TextField label="My Label" placeholder="Placeholder test" />);
    expect(screen.getByText('My Label')).toBeTruthy();
    expect(screen.getByPlaceholderText('Placeholder test')).toBeTruthy();
  });

  it('passes ref correctly', () => {
    const ref = React.createRef<any>();
    render(<TextField ref={ref} placeholder="Ref test" />);
    expect(ref.current).toBeDefined();
  });
});
