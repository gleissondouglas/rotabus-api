import { renderHook, act } from '@testing-library/react-native';
import { useIsSpeaking } from '../useIsSpeaking';
import { getSpeakingState, subscribeToSpeakingState } from '../../services/speech.service';

jest.mock('../../services/speech.service', () => ({
  getSpeakingState: jest.fn(),
  subscribeToSpeakingState: jest.fn(),
}));

describe('useIsSpeaking', () => {
  let listenerCallback: ((speaking: boolean) => void) | null = null;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    listenerCallback = null;
    (subscribeToSpeakingState as jest.Mock).mockImplementation((cb) => {
      listenerCallback = cb;
      return mockUnsubscribe;
    });
  });

  it('deve retornar o estado inicial de getSpeakingState quando for false', () => {
    (getSpeakingState as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useIsSpeaking());

    expect(getSpeakingState).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
  });

  it('deve retornar o estado inicial de getSpeakingState quando for true', () => {
    (getSpeakingState as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useIsSpeaking());

    expect(getSpeakingState).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  it('deve se inscrever em subscribeToSpeakingState no mount', () => {
    (getSpeakingState as jest.Mock).mockReturnValue(false);

    renderHook(() => useIsSpeaking());

    expect(subscribeToSpeakingState).toHaveBeenCalledTimes(1);
    expect(typeof listenerCallback).toBe('function');
  });

  it('deve atualizar reativamente quando o listener for chamado com true e depois false', () => {
    (getSpeakingState as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useIsSpeaking());
    expect(result.current).toBe(false);

    // Dispara listener com true
    act(() => {
      listenerCallback!(true);
    });
    expect(result.current).toBe(true);

    // Dispara listener com false
    act(() => {
      listenerCallback!(false);
    });
    expect(result.current).toBe(false);
  });

  it('deve chamar unsubscribe quando o hook for desmontado', () => {
    (getSpeakingState as jest.Mock).mockReturnValue(false);

    const { unmount } = renderHook(() => useIsSpeaking());

    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
