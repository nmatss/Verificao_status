import type { ProgressEventData } from "@/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/**
 * Append `source=excel` to a path unless the caller already provided a `source`
 * query param. Keeps the backend deterministic (excel is the canonical source).
 */
function withSource(path: string, source: string = "excel"): string {
  const [base, qs = ""] = path.split("?")
  const params = new URLSearchParams(qs)
  if (!params.has("source")) {
    params.set("source", source)
  }
  return `${base}?${params.toString()}`
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function fetchStats() {
  return apiFetch(withSource("/api/stats"))
}

export async function fetchProducts(params?: {
  page?: number
  per_page?: number
  search?: string
  brand?: string
  status?: string
  cert_status?: string
  site_status?: string
  license_status?: string
  comercializacao_status?: string
  situacao?: string
  source?: string
}) {
  const query = new URLSearchParams()
  if (params?.page) query.set("page", String(params.page))
  if (params?.per_page) query.set("per_page", String(params.per_page))
  if (params?.search) query.set("search", params.search)
  if (params?.brand) query.set("brand", params.brand)
  if (params?.status) query.set("status", params.status)
  if (params?.cert_status) query.set("cert_status", params.cert_status)
  if (params?.site_status) query.set("site_status", params.site_status)
  if (params?.license_status) query.set("license_status", params.license_status)
  if (params?.comercializacao_status) query.set("comercializacao_status", params.comercializacao_status)
  if (params?.situacao) query.set("situacao", params.situacao)
  if (params?.source) query.set("source", params.source)
  return apiFetch(withSource(`/api/products?${query.toString()}`))
}

export async function fetchProductDetail(sku: string) {
  return apiFetch(withSource(`/api/products/${encodeURIComponent(sku)}`))
}

export async function verifyProduct(sku: string, brand: string) {
  return apiFetch(withSource("/api/products/verify"), {
    method: "POST",
    body: JSON.stringify({ sku, brand, source: "excel" }),
  })
}

export async function startValidation(params: {
  brand?: string
  limit?: number
  source?: "sheets" | "excel"
}) {
  return apiFetch("/api/validate", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function fetchValidationStatus(runId: string) {
  return apiFetch(`/api/validate/${runId}`)
}

export function streamValidation(runId: string, onEvent: (data: ProgressEventData) => void) {
  const eventSource = new EventSource(`${API_BASE}/api/validate/${runId}/stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ProgressEventData
      onEvent(data)
      if (data.type === "complete" || data.type === "error") {
        eventSource.close()
      }
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
  }

  return eventSource
}

export async function checkApiHealth(): Promise<{ connected: boolean; latencyMs: number }> {
  const start = performance.now()
  try {
    await apiFetch("/api/stats")
    return { connected: true, latencyMs: Math.round(performance.now() - start) }
  } catch {
    return { connected: false, latencyMs: Math.round(performance.now() - start) }
  }
}

// ---------- Schedules ----------

export async function fetchSchedules() {
  return apiFetch("/api/schedules")
}

export async function createSchedule(data: {
  name: string
  cron: string
  brand?: string | null
  enabled?: boolean
}) {
  return apiFetch("/api/schedules", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateSchedule(
  id: string,
  data: {
    name?: string
    cron?: string
    brand?: string | null
    enabled?: boolean
  }
) {
  return apiFetch(`/api/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteSchedule(id: string) {
  return apiFetch(`/api/schedules/${id}`, { method: "DELETE" })
}

export async function runScheduleNow(id: string) {
  return apiFetch(`/api/schedules/${id}/run`, { method: "POST" })
}

export async function fetchScheduleHistory(id: string) {
  return apiFetch(`/api/schedules/${id}/history`)
}

// ---------- Reports ----------

export async function fetchReports() {
  return apiFetch("/api/reports")
}

export async function fetchReportDetail(filename: string) {
  return apiFetch(`/api/reports/${filename}/data`)
}

export function getReportDownloadUrl(filename: string) {
  return `${API_BASE}/api/reports/${encodeURIComponent(filename)}`
}
