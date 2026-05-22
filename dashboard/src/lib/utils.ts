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
  // Both day-of-month and day-of-week constrained: be explicit instead of returning raw cron.
  const dayName = dayOfWeekNames[dow] || dow
  return `Dia ${day} de cada mes e/ou ${dayName} as ${time}`
}

export function statusColor(status: string) {
  switch (status) {
    case "OK":
    case "ATIVO":
    case "CONFORME":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
    case "MISSING":
    case "ENCERRADO":
    case "NAO_CONFORME":
    case "VENCIDO":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "INCONSISTENT":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    case "URL_NOT_FOUND":
    case "SKU_EXCLUIDO":
    case "NAO_APLICAVEL":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    case "API_ERROR":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "EM_ANDAMENTO":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "NO_EXPECTED":
    case "PENDENTE":
    case "DESCONHECIDO":
      return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
    default:
      return "bg-slate-100 text-slate-600"
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "OK": return "OK"
    case "MISSING": return "Faltando"
    case "INCONSISTENT": return "Inconsistente"
    case "URL_NOT_FOUND": return "URL nao encontrada"
    case "API_ERROR": return "Erro de API"
    case "NO_EXPECTED": return "Sem texto esperado"
    case "ATIVO": return "Ativo"
    case "ENCERRADO": return "Encerrado"
    case "SKU_EXCLUIDO": return "SKU excluido"
    case "EM_ANDAMENTO": return "Em andamento"
    case "DESCONHECIDO": return "Desconhecido"
    case "CONFORME": return "Conforme"
    case "NAO_CONFORME": return "Nao conforme"
    case "PENDENTE": return "Pendente"
    case "VENCIDO": return "Vencido"
    case "NAO_APLICAVEL": return "Nao aplicavel"
    default: return status
  }
}
