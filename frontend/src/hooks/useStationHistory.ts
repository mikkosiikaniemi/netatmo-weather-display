import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { StationHistoryResponse } from '../types/weather'

async function fetchStationHistory(stationId: string): Promise<StationHistoryResponse> {
  const response = await axios.get('/api/weather/' + stationId + '/history', {
    withCredentials: true,
  })

  return response.data
}

export function useStationHistory(stationId: string | null) {
  return useQuery({
    queryKey: ['station-history', stationId],
    queryFn: () => fetchStationHistory(stationId as string),
    enabled: Boolean(stationId),
    retry: 1,
    refetchInterval: 10.5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
