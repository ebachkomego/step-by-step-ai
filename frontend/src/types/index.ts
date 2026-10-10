export interface RouteRequest {
  start_lat: number;
  start_lon: number;
  duration_minutes: number;
  scenario: string;
  is_circular: boolean;
  end_lat?: number;
  end_lon?: number;
  api_key?: string;
}

export interface RouteStop {
  name: string;
  category: string;
  lat: number;
  lon: number;
  spent_minutes: number;
  description: string;
  order: number;
}

export interface RouteResponse {
  total_walking_minutes: number;
  total_distance_meters: number;
  total_route_minutes: number;
  stops: RouteStop[];
  geojson: {
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
    properties?: Record<string, any>;
  };
  scenario: string;
  scenario_title: string;
  used_ai: boolean;
  ai_model?: string;
  notes?: string;
}

export interface ScenarioItem {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
}
