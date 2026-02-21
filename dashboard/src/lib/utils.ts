import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function relativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return "agora mesmo"
  if (diffMin < 60) return `ha ${diffMin} min`
  if (diffHours < 24) return `ha ${diffHours}h`
  if (diffDays < 7) return `ha ${diffDays}d`
  return formatDate(date)
}

export function cronToHuman(cron: string): string {
  const presets: Record<string, string> = {
    daily: "Diariamente as 06:00",
    weekly: "Toda segunda-feira as 06:00",
    monthly: "Todo dia 1 as 06:00",
  }
  if (presets[cron.toLowerCase()]) return presets[cron.toLowerCase()]

  const parts = cron.split(" ")
  if (parts.length !== 5) return cron

  const [minute, hour, day, , dow] = parts

  const dayOfWeekNames: Record<string, string> = {
    "0": "domingo",
    "1": "segunda-feira",
    "2": "terca-feira",
    "3": "quarta-feira",
    "4": "quinta-feira",
    "5": "sexta-feira",
    "6": "sabado",
    "7": "domingo",
  }

  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`

  if (day !== "*" && dow === "*") {
    return `Todo dia ${day} as ${time}`
  }
  if (dow !== "*" && day === "*") {
    if (dow.includes("-")) {
      const [start, end] = dow.split("-")
      return `${dayOfWeekNames[start] || start} a ${dayOfWeekNames[end] || end} as ${time}`
    }
    const dayName = dayOfWeekNames[dow] || dow
    return `Toda ${dayName} as ${time}`
  }
  if (day === "*" && dow === "*") {
    return `Diariamente as ${time}`
  }
  return cron
}

export function statusColor(status: string) {
  switch (status) {
    case "OK": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
    case "MISSING": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "INCONSISTENT": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    case "URL_NOT_FOUND": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    case "API_ERROR": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "NO_EXPECTED": return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
    default: return "bg-slate-100 text-slate-600"
  }
}
