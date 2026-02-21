"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatusBadge } from "@/components/reports/status-badge"
import { fetchReportDetail, getReportDownloadUrl } from "@/lib/api"
import { Download, Search, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ReportDetailPage() {
  const params = useParams()
  const filename = decodeURIComponent(params.id as string)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [brandFilter, setBrandFilter] = useState("")

  useEffect(() => {
    fetchReportDetail(filename)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filename])

  if (loading) {
    return (
      <>
        <Header title="Relatorio" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <Header title="Relatorio" />
        <div className="p-6 text-center text-slate-500">Relatorio nao encontrado</div>
      </>
    )
  }

  const results = data.results || []
  const summary = data.summary || {}

  const filtered = results.filter((r: any) => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.sku?.toLowerCase().includes(q) && !r.name?.toLowerCase().includes(q)) return false
    }
    if (statusFilter && r.status !== statusFilter) return false
    if (brandFilter && r.brand !== brandFilter) return false
    return true
  })

  const statuses = [...new Set(results.map((r: any) => r.status))] as string[]
  const brands = [...new Set(results.map((r: any) => r.brand))] as string[]

  return (
    <>
      <Header title={filename} />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex-1">{filename}</h2>
          <a
            href={getReportDownloadUrl(filename)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </a>
        </div>

        <StatsCards
          data={{
            total: summary.total || results.length,
            ok: summary.ok || results.filter((r: any) => r.status === "OK").length,
            missing: summary.missing || results.filter((r: any) => r.status === "MISSING").length,
            inconsistent: summary.inconsistent || results.filter((r: any) => r.status === "INCONSISTENT").length,
            not_found: summary.not_found || results.filter((r: any) => r.status === "URL_NOT_FOUND").length,
          }}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar SKU ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">Todos os status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Marca</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">{r.sku}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.brand}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.score?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-xs truncate block max-w-[150px]">
                          Link
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            {filtered.length} de {results.length} resultados
          </div>
        </div>
      </div>
    </>
  )
}
