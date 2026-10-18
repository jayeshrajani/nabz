import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-signal-cyan text-ink-950 hover:bg-signal-cyan/90",
        ghost: "text-fg-muted hover:bg-ink-800 hover:text-fg",
        outline: "border border-line text-fg-muted hover:border-line-strong hover:text-fg",
      },
      size: { sm: "h-8 px-2.5", md: "h-9 px-3.5", icon: "size-8" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
