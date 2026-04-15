import React from 'react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-netatmo-dark flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading weather data...</p>
      </div>
    </div>
  )
}
