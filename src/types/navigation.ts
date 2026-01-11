export interface Coordinates {
  lng: number;
  lat: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
  };
}

export interface Route {
  id: string;
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
  steps: RouteStep[];
  isAlternative?: boolean;
}

export interface POI {
  id: string;
  name: string;
  type: 'gas_station' | 'hospital' | 'police' | 'parking' | 'restaurant';
  coordinates: Coordinates;
  icon: string;
}

export interface TrafficAlert {
  id: string;
  type: 'accident' | 'police' | 'construction' | 'hazard';
  coordinates: Coordinates;
  description: string;
  timestamp: number;
  reportedBy: string;
  validated: boolean;
}

export interface NavigationState {
  origin: Coordinates | null;
  destination: Coordinates | null;
  currentLocation: Coordinates | null;
  routes: Route[];
  selectedRoute: Route | null;
  isNavigating: boolean;
  currentStepIndex: number;
  isDarkMode: boolean;
}
