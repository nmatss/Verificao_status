"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { fetchReports, getReportDownloadUrl } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { FileSpreadsheet, Download, Eye, Loader2 } from "lucide-react"
import Link from "next/link"

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Header title="Relatorios" />
      <div className="p-4 md:p-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Historico de Validacoes
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileSpreadsheet className="w-10 h-10 mb-2" />
              <p className="text-sm">Nenhum relatorio encontrado</p>
              <p className="text-xs mt-1">Execute uma validacao para gerar relatorios</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((report: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {report.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {report.date ? formatDate(report.date) : ""}
                        {report.size_bytes ? ` - ${(report.size_bytes / 1024).toFixed(1)} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/relatorios/${encodeURIComponent(report.filename)}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                    </Link>
                    <a
                      href={getReportDownloadUrl(report.filename)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Excel
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
