import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // transition-all animates every property (including layout ones) whenever
  // any of them changes; scoped to exactly what Button actually animates
  // (bg/border/color for hover & variants, box-shadow for the focus ring,
  // transform for press feedback, opacity for disabled) so nothing off-GPU
  // gets swept in.
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        brand:
          "border-2 border-flame-500 bg-button-brand-primary-rest text-text-inverse text-shadow-[0px_1px_0px_rgba(0,0,0,0.3)] hover:bg-button-brand-primary-hover",
        "brand-secondary":
          "border-2 border-flame-200 bg-button-brand-secondary-rest text-flame-900 text-shadow-[0px_1px_0px_rgba(0,0,0,0.15)] hover:bg-button-brand-secondary-hover",
        success:
          "border-2 border-green-800 bg-button-success-primary-rest text-text-inverse text-shadow-[0px_1px_0px_rgba(0,0,0,0.3)] hover:bg-button-success-primary-hover",
        danger:
          "border-2 border-red-800 bg-button-danger-primary-rest text-text-inverse text-shadow-[0px_1px_0px_rgba(0,0,0,0.3)] hover:bg-button-danger-primary-hover",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Overrides base's always-on rounded-lg/text-sm/font-medium with our
        // token scale via bracket syntax (see pill-input.tsx for why:
        // tailwind-merge doesn't recognize custom-named theme utilities as
        // belonging to the same group as Tailwind's built-in ones).
        xl: "h-[var(--pad-3xl)] gap-[var(--dist-md)] rounded-[var(--rad-lg)] px-[var(--pad-lg)] text-[length:var(--text-btn-lg)] leading-[var(--text-btn-lg--line-height)] tracking-[var(--text-btn-lg--letter-spacing)] font-bold [&_svg:not([class*='size-'])]:size-5",
        // Figma "TextField"-sibling "Buttton" component (node 46:512) basic/sm.
        sm: "h-[var(--pad-2xl)] gap-[var(--dist-md)] rounded-[var(--rad-xmd)] p-[var(--pad-md)] text-[length:var(--text-btn-lg)] leading-[var(--text-btn-lg--line-height)] tracking-[var(--text-btn-lg--letter-spacing)] font-bold [&_svg:not([class*='size-'])]:size-5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        // Figma "Buttton" (node 46:512) kind=icon, size=sm/md.
        "icon-sm":
          "w-[var(--pad-3xl)] h-[var(--pad-2xl)] rounded-[var(--rad-xmd)] [&_svg:not([class*='size-'])]:size-5",
        "icon-md":
          "w-[var(--pad-4xl)] h-[var(--pad-3xl)] rounded-[var(--rad-lg)] [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-9",
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
