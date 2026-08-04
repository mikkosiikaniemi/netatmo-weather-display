import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ModuleHistory } from '../types/weather'

interface HistoryChartsProps {
  modules: ModuleHistory[]
}

const TEMP_COLOR = '#ff3b30'
const HUMIDITY_COLOR = '#00b8ff'

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mergeClimateSeries(module: ModuleHistory) {
  return module.recentTemperatures.map((point, index) => ({
    time: formatTime(point.timestamp),
    temperature: point.value,
    humidity: module.humidity[index] ? module.humidity[index].value : null,
  }))
}

function mapRainSeries(module: ModuleHistory) {
  return module.rain.map((point) => ({
    time: formatTime(point.timestamp),
    rain: point.value,
  }))
}

function HistoryCharts(props: HistoryChartsProps) {
  return (
    <div className="space-y-6">
      {props.modules.map((module) => {
        const climateData = mergeClimateSeries(module)
        const rainData = mapRainSeries(module)

        return (
          <section key={module.moduleId} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-netatmo-darker">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{module.moduleName}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{module.moduleType}</p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Temp range: {module.minTemperature !== null ? module.minTemperature.toFixed(1) : '—'} to {module.maxTemperature !== null ? module.maxTemperature.toFixed(1) : '—'}
              </div>
            </div>

            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={climateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                  <XAxis dataKey="time" minTickGap={24} stroke="#94a3b8" />
                  <YAxis yAxisId="temp" stroke={TEMP_COLOR} domain={["auto", "auto"]} />
                  <YAxis yAxisId="humidity" orientation="right" stroke={HUMIDITY_COLOR} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature °C" stroke={TEMP_COLOR} strokeWidth={2} dot={false} connectNulls={false} />
                  <Line yAxisId="humidity" type="monotone" dataKey="humidity" name="Humidity %" stroke={HUMIDITY_COLOR} strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {module.rain.length > 0 ? (
              <div className="mt-6 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rainData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                    <XAxis dataKey="time" minTickGap={24} stroke="#94a3b8" />
                    <YAxis stroke={HUMIDITY_COLOR} domain={[0, 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="rain" name="Rain mm" fill={HUMIDITY_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

export default HistoryCharts
