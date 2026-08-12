import React from 'react'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-zinc-100">
      <div className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl shadow-black/40">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200"></div>
        <p className="mt-4 text-base leading-7 text-zinc-300">Loading weather data...</p>
      </div>
    </div>
  )
}
