"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { fetchStats, checkApiHealth } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, Database, Globe, Cpu, Zap, Loader2, Radio, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; latencyMs: number } | null>(null)

  useEffect(() => {
    fetchStats()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  const isConnected = status !== null

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    const result = await checkApiHealth()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <>
      <Header title="Configuracoes" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Connection Status */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Status do Sistema
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    testing
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                  )}
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  Testar Conexao
                </button>
                {testResult && (
                  <Badge
                    className={cn(
                      "text-[10px]",
                      testResult.connected
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {testResult.connected
                      ? `OK - ${testResult.latencyMs}ms`
                      : `Falha - ${testResult.latencyMs}ms`}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Sheets</p>
                    <p className="text-xs text-slate-500">Fonte de dados dos produtos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-emerald-600">Conectado</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600">Desconectado</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">API Backend</p>
                    <p className="text-xs text-slate-500">FastAPI - Porta 8000</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-emerald-600">Online</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600">Offline</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sites Monitorados</p>
                    <p className="text-xs text-slate-500">puket.com.br, loja.imaginarium.com.br</p>
                  </div>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">2 sites</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Verificacao em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
              <p>
                O sistema consulta os e-commerces Puket e Imaginarium em <span className="font-medium text-slate-900 dark:text-white">tempo real</span> usando
                a API publica VTEX. Nenhum dado de produto e armazenado localmente.
              </p>
              <Separator className="bg-slate-100 dark:bg-slate-800" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-xs">1. Leitura da Planilha</p>
                    <p className="text-xs mt-0.5">Produtos e certificacoes esperadas sao carregados do Google Sheets</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-xs">2. Consulta VTEX</p>
                    <p className="text-xs mt-0.5">Cada SKU e buscado na API VTEX para obter a descricao do produto</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-xs">3. Comparacao</p>
                    <p className="text-xs mt-0.5">O texto de certificacao encontrado e comparado com o valor esperado</p>
                  </div>
                </div>
              </div>
              <Separator className="bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Delay entre requests: 1.5s por produto para evitar rate limiting da API VTEX</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Informacoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Total de Produtos</p>
                <p className="font-medium text-slate-900 dark:text-white">{status?.total_products || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Planilha</p>
                <p className="font-medium text-slate-900 dark:text-white">STATUS CERTIFICACAO</p>
              </div>
              <div>
                <p className="text-slate-500">Marcas</p>
                <p className="font-medium text-slate-900 dark:text-white">Imaginarium, Puket, Puket Escolares</p>
              </div>
              <div>
                <p className="text-slate-500">Delay entre Requests</p>
                <p className="font-medium text-slate-900 dark:text-white">1.5s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
