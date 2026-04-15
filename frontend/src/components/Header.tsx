import React, { useState } from 'react'

interface HeaderProps {
  authStatus: {
    user: null | {
      scope: string | null
      expiresAt: number | null
    }
  }
  onLogout: () => void
}

function Header(props: HeaderProps) {
  const [isDark, setIsDark] = useState(true)

  const toggleDarkMode = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="bg-white dark:bg-netatmo-darker border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Netatmo Weather
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Scope: {props.authStatus.user && props.authStatus.user.scope ? props.authStatus.user.scope : 'read_station'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={props.onLogout}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              type="button"
            >
              Disconnect
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
              type="button"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
