const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  return apiFetch("/api/stats")
}

export async function fetchProducts(params?: {
  page?: number
  per_page?: number
  search?: string
  brand?: string
  status?: string
}) {
  const query = new URLSearchParams()
  if (params?.page) query.set("page", String(params.page))
  if (params?.per_page) query.set("per_page", String(params.per_page))
  if (params?.search) query.set("search", params.search)
  if (params?.brand) query.set("brand", params.brand)
  if (params?.status) query.set("status", params.status)
  const qs = query.toString()
  return apiFetch(`/api/products${qs ? `?${qs}` : ""}`)
}

export async function fetchProductDetail(sku: string) {
  return apiFetch(`/api/products/${encodeURIComponent(sku)}`)
}

export async function verifyProduct(sku: string, brand: string) {
  return apiFetch("/api/products/verify", {
    method: "POST",
    body: JSON.stringify({ sku, brand }),
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

export function streamValidation(runId: string, onEvent: (data: any) => void) {
  const eventSource = new EventSource(`${API_BASE}/api/validate/${runId}/stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
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
  return `${API_BASE}/api/reports/${filename}`
}
