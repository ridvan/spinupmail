import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) + 2px)",
        } as React.CSSProperties
      }
    />
  );
}
