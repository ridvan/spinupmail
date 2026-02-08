import { isRouteErrorResponse, useRouteError } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const RouteErrorPage = () => {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong while loading this route.";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4">
      <Card className="w-full border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle>Route error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
};
