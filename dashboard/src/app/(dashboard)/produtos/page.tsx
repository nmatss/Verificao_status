"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { StatusBadge } from "@/components/reports/status-badge"
import { fetchProducts, verifyProduct } from "@/lib/api"
import { cn, formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

const BRANDS = [
  { value: "", label: "Todas as Marcas" },
  { value: "imaginarium", label: "Imaginarium" },
  { value: "puket", label: "Puket" },
  { value: "puket_escolares", label: "Puket Escolares" },
]

const SITUACOES = [
  { value: "", label: "Todas as Situacoes" },
  { value: "Ativo", label: "Ativo" },
  { value: "Encerrado", label: "Encerrado" },
  { value: "SKU excluído", label: "SKU excluido" },
  { value: "Em andamento", label: "Em andamento" },
]

const CERT_STATUSES = [
  { value: "", label: "Cert: Todos" },
  { value: "ATIVO", label: "ATIVO" },
  { value: "ENCERRADO", label: "ENCERRADO" },
  { value: "SKU_EXCLUIDO", label: "SKU_EXCLUIDO" },
  { value: "EM_ANDAMENTO", label: "EM_ANDAMENTO" },
]

const SITE_STATUSES = [
  { value: "", label: "Site: Todos" },
  { value: "CONFORME", label: "CONFORME" },
  { value: "NAO_CONFORME", label: "NAO_CONFORME" },
  { value: "PENDENTE", label: "PENDENTE" },
]

const LICENSE_STATUSES = [
  { value: "", label: "Lic: Todos" },
  { value: "ATIVO", label: "ATIVO" },
  { value: "VENCIDO", label: "VENCIDO" },
  { value: "NAO_APLICAVEL", label: "NAO_APLICAVEL" },
]

const COMERCIALIZACAO_STATUSES = [
  { value: "", label: "Comerc: Todos" },
  { value: "LIBERADA", label: "LIBERADA" },
  { value: "DENTRO_PRAZO", label: "DENTRO_PRAZO" },
  { value: "ENCERRADA", label: "ENCERRADA" },
  { value: "NAO_APLICA", label: "NAO_APLICA" },
]

type SortField =
  | "sku"
  | "name"
  | "brand"
  | "last_site_status"
  | "cert_status"
  | "license_status"
type SortDir = "asc" | "desc"

interface ProductRow {
  sku: string
  name: string
  brand: string
  excel_row?: number
  situacao?: string | null
  cert_status?: string | null
  site_status?: string | null
  last_site_status?: string | null
  license_status?: string | null
  comercializacao_status?: string | null
  last_validation_status?: string | null
  last_validation_score?: number | null
  last_validation_url?: string | null
  last_validation_date?: string | null
}

function ProductsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage] = useState(25)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [brand, setBrand] = useState(() => searchParams.get("brand") ?? "")
  const [situacao, setSituacao] = useState("")
  const [certStatus, setCertStatus] = useState(() => searchParams.get("cert_status") ?? "")
  const [siteStatus, setSiteStatus] = useState(() => searchParams.get("site_status") ?? "")
  const [licenseStatus, setLicenseStatus] = useState(
    () => searchParams.get("license_status") ?? ""
  )
  const [comercializacaoStatus, setComercializacaoStatus] = useState(
    () => searchParams.get("comercializacao_status") ?? ""
  )
  const [lastDate, setLastDate] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>("sku")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Reflect filter state back into the URL (replace, don't push, to avoid history spam).
  useEffect(() => {
    const next = new URLSearchParams()
    if (brand) next.set("brand", brand)
    if (siteStatus) next.set("site_status", siteStatus)
    if (certStatus) next.set("cert_status", certStatus)
    if (licenseStatus) next.set("license_status", licenseStatus)
    if (comercializacaoStatus) next.set("comercializacao_status", comercializacaoStatus)
    const qs = next.toString()
    const current = searchParams.toString()
    if (qs !== current) {
      router.replace(qs ? `/produtos?${qs}` : "/produtos", { scroll: false })
    }
  }, [brand, siteStatus, certStatus, licenseStatus, comercializacaoStatus, router, searchParams])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProducts({
        page,
        per_page: perPage,
        search: search || undefined,
        brand: brand || undefined,
        situacao: situacao || undefined,
        cert_status: certStatus || undefined,
        site_status: siteStatus || undefined,
        license_status: licenseStatus || undefined,
        comercializacao_status: comercializacaoStatus || undefined,
      })
      setProducts(data.products || [])
      setTotalPages(data.total_pages || 1)
      setTotal(data.total || 0)
      setLastDate(data.last_validation_date || null)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [
    page,
    perPage,
    search,
    brand,
    situacao,
    certStatus,
    siteStatus,
    licenseStatus,
    comercializacaoStatus,
  ])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField] ?? ""
    const bVal = (b as unknown as Record<string, unknown>)[sortField] ?? ""
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal
    }
    const cmp = String(aVal).localeCompare(String(bVal), "pt-BR", { sensitivity: "base" })
    return sortDir === "asc" ? cmp : -cmp
  })

  async function handleVerify(sku: string, productBrand: string) {
    setVerifying(sku)
    try {
      const brandKey = productBrand.toLowerCase().replace(" ", "_")
      const result = await verifyProduct(sku, brandKey)
      setProducts((prev) =>
        prev.map((p) =>
          p.sku === sku
            ? {
                ...p,
                last_validation_status: result.status,
                last_validation_score: result.score,
                last_validation_url: result.url,
                last_validation_date: result.verified_at,
                last_site_status: result.site_status ?? p.last_site_status,
              }
            : p
        )
      )
    } catch {
      // Silently handle - product row stays as-is
    } finally {
      setVerifying(null)
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />
  }

  return (
    <>
      <Header title="Produtos" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Filters bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por SKU ou nome..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Buscar
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={brand}
                onChange={(e) => { setBrand(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BRANDS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <select
                value={situacao}
                onChange={(e) => { setSituacao(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SITUACOES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={certStatus}
                onChange={(e) => { setCertStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CERT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={siteStatus}
                onChange={(e) => { setSiteStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SITE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={licenseStatus}
                onChange={(e) => { setLicenseStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LICENSE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={comercializacaoStatus}
                onChange={(e) => { setComercializacaoStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMERCIALIZACAO_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary line */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              {total} produto{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              {lastDate && (
                <span className="ml-2">
                  | Ultima validacao: {formatDate(lastDate)}
                </span>
              )}
            </p>
            <button
              onClick={loadProducts}
              disabled={loading}
              aria-label="Atualizar lista"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">Nenhum produto encontrado</p>
              <p className="text-xs mt-1">Ajuste os filtros ou busca</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("sku")}
                  >
                    <span className="flex items-center">SKU <SortIcon field="sku" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center">Nome <SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("brand")}
                  >
                    <span className="flex items-center">Marca <SortIcon field="brand" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("last_site_status")}
                  >
                    <span className="flex items-center">Site <SortIcon field="last_site_status" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("cert_status")}
                  >
                    <span className="flex items-center">Certificacao <SortIcon field="cert_status" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("license_status")}
                  >
                    <span className="flex items-center">Licenciamento <SortIcon field="license_status" /></span>
                  </TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((p) => (
                  <TableRow key={p.sku} className="group">
                    <TableCell className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                      <Link
                        href={`/produtos/${encodeURIComponent(p.sku)}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-300 max-w-[300px] truncate">
                      <Link
                        href={`/produtos/${encodeURIComponent(p.sku)}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {p.brand}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.last_site_status ?? null} variant="site" />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.cert_status ?? null} variant="cert" />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.license_status ?? null} variant="license" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleVerify(p.sku, p.brand)}
                          disabled={verifying === p.sku}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                            verifying === p.sku
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
                          )}
                        >
                          {verifying === p.sku ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Verificar
                        </button>
                        {p.last_validation_url && (
                          <a
                            href={p.last_validation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Ver produto no site"
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                Pagina {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  aria-label="Pagina anterior"
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 7) {
                    pageNum = i + 1
                  } else if (page <= 4) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i
                  } else {
                    pageNum = page - 3 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      aria-label={`Ir para pagina ${pageNum}`}
                      aria-current={page === pageNum ? "page" : undefined}
                      className={cn(
                        "w-8 h-8 rounded-md text-xs font-medium transition-colors",
                        page === pageNum
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  aria-label="Proxima pagina"
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}>
      <ProductsPageInner />
    </Suspense>
  )
}
