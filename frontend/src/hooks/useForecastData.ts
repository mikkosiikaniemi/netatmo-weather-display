import axios from 'axios'
import { useQuery } from 'react-query'
import { ForecastResponse } from '../types/weather'

async function fetchForecastData(): Promise<ForecastResponse> {
  const response = await axios.get('/api/forecast', {
    withCredentials: true,
  })

  return response.data
}

export function useForecastData() {
  return useQuery('yr-forecast', fetchForecastData, {
    retry: 1,
    refetchInterval: 10.5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
