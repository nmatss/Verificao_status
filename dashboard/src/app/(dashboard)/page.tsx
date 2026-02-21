"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BrandChart } from "@/components/dashboard/brand-chart"
import { fetchStats, fetchReports, fetchReportDetail, checkApiHealth } from "@/lib/api"
import { formatDate, relativeTime, cn, statusColor } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  PlayCircle,
  FileBarChart,
  Clock,
  TrendingUp,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const PIE_COLORS = {
  OK: "#10b981",
  MISSING: "#ef4444",
  INCONSISTENT: "#f59e0b",
  NOT_FOUND: "#94a3b8",
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(false)
  const [problemProducts, setProblemProducts] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetchStats().catch(() => null),
      fetchReports().catch(() => []),
      checkApiHealth(),
    ]).then(([s, r, health]) => {
      setStats(s)
      setApiOnline(health.connected)
      const reportList = Array.isArray(r) ? r : []
      setReports(reportList.slice(0, 5))

      // Load problem products from the latest report
      if (reportList.length > 0 && reportList[0]?.filename) {
        fetchReportDetail(reportList[0].filename)
          .then((data) => {
            const items = Array.isArray(data) ? data : data?.products || data?.results || []
            const problems = items
              .filter((p: any) => p.status === "MISSING" || p.status === "INCONSISTENT")
              .slice(0, 10)
            setProblemProducts(problems)
          })
          .catch(() => {})
      }

      setLoading(false)
    })
  }, [])

  const lastRun = stats?.last_run
  const okRate = lastRun && lastRun.total > 0
    ? ((lastRun.ok / lastRun.total) * 100).toFixed(1)
    : null

  const pieData = lastRun
    ? [
        { name: "OK", value: lastRun.ok || 0 },
        { name: "Missing", value: lastRun.missing || 0 },
        { name: "Inconsistente", value: lastRun.inconsistent || 0 },
        { name: "Nao Encontrado", value: lastRun.not_found || 0 },
      ].filter((d) => d.value > 0)
    : []

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Health + Last Run Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              apiOnline
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                apiOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              )} />
              {apiOnline ? "Sistema Online" : "Sistema Offline"}
            </div>

            {okRate && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{okRate}%</span>
                <span>conformidade</span>
              </div>
            )}
          </div>

          {lastRun?.date && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Ultima verificacao: {formatDate(lastRun.date)}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {relativeTime(lastRun.date)}
              </Badge>
            </div>
          )}
        </div>

        {/* Stats */}
        <StatsCards
          loading={loading}
          data={
            lastRun
              ? {
                  total: lastRun.total || 0,
                  ok: lastRun.ok || 0,
                  missing: lastRun.missing || 0,
                  inconsistent: lastRun.inconsistent || 0,
                  not_found: lastRun.not_found || 0,
                }
              : { total: stats?.total_products || 0, ok: 0, missing: 0, inconsistent: 0, not_found: 0 }
          }
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Status Distribution Pie Chart */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Distribuicao de Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.name === "OK" ? PIE_COLORS.OK :
                              entry.name === "Missing" ? PIE_COLORS.MISSING :
                              entry.name === "Inconsistente" ? PIE_COLORS.INCONSISTENT :
                              PIE_COLORS.NOT_FOUND
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          color: "var(--card-foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{
                              backgroundColor:
                                d.name === "OK" ? PIE_COLORS.OK :
                                d.name === "Missing" ? PIE_COLORS.MISSING :
                                d.name === "Inconsistente" ? PIE_COLORS.INCONSISTENT :
                                PIE_COLORS.NOT_FOUND,
                            }}
                          />
                          <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-slate-400">
                  Nenhum dado disponivel
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Chart */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Resultados por Marca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BrandChart data={stats?.by_brand} />
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Products with Problems */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Produtos com Problemas
                </CardTitle>
                {problemProducts.length > 0 && (
                  <Link
                    href="/produtos?status=MISSING,INCONSISTENT"
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {problemProducts.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  {loading ? "Carregando..." : "Nenhum problema encontrado"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {problemProducts.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {p.status === "MISSING" ? (
                          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="text-xs font-mono text-slate-500 flex-shrink-0">{p.sku}</span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                      </div>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", statusColor(p.status))}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Recent Reports */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                  Acoes Rapidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/validacao"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    <PlayCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Nova Validacao</p>
                      <p className="text-xs text-slate-500">Verificar todos os produtos</p>
                    </div>
                  </Link>
                  <Link
                    href="/relatorios"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    <FileBarChart className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Relatorios</p>
                      <p className="text-xs text-slate-500">Ver historico completo</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Reports */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ultimas Validacoes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Nenhuma validacao realizada</p>
                ) : (
                  <div className="space-y-2">
                    {reports.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{r.filename}</span>
                        </div>
                        <span className="text-xs text-slate-500">{r.date ? formatDate(r.date) : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
