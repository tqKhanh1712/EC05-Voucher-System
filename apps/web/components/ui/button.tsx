import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-ui-sm border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand-hover",
        outline:
          "border-border bg-surface text-foreground hover:bg-surface-subtle aria-expanded:bg-surface-subtle",
        secondary:
          "bg-brand-subtle text-brand hover:bg-orange-100 aria-expanded:bg-brand-subtle",
        ghost:
          "hover:bg-surface-subtle hover:text-foreground aria-expanded:bg-surface-subtle",
        destructive:
          "bg-danger-subtle text-danger hover:bg-red-100 focus-visible:border-danger/40 focus-visible:ring-danger/20",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-3",
        xs: "h-7 gap-1 rounded-ui-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-ui-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 rounded-ui-md px-4",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-ui-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-ui-sm",
        "icon-lg": "size-11 rounded-ui-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
