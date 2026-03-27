import * as React from "react";
import {
  getEmailRendererHostStyles,
  prepareEmailHtmlForRender,
} from "@/features/inbox/utils/email-html";

type EmailHtmlRendererProps = {
  html: string;
  allowRemoteContent?: boolean;
  onRemoteContentBlockedChange?: ((blocked: boolean) => void) | undefined;
};

const getResolvedAppTheme = (document: Document) =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export const EmailHtmlRenderer = ({
  html,
  allowRemoteContent = false,
  onRemoteContentBlockedChange,
}: EmailHtmlRendererProps) => {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const shadowRootRef = React.useRef<ShadowRoot | null>(null);
  const contentRootRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement || shadowRootRef.current) return;

    const shadowRoot = hostElement.attachShadow({ mode: "open" });
    const styleElement = hostElement.ownerDocument.createElement("style");
    styleElement.textContent = getEmailRendererHostStyles();

    const contentRoot = hostElement.ownerDocument.createElement("div");
    contentRoot.setAttribute("data-email-content-root", "true");
    contentRoot.setAttribute(
      "data-spinupmail-theme",
      getResolvedAppTheme(hostElement.ownerDocument)
    );

    shadowRoot.append(styleElement, contentRoot);
    shadowRootRef.current = shadowRoot;
    contentRootRef.current = contentRoot;
  }, []);

  React.useLayoutEffect(() => {
    const hostElement = hostRef.current;
    const contentRoot = contentRootRef.current;
    if (!hostElement || !contentRoot) return;

    const rootElement = hostElement.ownerDocument.documentElement;
    const syncTheme = () => {
      contentRoot.setAttribute(
        "data-spinupmail-theme",
        getResolvedAppTheme(hostElement.ownerDocument)
      );
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(rootElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  React.useLayoutEffect(() => {
    const hostElement = hostRef.current;
    const contentRoot = contentRootRef.current;
    if (!hostElement || !contentRoot) return;

    const { fragment, remoteContentBlocked } = prepareEmailHtmlForRender({
      html,
      allowRemoteContent,
      ownerDocument: hostElement.ownerDocument,
    });

    contentRoot.replaceChildren(fragment);
    onRemoteContentBlockedChange?.(remoteContentBlocked);
  }, [allowRemoteContent, html, onRemoteContentBlockedChange]);

  return (
    <div
      className="h-full w-full"
      data-testid="email-html-renderer"
      ref={hostRef}
    />
  );
};
