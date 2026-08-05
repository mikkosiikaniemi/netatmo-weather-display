import React, { useEffect, useMemo, useState } from 'react'
import Loading from './Loading'
import { Area, Bar, CartesianGrid, ComposedChart, Line, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useForecastData } from '../hooks/useForecastData'
import { useWeatherData } from '../hooks/useWeatherData'
import { useStationHistory } from '../hooks/useStationHistory'
import { ModuleHistory } from '../types/weather'

const QUERY_REFETCH_INTERVAL_MS = 10.5 * 60 * 1000

const TEMP_COLOR = '#ff3b30'
const HUMIDITY_COLOR = '#00b8ff'
const FORECAST_RAIN_COLOR = 'hsla(197, 100%, 60%, 0.98)'

const YR_SYMBOL_ID_BY_CODE: Record<string, string> = {
  clearsky_day: '01d',
  clearsky_night: '01n',
  clearsky_polartwilight: '01m',
  fair_day: '02d',
  fair_night: '02n',
  fair_polartwilight: '02m',
  partlycloudy_day: '03d',
  partlycloudy_night: '03n',
  partlycloudy_polartwilight: '03m',
  cloudy: '04',
  rainshowers_day: '05d',
  rainshowers_night: '05n',
  rainshowers_polartwilight: '05m',
  rainshowersandthunder_day: '06d',
  rainshowersandthunder_night: '06n',
  rainshowersandthunder_polartwilight: '06m',
  sleetshowers_day: '07d',
  sleetshowers_night: '07n',
  sleetshowers_polartwilight: '07m',
  snowshowers_day: '08d',
  snowshowers_night: '08n',
  snowshowers_polartwilight: '08m',
  rain: '09',
  heavyrain: '10',
  heavyrainandthunder: '11',
  sleet: '12',
  snow: '13',
  snowandthunder: '14',
  fog: '15',
  sleetshowersandthunder_day: '20d',
  sleetshowersandthunder_night: '20n',
  sleetshowersandthunder_polartwilight: '20m',
  snowshowersandthunder_day: '21d',
  snowshowersandthunder_night: '21n',
  snowshowersandthunder_polartwilight: '21m',
  rainandthunder: '22',
  sleetandthunder: '23',
  lightrainshowersandthunder_day: '24d',
  lightrainshowersandthunder_night: '24n',
  lightrainshowersandthunder_polartwilight: '24m',
  heavyrainshowersandthunder_day: '25d',
  heavyrainshowersandthunder_night: '25n',
  heavyrainshowersandthunder_polartwilight: '25m',
  lightssleetshowersandthunder_day: '26d',
  lightssleetshowersandthunder_night: '26n',
  lightssleetshowersandthunder_polartwilight: '26m',
  lightsleetshowersandthunder_day: '26d',
  lightsleetshowersandthunder_night: '26n',
  lightsleetshowersandthunder_polartwilight: '26m',
  heavysleetshowersandthunder_day: '27d',
  heavysleetshowersandthunder_night: '27n',
  heavysleetshowersandthunder_polartwilight: '27m',
  lightssnowshowersandthunder_day: '28d',
  lightssnowshowersandthunder_night: '28n',
  lightssnowshowersandthunder_polartwilight: '28m',
  lightsnowshowersandthunder_day: '28d',
  lightsnowshowersandthunder_night: '28n',
  lightsnowshowersandthunder_polartwilight: '28m',
  heavysnowshowersandthunder_day: '29d',
  heavysnowshowersandthunder_night: '29n',
  heavysnowshowersandthunder_polartwilight: '29m',
  lightrainandthunder: '30',
  lightsleetandthunder: '31',
  heavysleetandthunder: '32',
  lightsnowandthunder: '33',
  heavysnowandthunder: '34',
  lightrainshowers_day: '40d',
  lightrainshowers_night: '40n',
  lightrainshowers_polartwilight: '40m',
  heavyrainshowers_day: '41d',
  heavyrainshowers_night: '41n',
  heavyrainshowers_polartwilight: '41m',
  lightsleetshowers_day: '42d',
  lightsleetshowers_night: '42n',
  lightsleetshowers_polartwilight: '42m',
  heavysleetshowers_day: '43d',
  heavysleetshowers_night: '43n',
  heavysleetshowers_polartwilight: '43m',
  lightsnowshowers_day: '44d',
  lightsnowshowers_night: '44n',
  lightsnowshowers_polartwilight: '44m',
  heavysnowshowers_day: '45d',
  heavysnowshowers_night: '45n',
  heavysnowshowers_polartwilight: '45m',
  lightrain: '46',
  lightsleet: '47',
  heavysleet: '48',
  lightsnow: '49',
  heavysnow: '50',
}

