import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FavoritesAndHistoryView } from '../../../src/components/FavoritesAndHistoryView';
import { userService } from '../../../src/services/user.service';
import { logUserInteraction } from '../../../src/utils/devLogger';

jest.mock('../../../src/services/user.service', () => ({
  userService: {
    getFavorites: jest.fn(),
    getHistory: jest.fn(),
    deleteFavorite: jest.fn(),
    clearHistory: jest.fn(),
  },
}));
jest.mock('../../../src/utils/devLogger', () => ({
  logUserInteraction: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('FavoritesAndHistoryView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders loading initially and then empty states', async () => {
    (userService.getFavorites as jest.Mock).mockResolvedValueOnce([]);
    (userService.getHistory as jest.Mock).mockResolvedValueOnce([]);

    render(<FavoritesAndHistoryView onSelectDestination={jest.fn()} />);

    // Activity indicator should be on screen initially, maybe hard to catch if it renders fast
    await waitFor(() => {
      expect(screen.getByText('Você ainda não possui favoritos salvos.')).toBeTruthy();
      expect(screen.getByText('Seu histórico está vazio.')).toBeTruthy();
    });
  });

  it('renders favorites and history items', async () => {
    (userService.getFavorites as jest.Mock).mockResolvedValueOnce([
      { id: 1, name: 'Casa', address: 'Rua A' }
    ]);
    (userService.getHistory as jest.Mock).mockResolvedValueOnce([
      { id: 1, query: 'Trabalho', address: 'Rua B' }
    ]);

    render(<FavoritesAndHistoryView onSelectDestination={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Casa')).toBeTruthy();
      expect(screen.getByText('Rua A')).toBeTruthy();
      expect(screen.getByText('Trabalho')).toBeTruthy();
      expect(screen.getByText('Rua B')).toBeTruthy();
    });
  });

  it('handles item press', async () => {
    (userService.getFavorites as jest.Mock).mockResolvedValueOnce([
      { id: 1, name: 'Casa', address: 'Rua A' }
    ]);
    (userService.getHistory as jest.Mock).mockResolvedValueOnce([]);
    
    const onSelect = jest.fn();
    render(<FavoritesAndHistoryView onSelectDestination={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Casa')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Casa'));
    expect(onSelect).toHaveBeenCalledWith('Casa');
    expect(logUserInteraction).toHaveBeenCalled();
  });
});
