import React, { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SensorReading } from '../types/sensors'

const TEMP_COLOR = '#ff3b30'
const HUMIDITY_COLOR = '#00b8ff'

interface SensorChartPoint {
  timestamp: number
  temperature: number | null
  humidity: number | null
  battery: number | null
}

interface SensorChartDatum extends SensorChartPoint {
  previousDayTemperature: number | null
}

export interface SensorDevice {
  deviceId: string
  name: string
  latest: SensorReading | null
  points: SensorChartPoint[]
}

export function groupReadingsByDevice(readings: SensorReading[]): SensorDevice[] {
  const byDevice = new Map<string, SensorReading[]>()

  readings.forEach((reading) => {
    const list = byDevice.get(reading.deviceId) || []
    list.push(reading)
    byDevice.set(reading.deviceId, list)
  })

  return Array.from(byDevice.entries())
    .map(([deviceId, deviceReadings]) => {
      const sortedReadings = [...deviceReadings].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
      )

      return {
        deviceId,
        name: (deviceReadings[0] && deviceReadings[0].name) || deviceId,
        latest: sortedReadings.length > 0 ? sortedReadings[sortedReadings.length - 1] : null,
        points: sortedReadings.map((reading) => ({
          timestamp: Date.parse(reading.timestamp),
          temperature: reading.temperature,
          humidity: reading.humidity,
          battery: reading.battery,
        })),
      }
    })
    .sort((a, b) => {
      const aLatest = a.latest ? Date.parse(a.latest.timestamp) : 0
      const bLatest = b.latest ? Date.parse(b.latest.timestamp) : 0
      return bLatest - aLatest
    })
}

function buildSensorChartData(points: SensorChartPoint[], dayWindow: { start: number; end: number }, evenHourTicks: number[]) {
  const dayMs = 24 * 60 * 60 * 1000
  const previousDayStart = dayWindow.start - dayMs

  const todayPoints: SensorChartDatum[] = points
    .filter((point) => point.timestamp >= dayWindow.start && point.timestamp < dayWindow.end)
    .map((point) => ({ ...point, previousDayTemperature: null }))

  const previousDayPoints = points
    .filter((point) => point.timestamp >= previousDayStart && point.timestamp < dayWindow.start)
    .map((point) => ({
      timestamp: point.timestamp + dayMs,
      temperature: point.temperature,
    }))

  const temperatureDomain = getSharedSensorTemperatureDomain(todayPoints, previousDayPoints)
  const temperatureTicks = buildTemperatureTicks(temperatureDomain, 2)
  const humidityDomain = getSharedSensorHumidityDomain(todayPoints)

  return {
    todayPoints,
    previousDaySeries: previousDayPoints,
    temperatureDomain,
    temperatureTicks,
    humidityDomain,
    evenHourTicks,
  }
}

function getSharedSensorTemperatureDomain(
  todayPoints: SensorChartDatum[],
  previousDayPoints: Array<{ temperature: number | null }>
): [number, number] | ['auto', 'auto'] {
  const allTemperatures = [...todayPoints, ...previousDayPoints]
    .map((point) => point.temperature)
    .filter((value): value is number => Number.isFinite(value))

  if (allTemperatures.length === 0) {
    return ['auto', 'auto']
  }

  const minValue = Math.min(...allTemperatures)
  const maxValue = Math.max(...allTemperatures)

  return [Math.floor(minValue - 1), Math.ceil(maxValue + 1)]
}

function getSharedSensorHumidityDomain(todayPoints: SensorChartDatum[]): [number, number] | ['auto', 'auto'] {
  const allHumidityValues = todayPoints
    .map((point) => point.humidity)
    .filter((value): value is number => Number.isFinite(value))

  if (allHumidityValues.length === 0) {
    return ['auto', 'auto']
  }

  const minValue = Math.min(...allHumidityValues)

  return [minValue, 100]
}

