import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { SensorReadingsResponse } from '../types/sensors'

async function fetchSensorReadings(): Promise<SensorReadingsResponse> {
  const response = await axios.get('/api/sensors/readings', {
    withCredentials: true,
  })

  return response.data
}

export function useSensorReadings() {
  return useQuery({
    queryKey: ['sensor-readings'],
    queryFn: fetchSensorReadings,
    retry: 1,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}