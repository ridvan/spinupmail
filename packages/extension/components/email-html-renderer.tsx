import * as React from "react";
import {
  getEmailRendererHostStyles,
  prepareEmailHtmlForRender,
} from "@/lib/email-html";

type EmailHtmlRendererProps = {
  allowRemoteContent?: boolean;
  html: string;
  onRemoteContentBlockedChange?: (blocked: boolean) => void;
};

const getResolvedTheme = (document: Document) =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function EmailHtmlRenderer({
  allowRemoteContent = false,
  html,
  onRemoteContentBlockedChange,
}: EmailHtmlRendererProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const shadowRootRef = React.useRef<ShadowRoot | null>(null);
  const contentRootRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || shadowRootRef.current) return;

    const shadowRoot = host.attachShadow({ mode: "open" });
    const style = host.ownerDocument.createElement("style");
    style.textContent = getEmailRendererHostStyles();

    const contentRoot = host.ownerDocument.createElement("div");
    contentRoot.setAttribute("data-email-content-root", "true");
    contentRoot.setAttribute(
      "data-theme",
      getResolvedTheme(host.ownerDocument)
    );

    shadowRoot.append(style, contentRoot);
    shadowRootRef.current = shadowRoot;
    contentRootRef.current = contentRoot;
  }, []);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    const contentRoot = contentRootRef.current;
    if (!host || !contentRoot) return;

    const root = host.ownerDocument.documentElement;
    const syncTheme = () => {
      contentRoot.setAttribute(
        "data-theme",
        getResolvedTheme(host.ownerDocument)
      );
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    const contentRoot = contentRootRef.current;
    if (!host || !contentRoot) return;

    const { fragment, remoteContentBlocked } = prepareEmailHtmlForRender({
      allowRemoteContent,
      html,
      ownerDocument: host.ownerDocument,
    });

    contentRoot.replaceChildren(fragment);
    onRemoteContentBlockedChange?.(remoteContentBlocked);
  }, [allowRemoteContent, html, onRemoteContentBlockedChange]);

  return <div ref={hostRef} className="h-full w-full min-w-0 max-w-full" />;
}
