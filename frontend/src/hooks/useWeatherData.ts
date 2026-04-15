import axios from 'axios'
import { useQuery } from 'react-query'
import { WeatherOverviewResponse } from '../types/weather'

async function fetchWeatherData(): Promise<WeatherOverviewResponse> {
  const response = await axios.get('/api/weather', {
    withCredentials: true,
  })

  return response.data
}

export function useWeatherData() {
  return useQuery('weather-overview', fetchWeatherData, {
    retry: 1,
    refetchInterval: 10.5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
