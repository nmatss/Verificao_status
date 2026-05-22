"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  KeyRound,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  Inbox,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/reports/status-badge"
import { fetchProducts } from "@/lib/api"
import { cn, formatDate } from "@/lib/utils"
import type { LicenseStatus, Product } from "@/types"

// ---------- Constants ----------

const BRANDS = [
  { value: "", label: "Todas" },
  { value: "imaginarium", label: "Imaginarium" },
  { value: "puket", label: "Puket" },
  { value: "puket_escolares", label: "Puket Escolares" },
] as const

const LICENSE_STATUSES: LicenseStatus[] = ["ATIVO", "VENCIDO", "NAO_APLICAVEL"]

const STATUS_META: Record<
  LicenseStatus,
  {
    label: string
    icon: typeof CheckCircle2
    iconColor: string
    iconBg: string
    pieColor: string
  }
> = {
  ATIVO: {
    label: "Licencas Ativas",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 dark:bg-emerald-950",
    pieColor: "#10b981",
  },
  VENCIDO: {
    label: "Vencidas",
    icon: XCircle,
    iconColor: "text-red-600",
    iconBg: "bg-red-50 dark:bg-red-950",
    pieColor: "#ef4444",
  },
  NAO_APLICAVEL: {
    label: "Nao Aplicavel",
    icon: MinusCircle,
    iconColor: "text-slate-500",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    pieColor: "#94a3b8",
  },
}

const TABLE_ROW_LIMIT = 50

// ---------- Helpers ----------

interface ExpiringRow {
  sku: string
  name: string
  brand: string
  tipoCert: string
  validadeRaw: string
  validade: Date
  daysUntil: number
}