interface DashboardProps {
  authStatus: {
    user: null | {
      scope: string | null
      expiresAt: number | null
    }
  }
  onLogout: () => void
}

function Dashboard(props: DashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())
  const [isMetaOpen, setIsMetaOpen] = useState(false)
  const weatherQuery = useWeatherData()
  const forecastQuery = useForecastData()
  const stations = weatherQuery.data ? weatherQuery.data.stations : []
  const selectedStation = stations.length > 0 ? stations[0] : null
  const selectedStationId = selectedStation ? selectedStation.id : null
  const historyQuery = useStationHistory(selectedStationId)

  const stationModules = selectedStation ? selectedStation.modules : []
  const outdoorModule = stationModules.find((module) => module.type === 'outdoor') || null
  const indoorModules = stationModules.filter((module) => module.type === 'indoor')
  const failedHistoryModuleIds = useMemo(
    () => new Set(historyQuery.data ? historyQuery.data.failedModuleIds : []),
    [historyQuery.data]
  )
  const outdoorHistory = historyQuery.data
    ? historyQuery.data.modules.find((module) => module.moduleId === (outdoorModule ? outdoorModule.id : '')) || null
    : null
  const outdoorHistoryFetchFailed = Boolean(
    outdoorModule && (failedHistoryModuleIds.has(outdoorModule.id) || (outdoorHistory && outdoorHistory.historyFetchFailed))
  )
  const indoorHistoryById = useMemo(() => {
    const map: Record<string, ModuleHistory> = {}

    if (!historyQuery.data) {
      return map
    }

    historyQuery.data.modules.forEach((module) => {
      map[module.moduleId] = module
    })

    return map
  }, [historyQuery.data])

  const sunTimes = useMemo(() => {
    const station = selectedStation
    if (!station || station.latitude === null || station.longitude === null) {
      return null
    }
    return calculateSunTimes(now, station.latitude, station.longitude)
  }, [now, selectedStation])

  const outdoorChartData = useMemo(() => {
    if (!outdoorHistory) {
      return []
    }

    return mergeOutdoorSeries(outdoorHistory)
  }, [outdoorHistory])
  const outdoorPreviousDayChartData = useMemo(() => {
    if (!outdoorHistory) {
      return []
    }

    return mapPreviousDayTemperatureSeries(outdoorHistory)
  }, [outdoorHistory])
  const outdoorRainAxisMax = useMemo(() => {
    const maxRainValue = outdoorChartData.reduce((maxValue, point) => {
      const rainValue = typeof point.rain === 'number' ? point.rain : 0
      return Math.max(maxValue, rainValue)
    }, 0)

    return Math.max(3, Math.ceil(maxRainValue * 2) / 2)
  }, [outdoorChartData])

  const dayWindow = useMemo(() => getDayWindow(now), [now])
  const evenHourTicks = useMemo(() => buildEvenHourTicks(dayWindow.start, dayWindow.end), [dayWindow])
  const indoorTemperatureDomain = useMemo(
    () => getSharedIndoorTemperatureDomain(indoorModules, indoorHistoryById),
    [indoorHistoryById, indoorModules]
  )
  const indoorHumidityDomain = useMemo(
    () => getSharedIndoorHumidityDomain(indoorModules, indoorHistoryById),
    [indoorHistoryById, indoorModules]
  )
  const nextOverviewFetchAt = useMemo(
    () => getNextFetchAt(weatherQuery.data ? weatherQuery.data.fetchedAt : null),
    [weatherQuery.data]
  )
  const nextHistoryFetchAt = useMemo(
    () => getNextFetchAt(historyQuery.data ? historyQuery.data.fetchedAt : null),
    [historyQuery.data]
  )
  const forecastPoints = useMemo(
    () => (forecastQuery.data ? forecastQuery.data.hourly.slice(0,20) : []),
    [forecastQuery.data]
  )
  const indoorGridStyle = useMemo(
    () => ({ ['--indoor-modules-count' as string]: String(Math.max(indoorModules.length, 1)) }) as React.CSSProperties,
    [indoorModules.length]
  )
  const forecastGridStyle = useMemo(
    () => ({ ['--forecast-points-count' as string]: String(Math.max(forecastPoints.length, 1)) }) as React.CSSProperties,
    [forecastPoints.length]
  )
  const forecastMaxPrecipitation = useMemo(
    () => forecastPoints.reduce((maxValue, point) => Math.max(maxValue, point.precipitationAmountMax, point.precipitationAmount), 0),
    [forecastPoints]
  )

  useEffect(() => {
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <section className="rounded-2xl bg-zinc-950 p-5">
          <div className="grid gap-4 md:grid-cols-[auto_auto_auto] md:items-start">
            <p className="text-6xl font-normal tracking-tight text-zinc-50">{formatDate(now)}</p>
            <div className="relative flex items-center gap-2 md:justify-center md:self-center">
              <button
                onClick={() => weatherQuery.refetch()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-600 hover:text-zinc-200"
                type="button"
                aria-label="Refresh data"
                title="Refresh data"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <button
                onClick={props.onLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-600 hover:text-zinc-200"
                type="button"
                aria-label="Disconnect"
                title="Disconnect"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v10" />
                  <path d="M18.36 5.64a9 9 0 1 1-12.72 0" />
                </svg>
              </button>
              <button
                onClick={() => setIsMetaOpen((previousValue) => !previousValue)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-600 hover:text-zinc-200"
                type="button"
                aria-label="Show info"
                aria-expanded={isMetaOpen}
                title="Show info"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 10v6" />
                  <path d="M12 7.25h.01" />
                </svg>
              </button>
              {isMetaOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,22rem)] rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200 shadow-xl backdrop-blur">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Info</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <span className="text-zinc-400">Sunrise</span>
                    <span className="justify-self-end tabular-nums">{sunTimes ? formatClock(sunTimes.sunrise) : '--:--:--'}</span>
                    <span className="text-zinc-400">Sunset</span>
                    <span className="justify-self-end tabular-nums">{sunTimes ? formatClock(sunTimes.sunset) : '--:--:--'}</span>
                    <span className="text-zinc-400">Overview fetched</span>
                    <span className="justify-self-end tabular-nums">{weatherQuery.data ? formatFetchedAt(weatherQuery.data.fetchedAt) : '--:--:--'}</span>
                    <span className="text-zinc-400">Overview next</span>
                    <span className="justify-self-end tabular-nums">{nextOverviewFetchAt ? formatDateTime(nextOverviewFetchAt) : '--:--:--'}</span>
                    <span className="text-zinc-400">History fetched</span>
                    <span className="justify-self-end tabular-nums">{historyQuery.data ? formatFetchedAt(historyQuery.data.fetchedAt) : '--:--:--'}</span>
                    <span className="text-zinc-400">History next</span>
                    <span className="justify-self-end tabular-nums">{nextHistoryFetchAt ? formatDateTime(nextHistoryFetchAt) : '--:--:--'}</span>
                  </div>
                </div>
              ) : null}
            </div>
            <p className="text-6xl font-bold tabular-nums text-zinc-100 md:justify-self-end md:text-right">{formatClock(now)}</p>
          </div>
        </section>

        <div className="mt-4">
          {outdoorModule ? (
            <div className="outdoor-overview-grid grid grid-cols-1 gap-4">
              <div className="rounded-xl bg-zinc-950 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <p className="text-lg font-semibold text-zinc-100" title={'Last seen: ' + formatLastSeen(outdoorModule.lastSeenAt)}>{outdoorModule.name}</p>
                    {outdoorHistoryFetchFailed ? (
                      <HistoryWarningIcon message="Outdoor history fetch failed. Showing last cached values." />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-zinc-300" title={outdoorModule.humidity !== null ? 'Humidity: ' + outdoorModule.humidity + '%' : 'Humidity unavailable'}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" />
                    </svg>
                    <span>{outdoorModule.humidity !== null ? outdoorModule.humidity + '%' : '--'}</span>
                  </div>
                </div>
                <p className="mt-2 text-[8rem] font-bold leading-none text-zinc-100 text-center">
                  <TemperatureReading value={outdoorModule.temperature} />
                </p>

                <div className="mt-2 flex items-center justify-center gap-4 text-sm text-zinc-300">
                  <span
                    className="inline-flex items-center gap-1"
                    title={
                      'Min: ' +
                      (outdoorModule.minTemperature !== null ? outdoorModule.minTemperature.toFixed(1) + '°' : '--')
                    }
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 10 12 15 17 10" />
                    </svg>
                    <span>{outdoorModule.minTemperature !== null ? outdoorModule.minTemperature.toFixed(1) + '°' : '--'}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1"
                    title={
                      'Max: ' +
                      (outdoorModule.maxTemperature !== null ? outdoorModule.maxTemperature.toFixed(1) + '°' : '--')
                    }
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 14 12 9l5 5" />
                    </svg>
                    <span>{outdoorModule.maxTemperature !== null ? outdoorModule.maxTemperature.toFixed(1) + '°' : '--'}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1"
                    title={
                      'Rain 24h: ' +
                      (outdoorModule.rainLast24Hours !== null ? outdoorModule.rainLast24Hours + ' mm' : '--')
                    }
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" />
                    </svg>
                    <span>{outdoorModule.rainLast24Hours !== null ? outdoorModule.rainLast24Hours + ' mm' : '--'}</span>
                  </span>
                </div>
              </div>

              <div className="outdoor-chart-panel rounded-xl bg-zinc-950 p-4 pb-2">
                {outdoorChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={outdoorChartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <defs>
                          <linearGradient id="outdoorTempFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={TEMP_COLOR} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={TEMP_COLOR} stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(161,161,170,0.2)" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="timestamp"
                          domain={[dayWindow.start, dayWindow.end]}
                          ticks={evenHourTicks}
                          tickFormatter={formatHourTick}
                          minTickGap={22}
                          stroke="rgba(161,161,170,0.35)"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: 'rgba(161,161,170,0.68)' }}
                        />
                        <YAxis yAxisId="temp" stroke="rgba(161,161,170,0.22)" tick={{ fontSize: 10, fill: 'rgba(161,161,170,0.68)' }} width={32} />
                        <YAxis yAxisId="humidity" hide domain={[0, 100]} />
                        <YAxis
                          yAxisId="rain"
                          orientation="right"
                          domain={[0, outdoorRainAxisMax]}
                          stroke="rgba(161,161,170,0.22)"
                          tick={{ fontSize: 10, fill: 'rgba(161,161,170,0.68)' }}
                          tickFormatter={(value: number) => `${value.toFixed(1)}`}
                          width={42}
                          label={{ value: 'Rain mm', angle: -90, position: 'insideRight', fill: 'rgba(161,161,170,0.68)', fontSize: 10 }}
                        />
                        <Tooltip content={<OutdoorChartTooltip />} />
                        <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke={HUMIDITY_COLOR} strokeWidth={1.8} dot={false} strokeOpacity={0.45} />
                        <Area yAxisId="temp" type="monotone" dataKey="temperature" fill="url(#outdoorTempFill)" fillOpacity={1} stroke={TEMP_COLOR} strokeWidth={2.2} dot={false} />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          data={outdoorPreviousDayChartData}
                          dataKey="temperature"
                          name="Temp yesterday"
                          stroke={TEMP_COLOR}
                          strokeWidth={1.7}
                          strokeOpacity={0.5}
                          dot={false}
                        />
                        <Bar
                          yAxisId="rain"
                          dataKey="rain"
                          name="Rain mm"
                          fill={FORECAST_RAIN_COLOR}
                          shape={<RainBarShape />}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    {historyQuery.isLoading
                      ? 'Loading outdoor history...'
                      : outdoorHistoryFetchFailed
                        ? 'Outdoor history fetch failed. Showing cached data until a successful refresh.'
                        : historyQuery.isError
                        ? 'Outdoor history request failed. Netatmo data may be unavailable.'
                        : 'Outdoor history not available yet.'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-zinc-400">Outdoor module not found.</p>
          )}
        </div>

        <div className="indoor-modules-grid mt-4 grid grid-cols-1 gap-4" style={indoorGridStyle}>
            {indoorModules.map((module) => {
              const moduleHistory = indoorHistoryById[module.id] || null
              const moduleHistoryFetchFailed = failedHistoryModuleIds.has(module.id) || Boolean(moduleHistory && moduleHistory.historyFetchFailed)
              const modulePreviousDayChartData = moduleHistory ? mapPreviousDayTemperatureSeries(moduleHistory) : []

              return (
              <article key={module.id} className="rounded-xl bg-zinc-950 p-5 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <p className="text-lg font-semibold text-zinc-100" title={'Last seen: ' + formatLastSeen(module.lastSeenAt)}>{module.name}</p>
                    {moduleHistoryFetchFailed ? (
                      <HistoryWarningIcon message="History fetch failed. Showing last cached values." />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="inline-flex items-center gap-1" title={module.humidity !== null ? 'Humidity: ' + module.humidity + '%' : 'Humidity unavailable'}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z" />
                      </svg>
                      <span>{module.humidity !== null ? module.humidity + '%' : '--'}</span>
                    </span>
                    <span
                      className={'h-4 w-4 rounded-full ' + getCo2Class(module.co2)}
                      title={module.co2 !== null ? 'CO2: ' + module.co2 + ' ppm' : 'CO2 unavailable'}
                    ></span>
                  </div>
                </div>
                <p className="mt-2 text-7xl font-bold leading-none text-center">
                  <TemperatureReading value={module.temperature} />
                </p>

                {indoorHistoryById[module.id] ? (
                  <div className="mt-4 h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={mergeIndoorSeries(indoorHistoryById[module.id])} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={'indoorTempFill-' + module.id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={TEMP_COLOR} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={TEMP_COLOR} stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(161,161,170,0.22)" strokeDasharray="2 3" />
                        <XAxis
                          type="number"
                          dataKey="timestamp"
                          domain={[dayWindow.start, dayWindow.end]}
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
                          domain={indoorTemperatureDomain}
                          tick={{ fontSize: 9, fill: 'rgba(161,161,170,0.64)' }}
                          width={28}
                        />
                        <YAxis
                          yAxisId="humidity"
                          orientation="right"
                          stroke="rgba(161,161,170,0.18)"
                          domain={indoorHumidityDomain}
                          tick={{ fontSize: 9, fill: 'rgba(161,161,170,0.64)' }}
                          width={28}
                        />
                        <Tooltip
                          labelFormatter={formatTooltipTimestamp}
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #52525b', borderRadius: 8 }}
                          labelStyle={{ color: '#d4d4d8' }}
                          itemStyle={{ color: '#fafafa' }}
                        />
                        <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke={HUMIDITY_COLOR} strokeWidth={1.7} dot={false} strokeOpacity={0.45} />
                        <Area yAxisId="temp" type="monotone" dataKey="temperature" fill={'url(#indoorTempFill-' + module.id + ')'} fillOpacity={1} stroke={TEMP_COLOR} strokeWidth={2.1} dot={false} />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          data={modulePreviousDayChartData}
                          dataKey="temperature"
                          name="Temp yesterday"
                          stroke={TEMP_COLOR}
                          strokeWidth={1.6}
                          strokeOpacity={0.5}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-400">
                    {historyQuery.isLoading
                      ? 'Loading history...'
                      : moduleHistoryFetchFailed
                        ? 'History fetch failed. Showing cached data until a successful refresh.'
                        : historyQuery.isError
                        ? 'History request failed. Netatmo data may be unavailable.'
                        : 'History not available.'}
                  </p>
                )}
              </article>
              )
            })}
        </div>

        <div className="mt-4">
          {forecastQuery.isLoading ? <p className="mt-3 text-zinc-400">Loading forecast...</p> : null}
          {forecastQuery.isError ? <p className="mt-3 text-rose-300">Forecast unavailable right now.</p> : null}
          {forecastQuery.data ? (
            <div className="forecast-grid rounded-lg bg-zinc-950 p-3 mt-4 grid grid-cols-2" style={forecastGridStyle}>
              {forecastPoints.map((point) => {
                const symbolId = resolveYrSymbolId(point.symbolCode)
                const precipitationAmount = Math.max(0, point.precipitationAmount)
                const precipitationAmountMax = Math.max(precipitationAmount, point.precipitationAmountMax || 0)
                const rainBarHeightPx = getRainBarHeightPx(precipitationAmountMax)
                const rainBaseHeightPercent =
                  precipitationAmountMax > 0
                    ? Math.max(0, Math.min(100, (precipitationAmount / precipitationAmountMax) * 100))
                    : 0
                const rainProbabilityPercent = Math.max(0, Math.min(100, point.precipitationProbability || 0))
                const rainOpacity = Math.min(1, 0.2 + 0.8 * Math.pow(rainProbabilityPercent / 100, 0.65))

                return (
                  <div key={point.timestamp} className="text-center p-1">
										<p className="text-s text-zinc-300">{formatHour(point.timestamp)}</p>
                    <img
                      src={`/yr/${symbolId}.svg`}
                      className="mx-auto mt-2 h-11 w-11"
                      alt={point.symbolCode.replace(/_/g, ' ')}
                      loading="lazy"
                    />
                    <p className="mt-1 text-xl font-semibold text-zinc-100">{Math.ceil(point.airTemperature)}°</p>
                    <div
                      className="forecast__rain-block mt-1"
                      title={`Rain ${precipitationAmount.toFixed(1)} mm, max ${precipitationAmountMax.toFixed(1)} mm, probability ${Math.round(rainProbabilityPercent)}%`}
                      aria-label={`Rain ${precipitationAmount.toFixed(1)} millimeters, max ${precipitationAmountMax.toFixed(1)} millimeters, probability ${Math.round(rainProbabilityPercent)} percent`}
                    >
                      <span
                        className="forecast__rain-bar"
                        style={{
                          ['--rain-height' as string]: `${rainBarHeightPx}px`,
                          ['--rain-base-height' as string]: `${rainBaseHeightPercent}%`,
                          ['--rain-opacity' as string]: String(rainOpacity),
                        } as React.CSSProperties}
                      ></span>
                    </div>
                    <p className="forecast__rain-value">{precipitationAmount > 0 ? precipitationAmount.toFixed(1) : ''}</p>
                    <div className="mt-1 text-xs text-zinc-300">
                      <span
                        className="forecast__data-point--wind"
                        style={{ ['--wind-direction' as string]: `${point.windFromDirection}deg` }}
                      >
                        <span className="forecast__data-point--wind-value">{Math.ceil(point.windSpeed)}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatDate(value: Date) {
  const weekday = value.toLocaleDateString('fi-FI', { weekday: 'long' })
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const day = value.getDate()
  const month = value.getMonth() + 1

  return `${capitalizedWeekday} ${day}.${month}.`
}

function TemperatureReading(props: { value: number | null }) {
  if (props.value === null) {
    return <span>--</span>
  }

  const [mainDigits, fractionalDigit = '0'] = props.value.toFixed(1).split('.')

  return (
    <span className="inline-flex items-baseline gap-1 font-mono">
      {mainDigits}
      <span className="align-bottom text-[0.5em] opacity-60">{fractionalDigit}°</span>
    </span>
  )
}

function resolveYrSymbolId(symbolCode: string) {
  const cleanCode = (symbolCode || '').trim()

  if (/^(0[1-9]|[1-4][0-9]|50)(d|n|m)?$/.test(cleanCode)) {
    return cleanCode
  }

  const mapped = YR_SYMBOL_ID_BY_CODE[cleanCode]

  return mapped || '04'
}

function formatClock(value: Date) {
  return value.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatHour(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
  })
}

function formatHourTick(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
  })
}

function formatTooltipTimestamp(value: number | string) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return new Date(numericValue).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFetchedAt(value: string) {
  return new Date(value).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatLastSeen(value: number | null) {
  if (value === null) {
    return '--:--:--'
  }

  return new Date(value * 1000).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDateTime(value: Date) {
  return value.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getNextFetchAt(fetchedAt: string | null) {
  if (!fetchedAt) {
    return null
  }

  return new Date(new Date(fetchedAt).getTime() + QUERY_REFETCH_INTERVAL_MS)
}

function getCo2Class(co2: number | null) {
  if (co2 === null) {
    return 'bg-slate-500'
  }

  if (co2 > 2000) {
    return 'bg-red-500'
  }

  if (co2 > 1500) {
    return 'bg-orange-500'
  }

  if (co2 > 1000) {
    return 'bg-amber-400'
  }

  if (co2 > 700) {
    return 'bg-lime-400'
  }

  return 'bg-emerald-500'
}

function HistoryWarningIcon(props: { message: string }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-amber-300" title={props.message} aria-label={props.message}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5 3.7 19a1 1 0 0 0 .88 1.5h14.84a1 1 0 0 0 .88-1.5L12 3.5Z" />
        <path d="M12 9v5" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

function mergeOutdoorSeries(module: ModuleHistory) {
  const earlierTemperatureByTimestamp = new Map(
    module.earlierTemperatures.map((point) => [point.timestamp, point.value] as const)
  )
  const halfHourMs = 30 * 60 * 1000
  const rainByHalfHour = new Map<number, number>()
  const seenRainHalfHours = new Set<number>()

  module.rain.forEach((point) => {
    if (typeof point.value !== 'number') {
      return
    }

    const halfHourTimestamp = Math.floor(point.timestamp / halfHourMs) * halfHourMs
    rainByHalfHour.set(halfHourTimestamp, (rainByHalfHour.get(halfHourTimestamp) || 0) + Math.max(0, point.value))
  })

  return module.recentTemperatures.map((point, index) => {
    const halfHourTimestamp = Math.floor(point.timestamp / halfHourMs) * halfHourMs
    const isFirstPointInHalfHour = !seenRainHalfHours.has(halfHourTimestamp)
    const rainValue = rainByHalfHour.get(halfHourTimestamp) ?? 0

    if (isFirstPointInHalfHour) {
      seenRainHalfHours.add(halfHourTimestamp)
    }

    return {
      timestamp: point.timestamp,
      temperature: point.value,
      previousDayTemperature:
        earlierTemperatureByTimestamp.has(point.timestamp)
          ? earlierTemperatureByTimestamp.get(point.timestamp) ?? null
          : module.earlierTemperatures[index]
          ? module.earlierTemperatures[index].value
          : null,
      humidity: module.humidity[index] ? module.humidity[index].value : null,
      rain: isFirstPointInHalfHour ? rainValue : 0,
    }
  })
}

function OutdoorChartTooltip(props: {
  active?: boolean
  label?: number | string
  payload?: Array<{
    payload?: {
      temperature?: number | null
      humidity?: number | null
      rain?: number | null
      previousDayTemperature?: number | null
    }
  }>
}) {
  if (!props.active || !props.payload || props.payload.length === 0) {
    return null
  }

  const point = props.payload[0] && props.payload[0].payload ? props.payload[0].payload : {}
  const formattedLabel = props.label !== undefined ? formatTooltipTimestamp(props.label) : '--:--'

  return (
    <div className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      <p className="mb-1 text-zinc-300">{formattedLabel}</p>
      <p>Temperature: {typeof point.temperature === 'number' ? `${point.temperature.toFixed(1)} C` : '--'}</p>
      <p>Humidity: {typeof point.humidity === 'number' ? `${point.humidity.toFixed(0)} %` : '--'}</p>
      <p>Rain: {typeof point.rain === 'number' ? `${point.rain.toFixed(2)} mm` : '--'}</p>
      <p>Temp yesterday: {typeof point.previousDayTemperature === 'number' ? `${point.previousDayTemperature.toFixed(1)} C` : '--'}</p>
    </div>
  )
}

function RainBarShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
}) {
  const x = typeof props.x === 'number' ? props.x : 0
  const y = typeof props.y === 'number' ? props.y : 0
  const width = typeof props.width === 'number' ? props.width : 0
  const height = typeof props.height === 'number' ? props.height : 0

  if (height <= 0) {
    return null
  }

  const visualWidth = 5
  const adjustedX = x + (width - visualWidth) / 2

  return (
    <rect
      x={adjustedX}
      y={y}
      width={visualWidth}
      height={height}
      rx={1}
      ry={1}
      fill={props.fill || FORECAST_RAIN_COLOR}
    />
  )
}

function mergeIndoorSeries(module: ModuleHistory) {
  const earlierTemperatureByTimestamp = new Map(
    module.earlierTemperatures.map((point) => [point.timestamp, point.value] as const)
  )

  return module.recentTemperatures.map((point, index) => ({
    timestamp: point.timestamp,
    temperature: point.value,
    previousDayTemperature:
      earlierTemperatureByTimestamp.has(point.timestamp)
        ? earlierTemperatureByTimestamp.get(point.timestamp) ?? null
        : module.earlierTemperatures[index]
        ? module.earlierTemperatures[index].value
        : null,
    humidity: module.humidity[index] ? module.humidity[index].value : null,
  }))
}

function mapPreviousDayTemperatureSeries(module: ModuleHistory) {
  return module.earlierTemperatures.map((point) => ({
    timestamp: point.timestamp,
    temperature: point.value,
  }))
}

function getSharedIndoorTemperatureDomain(
  indoorModules: Array<{ id: string }>,
  indoorHistoryById: Record<string, ModuleHistory>
): [number, number] | ['auto', 'auto'] {
  const allTemperatures = indoorModules
    .flatMap((module) => {
      const history = indoorHistoryById[module.id]
      return history ? history.recentTemperatures.map((point) => point.value) : []
    })
    .filter((value) => Number.isFinite(value))

  if (allTemperatures.length === 0) {
    return ['auto', 'auto']
  }

  const minValue = Math.min(...allTemperatures)
  const maxValue = Math.max(...allTemperatures)

  return [Math.floor(minValue - 1), Math.ceil(maxValue + 1)]
}

function getSharedIndoorHumidityDomain(
  indoorModules: Array<{ id: string }>,
  indoorHistoryById: Record<string, ModuleHistory>
): [number, number] | ['auto', 'auto'] {
  const allHumidityValues = indoorModules
    .flatMap((module) => {
      const history = indoorHistoryById[module.id]
      return history ? history.humidity.map((point) => point.value) : []
    })
    .filter((value) => Number.isFinite(value))

  if (allHumidityValues.length === 0) {
    return ['auto', 'auto']
  }

  const minValue = Math.min(...allHumidityValues)

  return [minValue, 100]
}

function getDayWindow(reference: Date) {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start: start.getTime(),
    end: end.getTime(),
  }
}

function buildEvenHourTicks(start: number, end: number) {
  const ticks: number[] = []
  const twoHoursMs = 2 * 60 * 60 * 1000

  for (let value = start; value <= end; value += twoHoursMs) {
    ticks.push(value)
  }

  return ticks
}

function getRainBarHeightPx(precipitationMaxMm: number) {
  if (precipitationMaxMm <= 0) {
    return 0
  }

  if (precipitationMaxMm <= 1) {
    return 1
  }

  if (precipitationMaxMm >= 20) {
    return 30
  }

  const normalized = (precipitationMaxMm - 1) / 19

  return 1 + normalized * 29
}

function calculateSunTimes(date: Date, latitude: number, longitude: number) {
  const dayMs = 24 * 60 * 60 * 1000
  const rad = Math.PI / 180
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2000, 0, 1)) / dayMs)
  const meanAnomaly = 357.5291 + 0.98560028 * day
  const equationOfCenter = 1.9148 * Math.sin(meanAnomaly * rad) + 0.02 * Math.sin(2 * meanAnomaly * rad) + 0.0003 * Math.sin(3 * meanAnomaly * rad)
  const eclipticLongitude = (meanAnomaly + equationOfCenter + 180 + 102.9372) % 360
  const solarTransit = 2451545 + day + 0.0053 * Math.sin(meanAnomaly * rad) - 0.0069 * Math.sin(2 * eclipticLongitude * rad)
  const declination = Math.asin(Math.sin(eclipticLongitude * rad) * Math.sin(23.44 * rad))
  const latRad = latitude * rad
  const hourAngle = Math.acos((Math.sin(-0.83 * rad) - Math.sin(latRad) * Math.sin(declination)) / (Math.cos(latRad) * Math.cos(declination)))

  const sunriseJulian = solarTransit - hourAngle / (2 * Math.PI) - longitude / 360
  const sunsetJulian = solarTransit + hourAngle / (2 * Math.PI) - longitude / 360

  return {
    sunrise: julianToDate(sunriseJulian),
    sunset: julianToDate(sunsetJulian),
  }
}

function julianToDate(julianDate: number) {
  const unixEpochJulian = 2440587.5
  return new Date((julianDate - unixEpochJulian) * 86400000)
}

export default Dashboard
