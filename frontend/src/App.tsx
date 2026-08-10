import React, { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Loading from './components/Loading'
import LoginScreen from './components/LoginScreen'
import { useAuth } from './hooks/useAuth'
import './App.css'

const Dashboard = lazy(() => import('./components/Dashboard'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10.5 * 60 * 1000, // 10.5 minutes
      refetchOnWindowFocus: true,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

function AppContent() {
  const { authStatus, isLoading, isError, login, logout, refreshAuth } = useAuth()

  if (isLoading) {
    return <Loading />
  }

  if (isError) {
    return (
      <LoginScreen
        title="Backend unavailable"
        description="The authentication service could not be reached. Verify the backend server is running, then retry."
        actionLabel="Retry"
        onAction={refreshAuth}
      />
    )
  }

  if (!authStatus || !authStatus.configured) {
    return (
      <LoginScreen
        title="Backend not configured"
        description="Set Netatmo credentials in the backend environment before starting the OAuth flow."
        actionLabel="Retry"
        onAction={refreshAuth}
      />
    )
  }

  if (!authStatus.authenticated) {
    return (
      <LoginScreen
        title="Connect Netatmo"
        description="Sign in with your Netatmo account to allow the new dashboard to fetch station data securely through the backend."
        actionLabel="Sign in with Netatmo"
        onAction={login}
      />
    )
  }

  return (
    <Suspense fallback={<Loading />}>
      <Dashboard authStatus={authStatus} onLogout={logout} />
    </Suspense>
  )
}

export default App
