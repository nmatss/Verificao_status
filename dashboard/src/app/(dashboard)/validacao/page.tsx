"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Header } from "@/components/layout/header"
import { ValidationProgress } from "@/components/dashboard/validation-progress"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { startValidation } from "@/lib/api"
import { PlayCircle, Loader2, ShieldCheck, Filter, Radio, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const BRANDS = [
  { value: "", label: "Todas as Marcas", count: 258 },
  { value: "imaginarium", label: "Imaginarium", count: 103 },
  { value: "puket", label: "Puket", count: 38 },
  { value: "puket_escolares", label: "Puket Escolares", count: 117 },
]

export default function ValidationPage() {
  const { data: session } = useSession()
  const [brand, setBrand] = useState("")
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedBrand = BRANDS.find((b) => b.value === brand)
  const productCount = selectedBrand?.count || 258
  const estimatedSeconds = Math.ceil(productCount * 1.5)
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60)

  async function handleStart() {
    setError(null)
    setSummary(null)
    setRunning(true)
    try {
      const res = await startValidation({
        brand: brand || undefined,
        source: "sheets",
      })
      setRunId(res.run_id)
    } catch (e: any) {
      setError(e.message || "Erro ao iniciar validacao")
      setRunning(false)
    }
  }

  function handleComplete(sum: any) {
    setSummary(sum)
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
                  {BRANDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label} ({b.count})
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
