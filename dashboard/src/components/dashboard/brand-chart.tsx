"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface BrandData {
  brand: string
  ok: number
  missing: number
  inconsistent: number
  not_found: number
}

export function BrandChart({ data }: { data?: BrandData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Nenhum dado disponivel
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="brand" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Bar dataKey="ok" name="OK" fill="#10b981" radius={[2, 2, 0, 0]} />
        <Bar dataKey="missing" name="Missing" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="inconsistent" name="Inconsistente" fill="#f59e0b" radius={[2, 2, 0, 0]} />
        <Bar dataKey="not_found" name="Nao Encontrado" fill="#94a3b8" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
