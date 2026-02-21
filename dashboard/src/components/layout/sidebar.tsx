"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { checkApiHealth } from "@/lib/api"
import {
  LayoutDashboard,
  PlayCircle,
  FileBarChart,
  Settings,
  ChevronLeft,
  Package,
  CalendarClock,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/validacao", label: "Validacao", icon: PlayCircle },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/relatorios", label: "Relatorios", icon: FileBarChart },
  { href: "/agendamentos", label: "Agendamentos", icon: CalendarClock },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
]

export function Sidebar({ mobile }: { mobile?: boolean } = {}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)

  useEffect(() => {
    checkApiHealth().then((h) => setApiOnline(h.connected))
    const interval = setInterval(() => {
      checkApiHealth().then((h) => setApiOnline(h.connected))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-all duration-300",
        !mobile && "hidden md:flex",
        mobile ? "w-64 h-full" : collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex-shrink-0">
          <img
            src="/logo-unico.png"
            alt="Uni.co"
            className="w-8 h-8 rounded-full"
          />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-950",
              apiOnline ? "bg-emerald-500" : "bg-slate-400"
            )}
          />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">Uni.co</p>
            <p className="text-[10px] text-slate-500 truncate">Certificacoes E-commerce</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-800">
        {!collapsed && (
          <div className="px-4 py-2">
            <p className="text-[10px] text-slate-400">v1.0.0</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  )
}