function parseValidade(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toLowerCase() === "n/a" || trimmed === "-") {
    return null
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function diffInDays(target: Date, now: Date): number {
  const ms = target.getTime() - now.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function certCategory(tipo: string | null | undefined): string {
  if (!tipo) return "SEM CATEGORIA"
  const upper = tipo.trim().toUpperCase()
  // Split pela primeira " - " ou pela palavra "SISTEMA"
  const dashIdx = upper.indexOf(" - ")
  const sistIdx = upper.indexOf("SISTEMA")
  const candidates = [dashIdx, sistIdx].filter((i) => i >= 0)
  if (candidates.length === 0) return upper
  const cut = Math.min(...candidates)
  return upper.slice(0, cut).trim() || upper
}

function formatValidade(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// ---------- Subcomponents ----------

interface KpiCardProps {
  status: LicenseStatus
  count: number
  total: number
}

function KpiCard({ status, count, total }: KpiCardProps) {
  const meta = STATUS_META[status]
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const Icon = meta.icon
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between">
        <div className={cn("p-2.5 rounded-lg", meta.iconBg)}>
          <Icon className={cn("w-5 h-5", meta.iconColor)} />
        </div>
        <span className="text-xs font-medium text-slate-500">{pct}%</span>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
          {count.toLocaleString("pt-BR")}
        </p>
        <p className="text-xs text-slate-500 mt-1">{meta.label}</p>
      </div>
    </div>
  )
}

interface StatusPieProps {
  counts: Record<LicenseStatus, number>
}

function StatusPie({ counts }: StatusPieProps) {
  const data = LICENSE_STATUSES.map((s) => ({
    name: STATUS_META[s].label,
    value: counts[s],
    color: STATUS_META[s].pieColor,
  })).filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Nenhum dado disponivel
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
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
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface ExpiredByCertProps {
  data: Array<{ category: string; count: number }>
}

function ExpiredByCertChart({ data }: ExpiredByCertProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Nenhuma licenca vencida
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          width={180}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="count" name="Vencidos" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardContent className="py-16 flex flex-col items-center text-center gap-3">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
          <Inbox className="w-6 h-6 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Nenhuma licenca cadastrada
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Nao ha produtos com licenciamento aplicavel para esta selecao.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

// ---------- Page ----------

interface ProductsResponse {
  products?: Product[]
  total?: number
}

export default function LicenciamentoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data: ProductsResponse = await fetchProducts({
          per_page: 1000,
          brand: brand || undefined,
        })
        if (!cancelled) {
          setProducts(data.products ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar dados")
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [brand])

  // ---------- Aggregations ----------

  const counts = useMemo<Record<LicenseStatus, number>>(() => {
    const acc: Record<LicenseStatus, number> = {
      ATIVO: 0,
      VENCIDO: 0,
      NAO_APLICAVEL: 0,
    }
    for (const p of products) {
      acc[p.license_status] = (acc[p.license_status] ?? 0) + 1
    }
    return acc
  }, [products])

  const total = products.length
  const aplicaveis = counts.ATIVO + counts.VENCIDO

  const expiredByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (p.license_status !== "VENCIDO") continue
      const cat = certCategory(p.tipo_certificacao)
      map.set(cat, (map.get(cat) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  const expiringRows = useMemo<ExpiringRow[]>(() => {
    const now = new Date()
    const lookback = new Date(now)
    lookback.setDate(lookback.getDate() - 30)

    const rows: ExpiringRow[] = []
    for (const p of products) {
      if (p.license_status === "NAO_APLICAVEL") continue
      const validade = parseValidade(p.validade_certificacao_raw)
      if (!validade) continue
      const days = diffInDays(validade, now)
      // <= 90 dias para vencer OU vencidos ate 30 dias atras
      const expiringSoon = days <= 90 && days >= 0
      const recentlyExpired = days < 0 && validade >= lookback
      if (!expiringSoon && !recentlyExpired) continue

      rows.push({
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        tipoCert: p.tipo_certificacao ?? "--",
        validadeRaw: p.validade_certificacao_raw ?? "",
        validade,
        daysUntil: days,
      })
    }
    rows.sort((a, b) => a.daysUntil - b.daysUntil)
    return rows
  }, [products])

  const visibleRows = expiringRows.slice(0, TABLE_ROW_LIMIT)
  const hasMore = expiringRows.length > TABLE_ROW_LIMIT
  const showEmpty = !loading && !error && aplicaveis === 0

  // ---------- Render ----------

  return (
    <>
      <Header title="Licenciamento" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Filter bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <KeyRound className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dashboard de Licenciamento
              </h2>
              <p className="text-xs text-slate-500">
                Status de INMETRO / ANATEL / MAPA por produto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="brand-filter"
              className="text-xs font-medium text-slate-500"
            >
              Marca:
            </label>
            <select
              id="brand-filter"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BRANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <CardContent className="py-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Erro ao carregar: {error}
              </p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : showEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {LICENSE_STATUSES.map((s) => (
                <KpiCard
                  key={s}
                  status={s}
                  count={counts[s]}
                  total={total}
                />
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                    Distribuicao por Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusPie counts={counts} />
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Vencidos por Tipo de Certificacao
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpiredByCertChart data={expiredByCategory} />
                </CardContent>
              </Card>
            </div>

            {/* Expiring table */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Vencimentos proximos
                  <span className="text-xs font-normal text-slate-500">
                    (proximos 90 dias ou vencidos no ultimo mes)
                  </span>
                </CardTitle>
                <Link
                  href="/produtos?license_status=VENCIDO"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                >
                  Ver todos vencidos
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {expiringRows.length === 0 ? (
                  <div className="px-6 py-10 flex flex-col items-center text-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Nenhum vencimento critico no horizonte de 90 dias.
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">SKU</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Tipo Cert</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead className="text-right pr-6">Dias</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.map((row) => {
                          const expired = row.daysUntil < 0
                          const critical = row.daysUntil >= 0 && row.daysUntil < 30
                          const rowClass = expired
                            ? "bg-red-50/60 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40"
                            : critical
                              ? "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              : ""
                          return (
                            <TableRow key={row.sku} className={rowClass}>
                              <TableCell className="pl-6 font-mono text-xs">
                                <Link
                                  href={`/produtos/${encodeURIComponent(row.sku)}`}
                                  className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {row.sku}
                                </Link>
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-xs text-slate-700 dark:text-slate-300">
                                {row.name}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                                {row.brand.replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="text-slate-700 dark:text-slate-300">
                                  {row.tipoCert.length > 48
                                    ? row.tipoCert.slice(0, 48) + "..."
                                    : row.tipoCert}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-700 dark:text-slate-300">
                                {formatValidade(row.validade)}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                {expired ? (
                                  <StatusBadge
                                    status="VENCIDO"
                                    variant="license"
                                    className="tabular-nums"
                                  />
                                ) : (
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums",
                                      critical
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    )}
                                  >
                                    {row.daysUntil}d
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {hasMore && (
                      <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Exibindo {visibleRows.length} de {expiringRows.length} vencimentos.
                          Ultima atualizacao: {formatDate(new Date())}
                        </p>
                        <Link
                          href="/produtos?license_status=VENCIDO"
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                        >
                          Ver todos vencidos
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
