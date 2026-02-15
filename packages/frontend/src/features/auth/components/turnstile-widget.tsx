import * as React from "react";
import { cn } from "@/lib/utils";

const TURNSTILE_SCRIPT_ID = "cf-turnstile-api-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "error-callback"?: (errorCode: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  "refresh-expired"?: "auto" | "manual" | "never";
};

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: TurnstileRenderOptions
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  action: string;
  className?: string;
  onTokenChange: (token: string | null) => void;
  siteKey: string;
};

let turnstileScriptPromise: Promise<void> | null = null;

const getTurnstileApi = () => (window as TurnstileWindow).turnstile;

const ensureTurnstileScript = (): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser context."));
  }

  if (getTurnstileApi()) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      if (getTurnstileApi()) {
        resolve(void 0);
        return;
      }
      reject(new Error("Turnstile script loaded, but API is unavailable."));
    };
    const onError = () => {
      reject(new Error("Failed to load Turnstile script."));
    };

    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        onLoad();
        return;
      }

      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          onLoad();
        },
        { once: true }
      );
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        onLoad();
      },
      { once: true }
    );
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
};

export const TurnstileWidget = React.forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ action, className, onTokenChange, siteKey }, ref) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenChangeRef = React.useRef(onTokenChange);
  const [error, setError] = React.useState<string | null>(null);
  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  React.useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  const reset = React.useCallback(() => {
    const api = getTurnstileApi();
    const widgetId = widgetIdRef.current;
    if (api && widgetId) {
      api.reset(widgetId);
    }
    onTokenChangeRef.current(null);
    setError(null);
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      reset,
    }),
    [reset]
  );

  React.useEffect(() => {
    let isCancelled = false;
    onTokenChangeRef.current(null);
    setError(null);

    const removeWidget = () => {
      const api = getTurnstileApi();
      const widgetId = widgetIdRef.current;
      if (api && widgetId) {
        api.remove(widgetId);
      }
      widgetIdRef.current = null;
    };

    const renderWidget = () => {
      if (isCancelled) return;
      const api = getTurnstileApi();
      const container = containerRef.current;
      if (!api || !container || widgetIdRef.current) return;

      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        action,
        size: "flexible",
        theme: isDarkMode ? "dark" : "light",
        "refresh-expired": "auto",
        callback: token => {
          setError(null);
          onTokenChangeRef.current(token);
        },
        "expired-callback": () => {
          onTokenChangeRef.current(null);
        },
        "timeout-callback": () => {
          setError("Captcha timed out. Try again.");
          onTokenChangeRef.current(null);
        },
        "error-callback": () => {
          setError("Captcha failed to load. Refresh and try again.");
          onTokenChangeRef.current(null);
        },
      });
    };

    void ensureTurnstileScript()
      .then(renderWidget)
      .catch(() => {
        if (isCancelled) return;
        setError("Captcha failed to load. Refresh and try again.");
      });

    return () => {
      isCancelled = true;
      removeWidget();
      onTokenChangeRef.current(null);
    };
  }, [action, isDarkMode, siteKey]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="border border-input bg-transparent dark:bg-input/30 rounded-lg overflow-hidden relative isolate h-[65px] w-full flex items-start justify-center">
        <div
          className="min-h-[65px] w-full relative z-0 scale-101 -mt-px"
          ref={containerRef}
          role="group"
          aria-label="Captcha challenge"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
});
