export type CertStatus =
  | "ATIVO"
  | "ENCERRADO"
  | "SKU_EXCLUIDO"
  | "EM_ANDAMENTO"
  | "DESCONHECIDO"

export type SiteStatus = "CONFORME" | "NAO_CONFORME" | "PENDENTE"

export type LicenseStatus = "ATIVO" | "VENCIDO" | "NAO_APLICAVEL"

export type ComercializacaoStatus =
  | "LIBERADA"
  | "DENTRO_PRAZO"
  | "ENCERRADA"
  | "NAO_APLICA"

export type ValidationStatus =
  | "OK"
  | "MISSING"
  | "INCONSISTENT"
  | "URL_NOT_FOUND"
  | "API_ERROR"
  | "NO_EXPECTED"

export interface Product {
  sku: string
  name: string
  brand: string
  excel_row: number
  expected_cert_text: string | null
  situacao: string | null
  tipo_certificacao: string | null
  validade_certificacao_raw: string | null
  prazo_final_venda_raw: string | null
  numero_registro: string | null
  cert_status: CertStatus
  site_status?: SiteStatus
  last_site_status?: SiteStatus | null
  license_status: LicenseStatus
  comercializacao_status?: ComercializacaoStatus
  codigo_barras?: string | null
  estoque_informado?: number | null
  last_validation_status?: ValidationStatus | null
  last_validation_score?: number | null
  last_validation_url?: string | null
  last_validation_date?: string | null
}

export interface Validation {
  status: ValidationStatus
  site_status?: SiteStatus
  score: number
  verified_at: string
  url: string | null
  actual_cert_text: string | null
  ai_assessment: string | null
  error?: string | null
}

export interface ReportSummary {
  total: number
  ok: number
  missing: number
  inconsistent: number
  not_found: number
}

export interface ReportListItem {
  filename: string
  date?: string
  size_bytes?: number
  summary?: ReportSummary
}

export interface ReportResult {
  sku: string
  name: string
  brand: string
  status: ValidationStatus
  site_status?: SiteStatus
  cert_status?: CertStatus
  license_status?: LicenseStatus
  score?: number
  url?: string | null
}

export interface Report {
  filename: string
  date?: string
  summary?: ReportSummary
  results?: ReportResult[]
}

export interface ReportDetail {
  filename?: string
  date?: string
  summary?: Partial<ReportSummary>
  results?: ReportResult[]
}

// ---------- Stats ----------

export interface StatsBucket {
  site_status?: string
  cert_status?: string
  status?: ValidationStatus
  count: number
}

export interface BrandValidationBucket {
  brand: string
  ok: number
  missing: number
  inconsistent: number
  not_found: number
  total?: number
}

export interface LastRun {
  date?: string
  total?: number
  ok?: number
  missing?: number
  inconsistent?: number
  not_found?: number
}

export interface Stats {
  total_products?: number
  last_run?: LastRun
  by_brand?: BrandValidationBucket[]
  by_site_status?: StatsBucket[]
  by_cert_status?: StatsBucket[]
  by_brand_cert_status?: Array<Record<string, string | number>>
  by_license_status?: Array<{ license_status: LicenseStatus; count: number }>
  by_comercializacao_status?: Array<{
    comercializacao_status: ComercializacaoStatus
    count: number
  }>
  total_codigo_barras?: number
  total_estoque_informado?: number
}

// ---------- Validation streaming ----------

export interface ValidationSummary {
  total?: number
  ok?: number
  missing?: number
  inconsistent?: number
  not_found?: number
  report_file?: string
}

export interface ProgressEventProduct {
  sku: string
  name: string
  status: string
  score: number
}

export type ProgressEventData =
  | {
      type: "progress"
      current?: number
      total?: number
      product?: ProgressEventProduct
    }
  | {
      type: "complete"
      summary?: ValidationSummary
    }
  | {
      type: "error"
      error?: string
    }

// ---------- Schedules ----------

export interface Schedule {
  id: string
  name: string
  brand_filter: string | null
  cron_expression: string
  enabled: boolean
  created_at: string
  last_run: string | null
  next_run: string | null
}

export interface ScheduleHistorySummary {
  total?: number
  ok?: number
  missing?: number
  inconsistent?: number
  not_found?: number
}

export interface ScheduleHistoryEntry {
  id: string
  schedule_id: string
  run_date: string
  status: string
  summary: ScheduleHistorySummary | null
  report_file: string | null
}

// ---------- Product detail ----------

export interface ProductValidationResult {
  status?: ValidationStatus
  site_status?: SiteStatus
  cert_status?: CertStatus
  license_status?: LicenseStatus
  score?: number | null
  verified_at?: string | null
  date?: string | null
  url?: string | null
  actual_cert_text?: string | null
  ai_assessment?: string | null
  error?: string | null
}

export interface ProductDetail extends Product {
  last_validation?: ProductValidationResult | null
}
