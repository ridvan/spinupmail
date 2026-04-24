import * as React from "react";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const getPrefersReducedMotion = () => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

const subscribeToReducedMotion = (onStoreChange: () => void) => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", onStoreChange);
  return () => mediaQueryList.removeEventListener("change", onStoreChange);
};

const usePrefersReducedMotion = () =>
  React.useSyncExternalStore(
    subscribeToReducedMotion,
    getPrefersReducedMotion,
    () => false
  );

export const EmptyEmailSelected = () => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex size-32 items-center justify-center">
        {/* Decorative background blur */}
        <div
          className={cn(
            "absolute inset-0 z-0 rounded-full bg-primary/5 blur-2xl",
            !prefersReducedMotion && "animate-pulse"
          )}
        />

        {/* Animated SVG */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 120 120"
          className="relative z-10 size-full text-primary/80 drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pulsing Background Circles */}
          <circle cx="60" cy="60" r="45" fill="currentColor" opacity="0.03">
            {prefersReducedMotion ? null : (
              <>
                <animate
                  attributeName="r"
                  values="40;48;40"
                  dur="4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.03;0.06;0.03"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
          <circle cx="60" cy="60" r="30" fill="currentColor" opacity="0.06">
            {prefersReducedMotion ? null : (
              <animate
                attributeName="r"
                values="28;34;28"
                dur="4s"
                repeatCount="indefinite"
              />
            )}
          </circle>

          {/* Floating Mail Illustration */}
          <g>
            {prefersReducedMotion ? null : (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 0,-4; 0,0"
                dur="5s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            )}

            {/* Paper sticking out */}
            <g>
              {prefersReducedMotion ? null : (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0; 0,-6; 0,0"
                  dur="5s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                />
              )}
              <rect
                x="45"
                y="42"
                width="30"
                height="24"
                rx="2"
                fill="currentColor"
                opacity="0.3"
              />
              {/* Paper lines */}
              <line
                x1="50"
                y1="48"
                x2="70"
                y2="48"
                stroke="var(--color-background)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
              <line
                x1="50"
                y1="54"
                x2="64"
                y2="54"
                stroke="var(--color-background)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
            </g>

            {/* Back Envelope Flap */}
            <path
              d="M38 52L60 38L82 52L82 72C82 74.2091 80.2091 76 78 76L42 76C39.7909 76 38 74.2091 38 72L38 52Z"
              fill="currentColor"
              opacity="0.15"
            />

            {/* Main Envelope Body */}
            <path
              d="M38 54L60 68L82 54L82 72C82 74.2091 80.2091 76 78 76L42 76C39.7909 76 38 74.2091 38 72L38 54Z"
              fill="currentColor"
              opacity="0.9"
            />

            {/* Front Envelope Flap (Folded Down) */}
            <path
              d="M38 54L60 68L82 54"
              stroke="var(--color-background)"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
              opacity="0.4"
            />

            {/* Edge highlights */}
            <path
              d="M38 76L52 64"
              stroke="var(--color-background)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M82 76L68 64"
              stroke="var(--color-background)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
              opacity="0.3"
            />
          </g>

          {/* Small decorative particles (stars/dots) */}
          <circle cx="30" cy="40" r="1.5" fill="currentColor" opacity="0.4">
            {prefersReducedMotion ? null : (
              <animate
                attributeName="opacity"
                values="0.2;0.6;0.2"
                dur="3s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx="90" cy="50" r="2" fill="currentColor" opacity="0.3">
            {prefersReducedMotion ? null : (
              <animate
                attributeName="opacity"
                values="0.1;0.5;0.1"
                dur="4s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx="80" cy="35" r="1" fill="currentColor" opacity="0.5">
            {prefersReducedMotion ? null : (
              <animate
                attributeName="opacity"
                values="0.3;0.8;0.3"
                dur="2.5s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx="40" cy="85" r="1.5" fill="currentColor" opacity="0.3">
            {prefersReducedMotion ? null : (
              <animate
                attributeName="opacity"
                values="0.1;0.4;0.1"
                dur="3.5s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        </svg>
      </div>

      <div className="flex max-w-[280px] flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          Select an email to view
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose a message from your inbox list to read its contents and view
          its details here.
        </p>
      </div>
    </div>
  );
};
