const axios = require('axios');
import { SessionData } from '../types/auth';
import { ModuleHistory, ModuleSummary, StationHistoryResponse, StationSummary, WeatherOverviewResponse, WeatherPoint, WeatherModuleType } from '../types/weather';

const NETATMO_STATIONS_URL = 'https://api.netatmo.com/api/getstationsdata';
const NETATMO_MEASURE_URL = 'https://api.netatmo.com/api/getmeasure';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type NetatmoDashboardData = {
  time_utc?: number;
  Temperature?: number;
  Humidity?: number;
  CO2?: number;
  min_temp?: number;
  max_temp?: number;
  sum_rain_24?: number;
};

type NetatmoModule = {
  _id: string;
  type: string;
  module_name?: string;
  reachable?: boolean;
  dashboard_data?: NetatmoDashboardData;
};

type NetatmoDevice = NetatmoModule & {
  station_name?: string;
  modules: NetatmoModule[];
};

type StationsResponse = {
  body: {
    devices: NetatmoDevice[];
  };
};

type MeasureBucket = {
  beg_time: number;
  step_time: number;
  value: number[][];
};

type MeasuresResponse = {
  body: MeasureBucket[];
};

export class NetatmoService {
  private overviewCache = new Map<string, CacheEntry<WeatherOverviewResponse>>();
  private historyCache = new Map<string, CacheEntry<StationHistoryResponse>>();
  private cacheTtlMs: number;

  constructor() {
    const cacheTtlMinutes = Number(process.env.CACHE_TTL_MINUTES || 5);
    this.cacheTtlMs = cacheTtlMinutes * 60 * 1000;
  }

  async getWeatherOverview(session: SessionData): Promise<WeatherOverviewResponse> {
    const cacheKey = 'overview:' + (session.accessToken || 'anonymous');
    const cached = this.getCached(this.overviewCache, cacheKey);

    if (cached) {
      return cached;
    }

    const stationsData = await this.fetchStations(session);
    const stations = stationsData.body.devices.map((device) => this.mapStationSummary(device));
    const payload: WeatherOverviewResponse = {
      fetchedAt: new Date().toISOString(),
      stations,
    };

    this.setCached(this.overviewCache, cacheKey, payload);

    return payload;
  }

  async getStationHistory(session: SessionData, stationId: string): Promise<StationHistoryResponse> {
    const cacheKey = 'history:' + stationId + ':' + (session.accessToken || 'anonymous');
    const cached = this.getCached(this.historyCache, cacheKey);

    if (cached) {
      return cached;
    }

    const stationsData = await this.fetchStations(session);
    const station = stationsData.body.devices.find((device) => device._id === stationId);

    if (!station) {
      throw this.createError(404, 'Station not found');
    }

    const outdoorRainModule = station.modules.find((module) => module.type === 'NAModule3');
    const candidates: NetatmoModule[] = [station as NetatmoModule].concat(
      station.modules.filter((module) => module.type === 'NAModule1' || module.type === 'NAModule4')
    );
    const modules = await Promise.all(
      candidates.map((module) => this.buildModuleHistory(session, station._id, module, outdoorRainModule || null))
    );

    const payload: StationHistoryResponse = {
      fetchedAt: new Date().toISOString(),
      stationId: station._id,
      stationName: station.station_name || station.module_name || 'Unnamed station',
      modules,
    };

    this.setCached(this.historyCache, cacheKey, payload);

    return payload;
  }

  clearCache(): void {
    this.overviewCache.clear();
    this.historyCache.clear();
  }

  private async fetchStations(session: SessionData): Promise<StationsResponse> {
    if (!session.accessToken) {
      throw this.createError(401, 'Missing access token');
    }

    const response = await axios.get(NETATMO_STATIONS_URL, {
      headers: {
        Authorization: 'Bearer ' + session.accessToken,
      },
      timeout: 10000,
    });

    return response.data;
  }

  private async buildModuleHistory(session: SessionData, stationId: string, module: NetatmoModule, rainModule: NetatmoModule | null): Promise<ModuleHistory> {
    const type = this.mapModuleType(module.type);
    const startOfTodayUnix = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const startYesterdayUnix = startOfTodayUnix - 24 * 60 * 60;

    const temperatureResponse = await this.fetchMeasurements(session, {
      device_id: stationId,
      module_id: module._id,
      scale: 'max',
      real_time: 'true',
      type: 'Temperature,Humidity',
      date_begin: String(startYesterdayUnix),
    });

    const temperatureData = this.mapTemperatureAndHumiditySeries(temperatureResponse.body, startOfTodayUnix);
    let rain: WeatherPoint[] = [];

    if (type === 'outdoor' && rainModule) {
      const rainResponse = await this.fetchMeasurements(session, {
        device_id: stationId,
        module_id: rainModule._id,
        scale: '30min',
        real_time: 'true',
        type: 'sum_rain',
        date_begin: String(startOfTodayUnix),
        limit: '100',
      });

      rain = this.mapRainSeries(rainResponse.body);
    }

    return {
      moduleId: module._id,
      moduleName: module.module_name || 'Unnamed module',
      moduleType: type,
      recentTemperatures: temperatureData.recentTemperatures,
      earlierTemperatures: temperatureData.earlierTemperatures,
      humidity: temperatureData.humidity,
      rain,
      minTemperature: temperatureData.minTemperature,
      maxTemperature: temperatureData.maxTemperature,
      minHumidity: temperatureData.minHumidity,
      maxHumidity: temperatureData.maxHumidity,
    };
  }

