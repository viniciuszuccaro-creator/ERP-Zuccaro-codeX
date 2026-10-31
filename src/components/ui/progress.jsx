
import * as React from "react"
import { cn } from "@/lib/utils"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & {value?: number} & React.RefAttributes<HTMLDivElement>>} */
const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-slate-200",
      className
    )}
    {...props}
  >
    <div
      className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
      style={{ width: `${value || 0}%` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
