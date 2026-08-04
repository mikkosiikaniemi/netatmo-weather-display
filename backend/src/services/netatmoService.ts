const axios = require('axios');
import { SessionData } from '../types/auth';
import { ForecastResponse, ModuleHistory, ModuleSummary, StationHistoryResponse, StationSummary, WeatherOverviewResponse, WeatherPoint, WeatherModuleType } from '../types/weather';

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
  place?: {
    altitude?: number;
    location?: number[];
  };
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
  private forecastCache = new Map<string, CacheEntry<ForecastResponse>>();
  private cacheTtlMs: number;
  private netatmoRetryAttempts: number;
  private netatmoRetryBaseDelayMs: number;

  constructor() {
    const cacheTtlMinutes = Number(process.env.CACHE_TTL_MINUTES || 5);
    this.cacheTtlMs = cacheTtlMinutes * 60 * 1000;
    this.netatmoRetryAttempts = Math.max(1, Number(process.env.NETATMO_RETRY_ATTEMPTS || 4));
    this.netatmoRetryBaseDelayMs = Math.max(250, Number(process.env.NETATMO_RETRY_BASE_DELAY_MS || 1000));
  }

  async getWeatherOverview(session: SessionData): Promise<WeatherOverviewResponse> {
    const cacheKey = 'overview:' + this.getSessionCacheScope(session);
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
    const cacheKey = 'history:' + stationId + ':' + this.getSessionCacheScope(session);
    const cached = this.getCached(this.historyCache, cacheKey);
    const staleCached = this.getCachedValue(this.historyCache, cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const stationsData = await this.fetchStations(session);
      const station = stationsData.body.devices.find((device) => device._id === stationId);

      if (!station) {
        throw this.createError(404, 'Station not found');
      }

      const outdoorRainModule = station.modules.find((module) => module.type === 'NAModule3');
      const candidates: NetatmoModule[] = [station as NetatmoModule].concat(
        station.modules.filter((module) => module.type === 'NAModule1' || module.type === 'NAModule4')
      );
      const cachedModulesById = new Map<string, ModuleHistory>(
        (staleCached ? staleCached.modules : []).map((module) => [module.moduleId, module])
      );
      const moduleResults = await Promise.all(
        candidates.map(async (module) => {
          try {
            const history = await this.buildModuleHistory(session, station._id, module, outdoorRainModule || null);
            return {
              moduleId: module._id,
              history,
              fetchFailed: false,
            };
          } catch (error) {
            console.warn('[netatmoService] Failed to load history for module', {
              stationId: station._id,
              moduleId: module._id,
              moduleType: module.type,
              error: error && (error as any).message ? (error as any).message : String(error),
            });
            return {
              moduleId: module._id,
              history: null,
              fetchFailed: true,
            };
          }
        })
      );

      const failedModuleIds = moduleResults
        .filter((result) => result.fetchFailed)
        .map((result) => result.moduleId);
      const modules = moduleResults
        .map((result) => {
          if (result.history) {
            return result.history;
          }

          const cachedModule = cachedModulesById.get(result.moduleId);
          return cachedModule ? this.withModuleFetchFailed(cachedModule, true) : null;
        })
        .filter((module): module is ModuleHistory => module !== null);

      if (modules.length === 0) {
        if (staleCached) {
          const fallbackPayload = this.withStationFetchFallback(staleCached, staleCached.modules.map((module) => module.moduleId));
          this.setCached(this.historyCache, cacheKey, fallbackPayload);
          return fallbackPayload;
        }

        throw this.createError(502, 'Unable to load history from Netatmo for any module');
      }

      const payload: StationHistoryResponse = {
        fetchedAt: new Date().toISOString(),
        stationId: station._id,
        stationName: station.station_name || station.module_name || 'Unnamed station',
        usedCachedFallback: failedModuleIds.length > 0,
        failedModuleIds,
        modules,
      };

      this.setCached(this.historyCache, cacheKey, payload);

      return payload;
    } catch (error) {
      if (staleCached) {
        const fallbackPayload = this.withStationFetchFallback(staleCached, staleCached.modules.map((module) => module.moduleId));
        this.setCached(this.historyCache, cacheKey, fallbackPayload);
        return fallbackPayload;
      }

      throw error;
    }
  }

  clearCache(): void {
    this.overviewCache.clear();
    this.historyCache.clear();
    this.forecastCache.clear();
  }

  async getForecast(session: SessionData): Promise<ForecastResponse> {
    const cacheKey = 'forecast:' + this.getSessionCacheScope(session);
    const cached = this.getCached(this.forecastCache, cacheKey);

    if (cached) {
      return cached;
    }

    const configuredLatitude = this.getNumericEnvValue('FORECAST_LAT');
    const configuredLongitude = this.getNumericEnvValue('FORECAST_LON');
    const configuredAltitude = this.getNumericEnvValue('FORECAST_ALTITUDE');
    const hasConfiguredLatitude = configuredLatitude !== null;
    const hasConfiguredLongitude = configuredLongitude !== null;

    if (hasConfiguredLatitude !== hasConfiguredLongitude) {
      throw this.createError(400, 'FORECAST_LAT and FORECAST_LON must be set together');
    }

    let latitude = configuredLatitude;
    let longitude = configuredLongitude;
    let altitude = configuredAltitude !== null ? configuredAltitude : 0;

    if (latitude === null || longitude === null) {
      const stationsData = await this.fetchStations(session);
      const station = stationsData.body.devices[0];

      if (!station || !station.place || !Array.isArray(station.place.location) || station.place.location.length < 2) {
        throw this.createError(400, 'Station coordinates are not available');
      }

      longitude = Number(station.place.location[0]);
      latitude = Number(station.place.location[1]);
      altitude = configuredAltitude !== null
        ? configuredAltitude
        : (typeof station.place.altitude === 'number' ? station.place.altitude : 0);
    }

    const forecastUrl = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
    const forecastResponse = await axios.get(forecastUrl, {
      params: {
        lat: String(latitude),
        lon: String(longitude),
        altitude: String(altitude),
      },
      headers: {
        'User-Agent': 'netatmo-weather-display-modernized/1.0 github.com/mikkosiikaniemi/netatmo-weather-display',
      },
      timeout: 10000,
    });

    const timeseries = forecastResponse.data && forecastResponse.data.properties && forecastResponse.data.properties.timeseries
      ? forecastResponse.data.properties.timeseries
      : [];

    const now = Date.now();
    const hourly = timeseries
      .map((entry: any) => {
        const ts = new Date(entry.time).getTime();
        const instant = entry.data && entry.data.instant && entry.data.instant.details ? entry.data.instant.details : {};
        const oneHour = entry.data && entry.data.next_1_hours ? entry.data.next_1_hours : null;
        const sixHours = entry.data && entry.data.next_6_hours ? entry.data.next_6_hours : null;
        const summary = oneHour && oneHour.summary ? oneHour.summary : (sixHours && sixHours.summary ? sixHours.summary : null);
        const details = oneHour && oneHour.details ? oneHour.details : (sixHours && sixHours.details ? sixHours.details : {});

        return {
          timestamp: ts,
          airTemperature: typeof instant.air_temperature === 'number' ? instant.air_temperature : 0,
          windSpeed: typeof instant.wind_speed === 'number' ? instant.wind_speed : 0,
          windFromDirection: typeof instant.wind_from_direction === 'number' ? instant.wind_from_direction : 0,
          symbolCode: summary && summary.symbol_code ? summary.symbol_code : 'clearsky_day',
          precipitationAmount: typeof details.precipitation_amount === 'number' ? details.precipitation_amount : 0,
          precipitationAmountMax: typeof details.precipitation_amount_max === 'number'
            ? Math.max(0, details.precipitation_amount_max)
            : (typeof details.precipitation_amount === 'number' ? Math.max(0, details.precipitation_amount) : 0),
          precipitationProbability: typeof details.probability_of_precipitation === 'number'
            ? Math.max(0, Math.min(100, details.probability_of_precipitation))
            : 0,
        };
      })
      .filter((entry: any) => entry.timestamp >= now)
      .slice(0, 24);

    const payload: ForecastResponse = {
      fetchedAt: new Date().toISOString(),
      latitude,
      longitude,
      altitude,
      hourly,
    };

    this.setCached(this.forecastCache, cacheKey, payload);

    return payload;
  }

  private getNumericEnvValue(name: string): number | null {
    const rawValue = process.env[name];

    if (typeof rawValue !== 'string' || rawValue.trim() === '') {
      return null;
    }

    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      throw this.createError(400, 'Invalid numeric environment variable: ' + name);
    }

    return parsed;
  }

  private async fetchStations(session: SessionData): Promise<StationsResponse> {
    if (!session.accessToken) {
      throw this.createError(401, 'Missing access token');
    }

    const response = await this.fetchNetatmoWithRetry('getstationsdata', {
      url: NETATMO_STATIONS_URL,
      method: 'get',
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

    const temperatureParams: Record<string, string> = {
      device_id: stationId,
      scale: 'max',
      real_time: 'true',
      type: 'Temperature,Humidity',
      date_begin: String(startYesterdayUnix),
    };

    // Netatmo main module is addressed by device_id only; extra module_id may fail.
    if (module._id !== stationId) {
      temperatureParams.module_id = module._id;
    }

    const temperatureResponse = await this.fetchMeasurements(session, temperatureParams);

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
      historyFetchFailed: false,
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

    const response = await this.fetchNetatmoWithRetry('getmeasure', {
      url: NETATMO_MEASURE_URL,
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + session.accessToken,
      },
      params,
      timeout: 10000,
    });

    return response.data;
  }

  private async fetchNetatmoWithRetry(requestName: string, config: any): Promise<any> {
    let attempt = 1;

    while (true) {
      try {
        return await axios(config);
      } catch (error) {
        const status = error && (error as any).response ? (error as any).response.status : null;
        const canRetry = status === 503 && attempt < this.netatmoRetryAttempts;

        if (!canRetry) {
          if (status === 503) {
            throw this.createError(503, 'Netatmo API temporarily unavailable. Please try again shortly.');
          }
          throw error;
        }

        const retryAfterHeader = (error as any).response && (error as any).response.headers
          ? (error as any).response.headers['retry-after']
          : null;
        const retryAfterMs = this.parseRetryAfterMs(retryAfterHeader);
        const fallbackDelayMs = this.netatmoRetryBaseDelayMs * Math.pow(2, attempt - 1);
        const delayMs = retryAfterMs !== null ? retryAfterMs : fallbackDelayMs;

        console.warn('[netatmoService] Netatmo 503, retrying request', {
          requestName,
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
        });

        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }

  private parseRetryAfterMs(retryAfterHeader: unknown): number | null {
    if (typeof retryAfterHeader !== 'string' || retryAfterHeader.trim() === '') {
      return null;
    }

    const asSeconds = Number(retryAfterHeader);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return asSeconds * 1000;
    }

    const asDateMs = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDateMs)) {
      return Math.max(0, asDateMs - Date.now());
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private mapStationSummary(device: NetatmoDevice): StationSummary {
    const outdoorRainModule = device.modules.find((module) => module.type === 'NAModule3');
    const visibleModules: NetatmoModule[] = [device as NetatmoModule].concat(
      device.modules.filter((module) => module.type === 'NAModule1' || module.type === 'NAModule4')
    );

    return {
      id: device._id,
      name: device.station_name || device.module_name || 'Unnamed station',
      latitude: device.place && Array.isArray(device.place.location) && device.place.location.length > 1
        ? Number(device.place.location[1])
        : null,
      longitude: device.place && Array.isArray(device.place.location) && device.place.location.length > 0
        ? Number(device.place.location[0])
        : null,
      altitude: device.place && typeof device.place.altitude === 'number' ? device.place.altitude : null,
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

  private getCachedValue<T>(store: Map<string, CacheEntry<T>>, key: string): T | null {
    const cached = store.get(key);
    return cached ? cached.value : null;
  }

  private withStationFetchFallback(payload: StationHistoryResponse, failedModuleIds: string[]): StationHistoryResponse {
    const failedIdsSet = new Set(failedModuleIds);

    return {
      ...payload,
      usedCachedFallback: true,
      failedModuleIds: failedModuleIds.slice(),
      modules: payload.modules.map((module) => this.withModuleFetchFailed(module, failedIdsSet.has(module.moduleId))),
    };
  }

  private withModuleFetchFailed(module: ModuleHistory, historyFetchFailed: boolean): ModuleHistory {
    return {
      ...module,
      historyFetchFailed,
    };
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

  private getSessionCacheScope(session: SessionData): string {
    // Refresh token is stable across access-token rotations, which keeps cache continuity.
    return session.refreshToken || session.accessToken || 'anonymous';
  }
}
