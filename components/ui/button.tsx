import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-normal text-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
          {
            "bg-primary text-white shadow-md hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/20":
              variant === "default",
            "bg-red-600 text-white shadow-xs hover:bg-red-500": variant === "destructive",
            "border border-border bg-card hover:bg-secondary text-foreground":
              variant === "outline",
            "bg-secondary text-foreground hover:bg-secondary/80":
              variant === "secondary",
            "hover:bg-secondary hover:text-foreground text-foreground":
              variant === "ghost",
            "text-primary underline-offset-4 hover:underline dark:text-primary":
              variant === "link",
          },
          {
            "h-11 px-5 py-2.5": size === "default",
            "h-10 rounded-lg px-4 text-xs": size === "sm",
            "h-12 rounded-xl px-10 text-base": size === "lg",
            "h-11 w-11": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
