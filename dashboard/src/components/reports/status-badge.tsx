import { cn, statusColor, statusLabel } from "@/lib/utils"

export type StatusBadgeVariant = "cert" | "site" | "license" | "validation"

interface StatusBadgeProps {
  status: string | null | undefined
  variant?: StatusBadgeVariant
  className?: string
  showLabel?: boolean
}

export function StatusBadge({
  status,
  variant = "validation",
  className,
  showLabel = true,
}: StatusBadgeProps) {
  if (!status) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium",
          "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
          className
        )}
      >
        --
      </span>
    )
  }

  const label = showLabel ? statusLabel(status) : status
  return (
    <span
      data-variant={variant}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide",
        statusColor(status),
        className
      )}
    >
      {label}
    </span>
  )
}
