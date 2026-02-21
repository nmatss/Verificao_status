"use client"

import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Moon, Sun, LogOut, Menu, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import Link from "next/link"

const BREADCRUMB_LABELS: Record<string, string> = {
  "": "Dashboard",
  validacao: "Validacao",
  produtos: "Produtos",
  relatorios: "Relatorios",
  agendamentos: "Agendamentos",
  configuracoes: "Configuracoes",
}

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const [showMobile, setShowMobile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const pathname = usePathname()

  const segments = pathname.split("/").filter(Boolean)

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobile(!showMobile)}
            className="md:hidden text-slate-600 dark:text-slate-400"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Dashboard
            </Link>
            {segments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                {i === segments.length - 1 ? (
                  <span className="font-medium text-slate-900 dark:text-white">
                    {BREADCRUMB_LABELS[seg] || seg}
                  </span>
                ) : (
                  <Link
                    href={`/${segments.slice(0, i + 1).join("/")}`}
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    {BREADCRUMB_LABELS[seg] || seg}
                  </Link>
                )}
              </span>
            ))}
            {segments.length === 0 && (
              <span className="sr-only">Dashboard</span>
            )}
          </nav>

          {title && (
            <h1 className="sm:hidden text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {session?.user && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {session.user.image ? (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {session.user.name?.[0] || "U"}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{session.user.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {(session.user as any).role === "admin" ? "Administrador" : "Visualizador"}
                  </p>
                </div>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{session.user.name}</p>
                    <p className="text-xs text-slate-500">{session.user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {showMobile && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-300"
            onClick={() => setShowMobile(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-950 shadow-xl transition-transform duration-300">
            <Sidebar mobile />
          </div>
        </div>
      )}
    </>
  )
}
