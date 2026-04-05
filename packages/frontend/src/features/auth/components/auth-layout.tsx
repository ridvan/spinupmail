import type { ComponentProps, ReactNode } from "react";
import { AppLogo } from "@/components/app-logo";
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

type AuthPageShellProps = ComponentProps<"div"> & {
  children: ReactNode;
};

export function AuthPageShell({
  children,
  className,
  ...props
}: AuthPageShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

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
          <AppLogo
            className="mx-auto rounded-xl bg-muted/10 pl-1 pr-2"
            textClassName="text-[15px]"
          />
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
            <FieldDescription className="text-center">
              {footer}
            </FieldDescription>
          ) : null}
        </CardContent>
      </Card>
      {legal ? (
        <FieldDescription className="px-6 text-center">
          {legal}
        </FieldDescription>
      ) : null}
    </div>
  );
}
