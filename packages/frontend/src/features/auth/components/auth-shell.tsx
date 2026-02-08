import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  altLabel: string;
  altHref: string;
  altCta: string;
};

export const AuthShell = ({
  title,
  subtitle,
  children,
  altLabel,
  altHref,
  altCta,
}: AuthShellProps) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(165deg,hsl(220_20%_97%)_0%,hsl(220_16%_95%)_42%,hsl(0_0%_100%)_100%)] px-4 py-10 dark:bg-[linear-gradient(165deg,hsl(222_28%_12%)_0%,hsl(223_22%_10%)_42%,hsl(222_47%_8%)_100%)]">
      <div className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-slate-400/20 blur-3xl dark:bg-slate-700/25" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-slate-300/30 blur-3xl dark:bg-slate-800/30" />

      <Card className="relative z-10 w-full max-w-md border-white/45 bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-2">
          <p className="text-xs font-medium tracking-[0.24em] text-muted-foreground uppercase">
            Spinupmail
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          <p className="text-sm text-muted-foreground">
            {altLabel}{" "}
            <Link
              className="font-medium text-primary hover:underline"
              to={altHref}
            >
              {altCta}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
