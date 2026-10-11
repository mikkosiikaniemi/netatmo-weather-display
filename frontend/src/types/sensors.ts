export interface SensorReading {
  id: string
  deviceId: string
  name: string | null
  timestamp: string
  receivedAt: string
  temperature: number | null
  humidity: number | null
  battery: number | null
  values: Record<string, number>
}

export interface SensorReadingsResponse {
  fetchedAt: string
  deviceId: string | null
  hours: number
  count: number
  readings: SensorReading[]
}