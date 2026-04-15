import React from 'react'

interface LoginScreenProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

function LoginScreen(props: LoginScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-netatmo-dark">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-netatmo-darker">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">Netatmo Modernization</p>
        <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white">{props.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{props.description}</p>
        <button
          className="mt-8 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
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
