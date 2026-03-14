import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
};

export const AppLogo = ({
  className,
  imageClassName,
  textClassName,
}: AppLogoProps) => (
  <div className={cn("flex items-center gap-1", className)}>
    <img
      src="/logo-black.png"
      alt={APP_NAME}
      className={cn(
        "size-8 shrink-0 rounded-lg object-contain dark:hidden",
        imageClassName
      )}
    />
    <img
      src="/logo-transparent.png"
      alt={APP_NAME}
      className={cn(
        "hidden size-8 shrink-0 rounded-lg object-contain dark:block",
        imageClassName
      )}
    />
    <span className={cn("font-semibold", textClassName)}>{APP_NAME}</span>
  </div>
);
