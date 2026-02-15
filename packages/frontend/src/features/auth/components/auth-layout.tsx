import type { ComponentProps, ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type AuthLayoutProps = ComponentProps<"div"> & {
  children: ReactNode;
  footer?: ReactNode;
  legal?: ReactNode;
  subtitle?: ReactNode;
  title?: ReactNode;
};

export function AuthLayout({
  className,
  children,
  footer,
  legal,
  subtitle,
  title,
  ...props
}: AuthLayoutProps) {
  return (
    <div
      className={cn("flex w-full max-w-sm flex-col gap-4", className)}
      {...props}
    >
      <Card className="border-border/70 bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center gap-0 rounded-xl bg-muted/10 pr-2 pl-1">
            <img
              src="/logo-black.png"
              alt="SpinupMail"
              className="size-8 shrink-0 rounded-lg object-contain dark:hidden"
            />
            <img
              src="/logo-transparent.png"
              alt="SpinupMail"
              className="hidden size-8 shrink-0 rounded-lg object-contain dark:block"
            />
            <span className="text-base font-semibold">SpinupMail</span>
          </div>
          {title ? <h1 className="text-xl font-semibold">{title}</h1> : null}
          {subtitle ? (
            <FieldDescription className="text-center text-sm text-muted-foreground">
              {subtitle}
            </FieldDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          {footer ? (
            <FieldDescription className="text-center text-neutral-400">
              {footer}
            </FieldDescription>
          ) : null}
        </CardContent>
      </Card>
      {legal ? (
        <FieldDescription className="px-6 text-center text-neutral-400">
          {legal}
        </FieldDescription>
      ) : null}
    </div>
  );
}
