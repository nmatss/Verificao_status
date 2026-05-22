"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { ValidationProgress } from "@/components/dashboard/validation-progress"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { fetchStats, startValidation } from "@/lib/api"
import { PlayCircle, Loader2, ShieldCheck, Filter, Radio, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Stats, ValidationSummary } from "@/types"

const BRAND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todas as Marcas" },
  { value: "imaginarium", label: "Imaginarium" },
  { value: "puket", label: "Puket" },
  { value: "puket_escolares", label: "Puket Escolares" },
]

export default function ValidationPage() {
  const [brand, setBrand] = useState("")
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    (fetchStats() as Promise<Stats>).then(setStats).catch(() => setStats(null))
  }, [])

  function brandCount(value: string): number {
    if (!stats) return 0
    if (!value) {
      if (stats.total_products) return stats.total_products
      return (stats.by_brand ?? []).reduce(
        (acc, b) =>
          acc + (b.total ?? b.ok + b.missing + b.inconsistent + b.not_found),
        0
      )
    }
    const bucket = (stats.by_brand ?? []).find(
      (b) => b.brand.toLowerCase().replace(" ", "_") === value
    )
    if (!bucket) return 0
    return (
      bucket.total ??
      bucket.ok + bucket.missing + bucket.inconsistent + bucket.not_found
    )
  }

  const productCount = brandCount(brand)
  const estimatedSeconds = Math.ceil(productCount * 1.5)
  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60))

  async function handleStart() {
    setError(null)
    setSummary(null)
    setRunning(true)
    try {
      const res = (await startValidation({
        brand: brand || undefined,
        source: "excel",
      })) as { run_id: string }
      setRunId(res.run_id)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao iniciar validacao"
      setError(message)
      setRunning(false)
    }
  }

  function handleComplete(sum: ValidationSummary | undefined) {
    setSummary(sum ?? null)
    setRunning(false)
  }

  return (
    <>
      <Header title="Validacao" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Real-time Info Banner */}
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Verificacao em Tempo Real
                  </p>
                  <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 hover:bg-blue-600">
                    <Radio className="w-2.5 h-2.5 mr-1" />
                    Live
                  </Badge>
                </div>
                <p className="text-xs text-blue-700/80 dark:text-blue-400/80">
                  A verificacao consulta os sites em TEMPO REAL via API VTEX. Cada produto e verificado
                  individualmente, comparando o texto de certificacao no site com o valor esperado na planilha.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={running}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BRAND_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label} ({brandCount(b.value)})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStart}
                disabled={running}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors",
                  running
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Iniciar Validacao
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                <span>Tempo estimado: ~{estimatedMinutes} min ({productCount} produtos)</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress */}
        {runId && <ValidationProgress runId={runId} onComplete={handleComplete} />}

        {/* Summary */}
        {summary && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Resultado da Validacao
              </h2>
            </div>
            <StatsCards
              data={{
                total: summary.total || 0,
                ok: summary.ok || 0,
                missing: summary.missing || 0,
                inconsistent: summary.inconsistent || 0,
                not_found: summary.not_found || 0,
              }}
            />
            {summary.report_file && (
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                <CardContent className="p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Relatorio gerado: <span className="font-mono font-medium">{summary.report_file}</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