export function SensorReadingCard(props: { device: SensorDevice; dayWindow: { start: number; end: number }; evenHourTicks: number[] }) {
  const { device, dayWindow, evenHourTicks } = props
  const hasPoints = device.points.length > 0
  const chartData = useMemo(() => buildSensorChartData(device.points, dayWindow, evenHourTicks), [device.points, dayWindow, evenHourTicks])

  return (
    <article className="rounded-lg bg-zinc-950 p-5 pt-4 pb-1 flex flex-row md:flex-col gap-2">
      <div className="text-data">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2">
            <p
              className="text-lg font-semibold text-zinc-100"
              title={device.latest ? 'Last seen: ' + formatLastUpdated(device.latest.receivedAt) : device.deviceId}
            >
              {device.name || device.deviceId}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span
              className="inline-flex items-center gap-1"
              title={device.latest && device.latest.humidity !== null ? 'Humidity: ' + device.latest.humidity + '%' : 'Humidity unavailable'}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" />
              </svg>
              <span>{device.latest && device.latest.humidity !== null ? device.latest.humidity.toFixed(0) + '%' : '--'}</span>
            </span>
            {device.latest && device.latest.battery !== null ? (
              <span
                className="inline-flex items-center gap-1"
                title={'Battery: ' + device.latest.battery.toFixed(0) + '%'}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.5" y="8" width="16" height="8" rx="1.5" />
                  <path d="M21.5 11v2" />
                </svg>
                <span>{device.latest.battery.toFixed(0) + '%'}</span>
              </span>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-7xl font-bold leading-none text-center">
          <TemperatureDisplay value={device.latest ? device.latest.temperature : null} />
        </p>
      </div>

      {hasPoints ? (
        <div className="-mx-2 h-36 flex-auto">
          <ResponsiveContainer width="100%" height="100%" debounce={120}>
            <ComposedChart data={chartData.todayPoints} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={'sensorTempFill-' + device.deviceId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEMP_COLOR} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TEMP_COLOR} stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(161,161,170,0.22)" strokeDasharray="2 3" yAxisId="temp" />
              <XAxis
                type="number"
                dataKey="timestamp"
                domain={[dayWindow.start, dayWindow.end]}
                allowDataOverflow
                ticks={evenHourTicks}
                tickFormatter={formatHourTick}
                minTickGap={14}
                stroke="rgba(161,161,170,0.35)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'rgba(161,161,170,0.64)' }}
              />
              <YAxis
                yAxisId="temp"
                stroke="rgba(161,161,170,0.18)"
                domain={chartData.temperatureDomain}
                ticks={chartData.temperatureTicks}
                interval={0}
                tickFormatter={(value: number | string) =>
                  formatTemperatureTickLabel(value, chartData.temperatureDomain)
                }
                tick={{ fontSize: 9, fill: 'rgba(161,161,170,0.64)' }}
                width={28}
              />
              <YAxis
                yAxisId="humidity"
                orientation="right"
                stroke="rgba(161,161,170,0.18)"
                domain={chartData.humidityDomain}
                tick={{ fontSize: 9, fill: 'rgba(161,161,170,0.64)' }}
                width={28}
              />
              <Tooltip content={<SensorChartTooltip />} />
              <Line
                yAxisId="humidity"
                type="monotone"
                dataKey="humidity"
                name="Humidity %"
                stroke={HUMIDITY_COLOR}
                strokeWidth={1.7}
                dot={false}
                strokeOpacity={0.5}
                isAnimationActive={false}
              />
              {chartData.previousDaySeries.length > 0 ? (
                <Line
                  yAxisId="temp"
                  type="monotone"
                  data={chartData.previousDaySeries}
                  dataKey="temperature"
                  name="Temp yesterday"
                  stroke={TEMP_COLOR}
                  strokeWidth={1.6}
                  strokeOpacity={0.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Temperature °C"
                fill={'url(#sensorTempFill-' + device.deviceId + ')'}
                fillOpacity={1}
                stroke={TEMP_COLOR}
                strokeWidth={2.1}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">No readings in the last 48 hours yet.</p>
      )}
    </article>
  )
}

function SensorChartTooltip(props: {
  active?: boolean
  label?: number | string
  payload?: Array<{
    payload?: {
      temperature?: number | null
      humidity?: number | null
    }
  }>
}) {
  if (!props.active || !props.payload || props.payload.length === 0) {
    return null
  }

  const point = props.payload[0] && props.payload[0].payload ? props.payload[0].payload : {}
  const formattedLabel = props.label !== undefined ? formatTooltipTimestamp(props.label) : '--'

  return (
    <div className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      <p className="mb-1 text-zinc-300">{formattedLabel}</p>
      <p>Temperature: {typeof point.temperature === 'number' ? point.temperature.toFixed(1) + ' C' : '--'}</p>
      <p>Humidity: {typeof point.humidity === 'number' ? point.humidity.toFixed(0) + ' %' : '--'}</p>
    </div>
  )
}

function TemperatureDisplay(props: { value: number | null }) {
  if (props.value === null) {
    return <span>--</span>
  }

  const [mainDigits, fractionalDigit = '0'] = props.value.toFixed(1).split('.')

  return (
    <span className="font-temperature inline-flex items-baseline gap-2 font-bold tracking-tight">
      {mainDigits}
      <span className="align-bottom text-[0.5em] tracking-wide opacity-40">{fractionalDigit}°</span>
    </span>
  )
}

function formatHourTick(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit' })
}

function buildTemperatureTicks(
  domain: [number, number] | ['auto', 'auto'],
  step: number
): number[] | undefined {
  if (domain[0] === 'auto') {
    return undefined
  }

  const [minValue, maxValue] = domain

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue >= maxValue || step <= 0) {
    return undefined
  }

  const firstTick = Math.ceil(minValue / step) * step
  const ticks: number[] = []

  for (let value = firstTick; value <= maxValue; value += step) {
    ticks.push(Number(value.toFixed(4)))
  }

  if (ticks.length === 0 || ticks[0] !== minValue) {
    ticks.unshift(minValue)
  }

  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue)
  }

  return ticks
}

function formatTemperatureTickLabel(
  value: number | string,
  domain: [number, number] | ['auto', 'auto']
) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  if (domain[0] !== 'auto') {
    const [, maxValue] = domain

    if (Math.abs(numericValue - maxValue) < 0.0001) {
      return ''
    }
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1)
}

function formatTooltipTimestamp(value: number | string) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return new Date(numericValue).toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLastUpdated(value: string) {
  const minutesAgo = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))

  if (minutesAgo < 1) {
    return 'just now'
  }

  if (minutesAgo < 60) {
    return minutesAgo + 'm ago'
  }

  const hoursAgo = Math.floor(minutesAgo / 60)
  return hoursAgo + 'h ago'
}