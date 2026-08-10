import React from 'react'

interface LoginScreenProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

function LoginScreen(props: LoginScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-zinc-100">
      <div className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/40">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Netatmo Modernization</p>
        <h1 className="mt-4 text-4xl font-bold text-zinc-100">{props.title}</h1>
        <p className="mt-4 text-base leading-7 text-zinc-300">{props.description}</p>
        <button
          className="mt-8 inline-flex items-center justify-center rounded-md bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
          onClick={props.onAction}
          type="button"
        >
          {props.actionLabel}
        </button>
      </div>
    </div>
  )
}

export default LoginScreen
