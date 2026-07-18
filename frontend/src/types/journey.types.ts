export type PlanJourneyRequest = {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    text: string;
    lat?: number;
    lng?: number;
  };
  departureTime?: string;
  timePreference?: {
    type: "DEPARTURE" | "ARRIVAL";
    dateTime: string;
  };
};

export type ResolveDestinationRequest = {
  text: string;
  origin: {
    lat: number;
    lng: number;
  };
};

export type ParseTimeRequest = {
  text: string;
};

export type ParseTimeResponse = {
  time_mode: "NOW" | "DEPART_AT" | "ARRIVE_BY" | "UNKNOWN";
  target_datetime: string | null;
  confidence?: "high" | "medium" | "low";
};

export type DestinationOption = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
  type?: string;
  primaryType?: string;
  category?: string;
};


export type JourneyStep =
  | {
      type: "walk";
      instruction: string;
      distanceMeters: number;
      durationMin: number;
      polyline?: string;
      walkSteps?: {
        instruction: string;
        distanceMeters: number;
        durationMin: number;
        polyline?: string;
        startLocation?: { lat: number; lng: number };
        endLocation?: { lat: number; lng: number };
      }[];
    }
  | {
      type: "transit";
      line: string;
      lineShortName?: string;
      lineName?: string;
      from: string;
      to: string;
      departureTime: string;
      arrivalTime: string;
      departureDateTime?: string;
      arrivalDateTime?: string;
      stopCount: number;
      headsign: string;
      polyline?: string;
      departureLocation?: {
        lat: number;
        lng: number;
      };
      arrivalLocation?: {
        lat: number;
        lng: number;
      };
    }
  | {
      type: "unknown";
      instruction: string;
    };

export type JourneySummary = {
  timeType: "DEPARTURE" | "ARRIVAL";
  requestedTime: string;
  referenceDateTime?: string;

  leaveHomeAt: string;
  beAtStopAt: string;
  arrivalAtDestination: string;

  leaveHomeDateTime?: string;
  beAtStopDateTime?: string;
  arrivalAtDestinationDateTime?: string;

  leaveHomeText?: string;
  beAtStopText?: string;
  arrivalAtDestinationText?: string;

  totalDurationMin: number;
  busLines: string[];
  transfers: number;
  initialWalkTimeMin: number;
  finalWalkTimeMin: number;
  totalWalkTimeMin: number;
  busTimeMin: number;
};

export type MapMarker = {
  id: string;
  type: "user" | "boarding_stop" | "transfer_stop" | "dropoff_stop" | "destination" | "origin";
  title: string;
  description?: string;
  lat: number;
  lng: number;
};

export type MapPolyline = {
  id: string;
  type: "walk" | "bus";
  encodedPolyline: string;
  line?: string;
};

export type MapFocusMode = 'walking_to_stop' | 'on_bus' | 'transfer' | 'walking_to_destination' | 'full_route';

export type MapData = {
  userLocation: {
    lat: number;
    lng: number;
  };
  markers: MapMarker[];
  polylines: MapPolyline[];
};

export type JourneyResponse = {
  summary: JourneySummary;
  message: string;
  alerts: string[];
  steps: JourneyStep[];
  map?: MapData;
  metadata?: {
    selectedRouteIndex: number;
    alternativesFound: number;
    sessionId?: string;
  };
  // --- Novos Campos Conversacionais Opcionais ---
  speechText?: string;
  screen?: string;
  displayData?: {
    title: string;
    subtitle: string;
    items?: { label?: string; value?: string; name?: string; address?: string }[];
  };
  options?: string[];
  expectedInput?: "NONE" | "VOICE_OR_TOUCH";
  conversationState?: string;
  actions?: string[];
};

export interface ResolveDestinationResponse {
  mode?: "resolved" | "suggestions" | "not_found";
  queryType?: "generic_category" | "specific_place" | "address" | "unknown";
  message: string;
  interpretedDestination: string;
  options: DestinationOption[];
  resolvedDestination?: DestinationOption | null;
  candidates?: DestinationOption[];
  voice: {
    confirmationQuestion: string;
  };
  // --- Novos Campos Conversacionais Opcionais ---
  speechText?: string;
  screen?: string;
  displayData?: {
    title: string;
    subtitle: string;
    items?: { name?: string; address?: string }[];
  };
  expectedInput?: "NONE" | "VOICE_OR_TOUCH";
  conversationState?: string;
  actions?: string[];
  metadata?: {
    sessionId?: string;
    mode?: string;
    queryType?: string;
  };
}

export type ConversationalCommandRequest = {
  sessionId: string;
  command: "CONFIRM" | "CANCEL" | "REPEAT" | "SELECT_OPTION";
  payload?: {
    optionIndex?: number;
    optionName?: string;
  };
};

export type ConversationalCommandResponse = {
  speechText: string;
  screen: string;
  displayData: {
    title: string;
    subtitle: string;
    items?: { label?: string; value?: string; name?: string; address?: string }[];
  };
  options: string[];
  expectedInput: "NONE" | "VOICE_OR_TOUCH";
  conversationState: string;
  actions: string[];
  metadata: {
    sessionId: string;
    command: string;
    previousState: string;
    currentState: string;
  };
};
