import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[55vh] flex-col items-start justify-center gap-4">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        404
      </p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you requested does not exist or may have moved.
      </p>
      <Button render={<Link to="/" />}>Back to overview</Button>
    </div>
  );
};
