import axios from 'axios'
import { useQuery, useQueryClient } from 'react-query'

interface AuthStatus {
  authenticated: boolean
  configured: boolean
  user: null | {
    scope: string | null
    expiresAt: number | null
  }
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await axios.get('/auth/status', {
    withCredentials: true,
  })

  return response.data
}

export function useAuth() {
  const queryClient = useQueryClient()
  const query = useQuery('auth-status', fetchAuthStatus, {
    retry: 1,
  })

  const login = () => {
    window.location.href = '/auth/login'
  }

  const logout = async () => {
    await axios.post('/auth/logout', {}, { withCredentials: true })
    await queryClient.invalidateQueries('auth-status')
  }

  const refreshAuth = () => {
    query.refetch()
  }

  return {
    authStatus: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    login,
    logout,
    refreshAuth,
  }
}
