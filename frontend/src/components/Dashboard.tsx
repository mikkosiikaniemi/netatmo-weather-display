import React, { useEffect, useState } from 'react'
import Header from './Header'
import Loading from './Loading'
import HistoryCharts from './HistoryCharts'
import { useWeatherData } from '../hooks/useWeatherData'
import { useStationHistory } from '../hooks/useStationHistory'

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
  const weatherQuery = useWeatherData()
  const stations = weatherQuery.data ? weatherQuery.data.stations : []
  const fetchedAt = weatherQuery.data ? new Date(weatherQuery.data.fetchedAt).toLocaleString() : null
  const selectedStationId = stations.length > 0 ? stations[0].id : null
  const historyQuery = useStationHistory(selectedStationId)

  useEffect(() => {
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-white dark:bg-netatmo-dark transition-colors">
      <Header authStatus={props.authStatus} onLogout={props.onLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Weather API status</h2>
            {weatherQuery.isLoading ? (
              <p className="mt-3 text-gray-600 dark:text-gray-400">Fetching current station data...</p>
            ) : null}
            {weatherQuery.isError ? (
              <p className="mt-3 text-red-600 dark:text-red-400">
                Weather data could not be loaded. The backend route is active, but Netatmo credentials or station access still need verification.
              </p>
            ) : null}
            {!weatherQuery.isLoading && !weatherQuery.isError ? (
              <>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  The backend is now returning typed station summaries. Chart history is available from the new history endpoint and can be connected next.
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Last fetch: {fetchedAt || 'Unknown'}
                </p>
              </>
            ) : null}
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Current session</h2>
            <dl className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <dt className="font-medium text-gray-900 dark:text-white">Scope</dt>
                <dd>{props.authStatus.user && props.authStatus.user.scope ? props.authStatus.user.scope : 'read_station'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900 dark:text-white">Token expiry</dt>
                <dd>{props.authStatus.user && props.authStatus.user.expiresAt ? new Date(props.authStatus.user.expiresAt).toLocaleString() : 'Unknown'}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stations</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {stations.length} station{stations.length === 1 ? '' : 's'} available from the new API.
              </p>
            </div>
            <button
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => weatherQuery.refetch()}
              type="button"
            >
              Refresh data
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {stations.map((station) => (
              <div key={station.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{station.name}</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {station.modules.map((module) => (
                    <article key={module.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">{module.name}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{module.type}</p>
                        </div>
                        <span className={module.reachable ? 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300'}>
                          {module.reachable ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Temp</dt>
                          <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{module.temperature !== null ? module.temperature.toFixed(1) + '°C' : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Humidity</dt>
                          <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{module.humidity !== null ? module.humidity + '%' : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Min / Max</dt>
                          <dd className="mt-1 text-gray-900 dark:text-white">
                            {module.minTemperature !== null ? module.minTemperature.toFixed(1) : '—'} / {module.maxTemperature !== null ? module.maxTemperature.toFixed(1) : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Rain 24h</dt>
                          <dd className="mt-1 text-gray-900 dark:text-white">{module.rainLast24Hours !== null ? module.rainLast24Hours + ' mm' : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">CO2</dt>
                          <dd className="mt-1 text-gray-900 dark:text-white">{module.co2 !== null ? module.co2 + ' ppm' : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Seen</dt>
                          <dd className="mt-1 text-gray-900 dark:text-white">{module.lastSeenAt ? new Date(module.lastSeenAt * 1000).toLocaleTimeString() : '—'}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {!weatherQuery.isLoading && !weatherQuery.isError && stations.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No stations were returned by the backend yet.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">History charts</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Rendering the new `/api/weather/:stationId/history` payload with Recharts.
              </p>
            </div>
            {historyQuery.data ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last history fetch: {new Date(historyQuery.data.fetchedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {historyQuery.isLoading ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
              <p className="text-gray-600 dark:text-gray-400">Loading history for the first available station...</p>
            </section>
          ) : null}

          {historyQuery.isError ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
              <p className="text-red-600 dark:text-red-400">
                Station history is not available yet. Authenticate with a Netatmo account and verify the station permissions to populate the charts.
              </p>
            </section>
          ) : null}

          {historyQuery.data ? <HistoryCharts modules={historyQuery.data.modules} /> : null}
        </section>
      </div>
    </div>
  )
}

export default Dashboard
