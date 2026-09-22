import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PermissionsScreen from "../../app/permissoes";
import { locationService } from "../services/location.service";
import { sessionService } from "../services/session.service";
import { router } from "expo-router";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("../components/ListenOptionsButton", () => ({
  ListenOptionsButton: () => null,
}));

jest.mock("../components/BackgroundGradient", () => ({
  BackgroundGradient: () => null,
}));

jest.mock("../components/ScreenContainer", () => ({
  ScreenContainer: ({ children }: any) => children,
}));

jest.mock("../services/location.service", () => ({
  locationService: {
    requestLocationPermission: jest.fn(),
    getCurrentLocation: jest.fn(),
  },
}));

jest.mock("../services/session.service", () => ({
  sessionService: {
    setHasSeenPermissions: jest.fn(),
  },
}));

describe("PermissionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with new card layout and text", () => {
    const screen = render(<PermissionsScreen />);

    expect(screen.getByText("Precisamos da sua permissão")).toBeTruthy();
    expect(screen.getByText("Microfone")).toBeTruthy();
    expect(screen.getByText("Localização")).toBeTruthy();
    expect(screen.getByText("Notificações")).toBeTruthy();
    expect(screen.getByText("OPCIONAL")).toBeTruthy(); // novo pill
    expect(screen.getByText("Permitir e continuar")).toBeTruthy();
  });

  it("navigates to inicio when permissions are granted", async () => {
    (locationService.requestLocationPermission as jest.Mock).mockResolvedValue(true);
    (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
    });
    (sessionService.setHasSeenPermissions as jest.Mock).mockResolvedValue(undefined);

    const screen = render(<PermissionsScreen />);
    const button = screen.getByText("Permitir e continuar");

    fireEvent.press(button);

    await waitFor(() => {
      expect(locationService.requestLocationPermission).toHaveBeenCalled();
      expect(locationService.getCurrentLocation).toHaveBeenCalled();
      expect(sessionService.setHasSeenPermissions).toHaveBeenCalledWith(true);
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/inicio",
        params: {
          latitude: "-23.5505",
          longitude: "-46.6333",
        },
      });
    });
  });
});
