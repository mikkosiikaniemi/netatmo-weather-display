import fs = require('fs');
import path = require('path');
import crypto = require('crypto');
import { SensorReading } from '../types/sensors';

const RETENTION_HOURS = 48;
const RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000;
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'sensor-readings.json');

let readings: SensorReading[] = [];
let loaded = false;

function ensureLoaded(): void {
  if (loaded) {
    return;
  }

  loaded = true;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        readings = parsed.filter((entry) => entry && typeof entry.timestamp === 'string');
      }
    }
  } catch (error) {
    console.error('Failed to load sensor readings, starting empty:', (error as Error).message);
    readings = [];
  }

  prune();
}

function prune(): void {
  const cutoff = Date.now() - RETENTION_MS;
  readings = readings.filter((reading) => Date.parse(reading.timestamp) >= cutoff);
  readings.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function persist(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(readings), 'utf8');
  } catch (error) {
    console.error('Failed to persist sensor readings:', (error as Error).message);
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const TEMP_KEYS = ['temperature', 'temp', 'temperatureCelsius'];
const HUMIDITY_KEYS = ['humidity', 'relativeHumidity', 'hum'];
const BATTERY_KEYS = ['battery', 'batteryLevel'];

function firstNumber(body: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(body[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function addReading(body: Record<string, unknown>): SensorReading {
  ensureLoaded();

  const now = Date.now();
  const providedTimestamp = toNumber(body.timestamp);
  const timestampMs = providedTimestamp !== null
    ? (providedTimestamp > 1e12 ? providedTimestamp : providedTimestamp * 1000)
    : now;

  const temperature = firstNumber(body, TEMP_KEYS);
  const humidity = firstNumber(body, HUMIDITY_KEYS);
  const battery = firstNumber(body, BATTERY_KEYS);

  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    const numeric = toNumber(value);
    if (numeric !== null) {
      values[key] = numeric;
    }
  }

  const deviceId = typeof body.deviceId === 'string' && body.deviceId.trim()
    ? body.deviceId.trim().slice(0, 64)
    : 'timmerflotte';

  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 64)
    : null;

  const reading: SensorReading = {
    id: crypto.randomBytes(8).toString('hex'),
    deviceId,
    name,
    timestamp: new Date(timestampMs).toISOString(),
    receivedAt: new Date(now).toISOString(),
    temperature,
    humidity,
    battery,
    values,
  };

  readings.push(reading);
  prune();
  persist();

  return reading;
}

export function getReadings(deviceId?: string): SensorReading[] {
  ensureLoaded();
  prune();

  if (!deviceId) {
    return [...readings];
  }

  return readings.filter((reading) => reading.deviceId === deviceId);
}

export function getLatestReading(deviceId?: string): SensorReading | null {
  const matching = getReadings(deviceId);
  return matching.length ? matching[matching.length - 1] : null;
}

export function getRetentionHours(): number {
  return RETENTION_HOURS;
}
