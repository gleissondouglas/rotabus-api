import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ErrorModal } from "../components/ErrorModal";

describe("ErrorModal Component", () => {
  test("não deve renderizar quando visible for false", () => {
    const { queryByText } = render(
      <ErrorModal
        visible={false}
        message="Algo deu errado"
        onClose={jest.fn()}
      />,
    );
    expect(queryByText("Algo deu errado")).toBeNull();
  });

  test("deve renderizar título e mensagem quando visible for true", () => {
    const { getByText } = render(
      <ErrorModal
        visible={true}
        title="Aviso de Teste"
        message="Mensagem acolhedora de teste"
        onClose={jest.fn()}
      />,
    );
    expect(getByText("Aviso de Teste")).toBeTruthy();
    expect(getByText("Mensagem acolhedora de teste")).toBeTruthy();
  });

  test("deve disparar ação primária ao clicar no botão principal", () => {
    const onPrimaryAction = jest.fn();
    const { getByText } = render(
      <ErrorModal
        visible={true}
        message="Erro de conexão"
        primaryActionLabel="Tentar novamente"
        onPrimaryAction={onPrimaryAction}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(getByText("Tentar novamente"));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  test("deve renderizar e disparar ação secundária quando configurada", () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <ErrorModal
        visible={true}
        message="Não encontramos o local"
        secondaryActionLabel="Digitar destino"
        onSecondaryAction={onSecondaryAction}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Digitar destino")).toBeTruthy();
    fireEvent.press(getByText("Digitar destino"));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });
});
