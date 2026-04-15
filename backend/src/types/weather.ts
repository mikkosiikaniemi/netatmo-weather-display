export type WeatherModuleType = 'indoor' | 'outdoor' | 'rain_gauge' | 'other';

export interface WeatherPoint {
  timestamp: number;
  value: number | null;
}

export interface ModuleSummary {
  id: string;
  name: string;
  type: WeatherModuleType;
  netatmoType: string;
  reachable: boolean;
  lastSeenAt: number | null;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  rainLast24Hours: number | null;
}

export interface StationSummary {
  id: string;
  name: string;
  modules: ModuleSummary[];
}

export interface WeatherOverviewResponse {
  fetchedAt: string;
  stations: StationSummary[];
}

export interface ModuleHistory {
  moduleId: string;
  moduleName: string;
  moduleType: WeatherModuleType;
  recentTemperatures: WeatherPoint[];
  earlierTemperatures: WeatherPoint[];
  humidity: WeatherPoint[];
  rain: WeatherPoint[];
  minTemperature: number | null;
  maxTemperature: number | null;
  minHumidity: number | null;
  maxHumidity: number | null;
}

export interface StationHistoryResponse {
  fetchedAt: string;
  stationId: string;
  stationName: string;
  modules: ModuleHistory[];
}
