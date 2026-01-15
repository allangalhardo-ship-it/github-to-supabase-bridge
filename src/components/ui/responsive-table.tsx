import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0",
          className
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
        {...props}
      >
        <div className="min-w-max md:min-w-0">
          {children}
        </div>
      </div>
    )
  }
)
ResponsiveTable.displayName = "ResponsiveTable"

export { ResponsiveTable }