  private async fetchMeasurements(session: SessionData, params: Record<string, string>): Promise<MeasuresResponse> {
    if (!session.accessToken) {
      throw this.createError(401, 'Missing access token');
    }

    const response = await axios.get(NETATMO_MEASURE_URL, {
      headers: {
        Authorization: 'Bearer ' + session.accessToken,
      },
      params,
      timeout: 10000,
    });

    return response.data;
  }

  private mapStationSummary(device: NetatmoDevice): StationSummary {
    const outdoorRainModule = device.modules.find((module) => module.type === 'NAModule3');
    const visibleModules: NetatmoModule[] = [device as NetatmoModule].concat(
      device.modules.filter((module) => module.type === 'NAModule1' || module.type === 'NAModule4')
    );

    return {
      id: device._id,
      name: device.station_name || device.module_name || 'Unnamed station',
      modules: visibleModules.map((module) => this.mapModuleSummary(module, outdoorRainModule || null)),
    };
  }

  private mapModuleSummary(module: NetatmoModule, rainModule: NetatmoModule | null): ModuleSummary {
    const dashboard = module.dashboard_data || {};

    return {
      id: module._id,
      name: module.module_name || 'Unnamed module',
      type: this.mapModuleType(module.type),
      netatmoType: module.type,
      reachable: module.reachable !== false,
      lastSeenAt: dashboard.time_utc || null,
      temperature: this.numberOrNull(dashboard.Temperature),
      humidity: this.numberOrNull(dashboard.Humidity),
      co2: this.numberOrNull(dashboard.CO2),
      minTemperature: this.numberOrNull(dashboard.min_temp),
      maxTemperature: this.numberOrNull(dashboard.max_temp),
      rainLast24Hours: this.mapModuleType(module.type) === 'outdoor' && rainModule && rainModule.dashboard_data
        ? this.numberOrNull(rainModule.dashboard_data.sum_rain_24)
        : null,
    };
  }

  private mapTemperatureAndHumiditySeries(buckets: MeasureBucket[], startOfTodayUnix: number) {
    const recentTemperatures: WeatherPoint[] = [];
    const earlierTemperatures: WeatherPoint[] = [];
    const humidity: WeatherPoint[] = [];
    let minTemperature: number | null = null;
    let maxTemperature: number | null = null;
    let minHumidity: number | null = null;
    let maxHumidity: number | null = null;

    buckets.forEach((bucket) => {
      bucket.value.forEach((pair, index) => {
        const timestamp = bucket.beg_time + bucket.step_time * index;
        const temperature = typeof pair[0] === 'number' ? pair[0] : null;
        const humidityValue = typeof pair[1] === 'number' ? pair[1] : null;

        if (timestamp < startOfTodayUnix) {
          earlierTemperatures.push({
            timestamp: (timestamp + 24 * 60 * 60) * 1000,
            value: temperature,
          });
        } else {
          recentTemperatures.push({
            timestamp: timestamp * 1000,
            value: temperature,
          });
          humidity.push({
            timestamp: timestamp * 1000,
            value: humidityValue,
          });
        }

        if (temperature !== null) {
          minTemperature = minTemperature === null ? temperature : Math.min(minTemperature, temperature);
          maxTemperature = maxTemperature === null ? temperature : Math.max(maxTemperature, temperature);
        }

        if (humidityValue !== null) {
          minHumidity = minHumidity === null ? humidityValue : Math.min(minHumidity, humidityValue);
          maxHumidity = maxHumidity === null ? humidityValue : Math.max(maxHumidity, humidityValue);
        }
      });
    });

    recentTemperatures.push({
      timestamp: Date.now(),
      value: null,
    });

    return {
      recentTemperatures,
      earlierTemperatures,
      humidity,
      minTemperature,
      maxTemperature,
      minHumidity,
      maxHumidity,
    };
  }

  private mapRainSeries(buckets: MeasureBucket[]): WeatherPoint[] {
    const result: WeatherPoint[] = [];

    buckets.forEach((bucket) => {
      bucket.value.forEach((pair, index) => {
        result.push({
          timestamp: (bucket.beg_time + bucket.step_time * index) * 1000,
          value: typeof pair[0] === 'number' ? pair[0] : null,
        });
      });
    });

    return result;
  }

  private mapModuleType(type: string): WeatherModuleType {
    if (type === 'NAMain' || type === 'NAModule4') {
      return 'indoor';
    }

    if (type === 'NAModule1') {
      return 'outdoor';
    }

    if (type === 'NAModule3') {
      return 'rain_gauge';
    }

    return 'other';
  }

  private numberOrNull(value: number | undefined): number | null {
    return typeof value === 'number' ? value : null;
  }

  private getCached<T>(store: Map<string, CacheEntry<T>>, key: string): T | null {
    const cached = store.get(key);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }

    return cached.value;
  }

  private setCached<T>(store: Map<string, CacheEntry<T>>, key: string, value: T): void {
    store.set(key, {
      expiresAt: Date.now() + this.cacheTtlMs,
      value,
    });
  }

  private createError(status: number, message: string) {
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    return error;
  }
}
