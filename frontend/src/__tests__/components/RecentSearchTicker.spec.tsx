import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { RecentSearchTicker } from "../../../src/components/RecentSearchTicker";
import { vibrationService } from "../../../src/services/vibration.service";

jest.mock("../../../src/services/vibration.service", () => ({
  vibrationService: {
    light: jest.fn(),
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require("react-native");
    return <Text>{name}</Text>;
  },
}));

const mockItems = [
  {
    id: "1",
    title: "Av. Leopoldino de Oliveira",
    subtitle: "Centro • Próximo ao Calçadão",
    query: "Av. Leopoldino de Oliveira",
  },
  {
    id: "2",
    title: "Praça Rui Barbosa",
    subtitle: "Centro Histórico",
    query: "Praça Rui Barbosa",
  },
];

describe("RecentSearchTicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("não renderiza nada quando a lista de itens estiver vazia", () => {
    const onSelect = jest.fn();
    const { toJSON } = render(
      <RecentSearchTicker items={[]} onSelectItem={onSelect} />
    );
    expect(toJSON()).toBeNull();
  });

  it("renderiza o item único estaticamente sem erros", () => {
    const onSelect = jest.fn();
    render(<RecentSearchTicker items={[mockItems[0]]} onSelectItem={onSelect} />);

    expect(screen.getAllByText("Av. Leopoldino de Oliveira").length).toBeGreaterThan(0);
    expect(screen.getByText("Centro • Próximo ao Calçadão")).toBeTruthy();
  });

  it("dispara onSelectItem e feedback tátil ao tocar no card", () => {
    const onSelect = jest.fn();
    render(<RecentSearchTicker items={mockItems} onSelectItem={onSelect} />);

    fireEvent.press(screen.getByTestId("recent-search-ticker"));

    expect(vibrationService.light).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
  });

  it("avança para o próximo item após o intervalo de animação", () => {
    const onSelect = jest.fn();
    render(
      <RecentSearchTicker
        items={mockItems}
        onSelectItem={onSelect}
        intervalMs={3000}
      />
    );

    // Avança o timer
    act(() => {
      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(500); // tempo da animação
    });

    // Pressiona o ticker e verifica se seleciona o segundo item
    fireEvent.press(screen.getByTestId("recent-search-ticker"));
    expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
  });

  it("usa 7000ms como intervalo padrão e avança para o próximo item", () => {
    const onSelect = jest.fn();
    render(<RecentSearchTicker items={mockItems} onSelectItem={onSelect} />);

    act(() => {
      jest.advanceTimersByTime(7000);
      jest.advanceTimersByTime(500);
    });

    fireEvent.press(screen.getByTestId("recent-search-ticker"));
    expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
  });
});
