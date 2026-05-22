"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { StatusBadge } from "@/components/reports/status-badge"
import { fetchProductDetail, verifyProduct } from "@/lib/api"
import { cn, formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Boxes,
} from "lucide-react"
import type { ProductDetail, ProductValidationResult } from "@/types"

export default function ProductDetailPage() {
  const params = useParams()
  const rawSku = params?.sku
  const skuParam = Array.isArray(rawSku) ? rawSku[0] : rawSku
  const sku = skuParam ? decodeURIComponent(skuParam) : ""
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [liveResult, setLiveResult] = useState<ProductValidationResult | null>(null)

  useEffect(() => {
    if (!sku) {
      setLoading(false)
      setError("SKU invalido")
      return
    }
    setLoading(true)
    setError(null)
    ;(fetchProductDetail(sku) as Promise<ProductDetail>)
      .then(setProduct)
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Erro ao carregar produto"
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [sku])

  async function handleVerify() {
    if (!product) return
    setVerifying(true)
    setLiveResult(null)
    try {
      const brandKey = product.brand.toLowerCase().replace(" ", "_")
      const result = (await verifyProduct(sku, brandKey)) as ProductValidationResult
      setLiveResult(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro na verificacao"
      setLiveResult({ error: message })
    } finally {
      setVerifying(false)
    }
  }

  const validation = liveResult || product?.last_validation
  const siteStatus =
    liveResult?.site_status ?? product?.last_validation?.site_status ?? null
  const certStatus = product?.cert_status
  const licenseStatus = product?.license_status

  return (
    <>
      <Header title={`Produto: ${sku}`} />
      <div className="p-4 md:p-6 space-y-4">
        {/* Back link */}
        <Link
          href="/produtos"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Produtos
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : product ? (
          <>
            {/* Product info card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex-shrink-0">
                    <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {product.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {product.sku}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>{product.brand}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>Linha {product.excel_row}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Site</span>
                        <StatusBadge status={siteStatus ?? null} variant="site" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Cert</span>
                        <StatusBadge status={certStatus ?? null} variant="cert" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Licenca</span>
                        <StatusBadge status={licenseStatus ?? null} variant="license" />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0",
                    verifying
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Verificar Agora
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validation result */}
            {validation && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {liveResult ? "Resultado ao Vivo" : "Ultima Validacao"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {validation.status && <StatusBadge status={validation.status} />}
                    {validation.score != null && (
                      <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-400">
                        {(validation.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                {(validation.date || validation.verified_at) && (
                  <p className="text-xs text-slate-500">
                    {liveResult ? "Verificado em: " : "Data: "}
                    {formatDate((validation.verified_at || validation.date) as string)}
                    {liveResult && (
                      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-medium">
                        LIVE
                      </span>
                    )}
                  </p>
                )}

                {validation.url && (
                  <a
                    href={validation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver produto no site
                  </a>
                )}

                {validation.error && !validation.status && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                    {validation.error}
                  </div>
                )}
              </div>
            )}

            {/* Spreadsheet data */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Dados da Planilha
              </h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Situacao</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {product.situacao || <span className="text-slate-400 italic">--</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Tipo de Certificacao</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {product.tipo_certificacao || <span className="text-slate-400 italic">--</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Validade Certificacao</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {product.validade_certificacao_raw || <span className="text-slate-400 italic">--</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Prazo Final Venda</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {product.prazo_final_venda_raw || <span className="text-slate-400 italic">--</span>}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Numero Registro</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5 font-mono text-xs">
                    {product.numero_registro || <span className="text-slate-400 italic font-sans">--</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Cod. Barras (EAN)</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5 font-mono text-xs">
                    {product.codigo_barras || <span className="text-slate-400 italic font-sans">--</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400">Estoque (planilha)</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {product.estoque_informado != null
                      ? product.estoque_informado.toLocaleString("pt-BR")
                      : <span className="text-slate-400 italic">--</span>}
                  </dd>
                </div>
              </dl>
            </div>

            {product.estoque_informado != null && product.estoque_informado >= 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex-shrink-0">
                  <Boxes className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Estoque informado</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">
                    {product.estoque_informado.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Fonte: planilha &mdash; WMS nao integrado ainda
                  </p>
                </div>
              </div>
            )}

            {/* Side-by-side text comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Texto Esperado (Planilha)
                </h4>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 min-h-[80px]">
                  {product.expected_cert_text ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {product.expected_cert_text}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Sem texto de certificacao esperado
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Texto Encontrado (E-commerce)
                </h4>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 min-h-[80px]">
                  {validation?.actual_cert_text ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {validation.actual_cert_text}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      {validation
                        ? "Nenhum texto de certificacao encontrado no site"
                        : "Execute uma verificacao para ver o texto"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Assessment */}
            {validation?.ai_assessment && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Avaliacao IA
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {validation.ai_assessment}
                </p>
              </div>
            )}

            {/* Error details */}
            {validation?.error && validation.status && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                  Detalhes do Erro
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {validation.error}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  )
}
