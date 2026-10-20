export interface RouteRequest {
  start_lat: number;
  start_lon: number;
  duration_minutes: number;
  scenario: string;
  is_circular: boolean;
  end_lat?: number;
  end_lon?: number;
  custom_prompt?: string;
  activities?: string[];
  stop_count?: number; // 0 = auto based on duration
  api_key?: string;
}

export interface PlaceReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  avatar?: string;
}

export interface RouteStop {
  id?: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  spent_minutes: number;
  description: string;
  order: number;
  address?: string;
  rating?: number;
  reviews_count?: number;
  photo_url?: string;
  opening_hours?: string;
  tags?: string[];
  reviews?: PlaceReview[];
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
  ai_thought?: string;
  notes?: string;
}

export interface ScenarioItem {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
}

export type MapLayerType = 'map' | 'satellite' | 'hybrid';

export interface RouteHistoryItem {
  id: string;
  timestamp: number;
  dateFormatted: string;
  scenario_title: string;
  scenario: string;
  total_route_minutes: number;
  total_walking_minutes: number;
  total_distance_meters: number;
  stopsCount: number;
  stops: RouteStop[];
  routeData: RouteResponse;
  startLat: number;
  startLon: number;
  custom_prompt?: string;
}

