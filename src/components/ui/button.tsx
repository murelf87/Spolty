import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-spot-gradient font-bold text-foreground shadow-glow hover:brightness-110",
        primary: "bg-spot-gradient font-bold text-foreground shadow-glow hover:brightness-110",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "border border-border bg-background text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        icon: "h-10 w-10 rounded-full border border-border bg-secondary text-foreground hover:border-primary hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: { default: "h-12 px-6", sm: "h-9 px-4", lg: "h-12 px-7", icon: "h-10 w-10 p-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
