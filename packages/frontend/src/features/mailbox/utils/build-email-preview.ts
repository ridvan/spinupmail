type PreviewTheme = "light" | "dark";

export const buildEmailPreview = (
  html: string,
  theme: PreviewTheme = "light"
) => {
  const safeHtml = html.trim();
  const isDark = theme === "dark";
  const textColor = isDark ? "#fbfbfb" : "#252525";
  const backgroundColor = isDark ? "#121212" : "#ffffff";
  const linkColor = textColor;
  const borderColor = isDark ? "#515151" : "#ebebeb";
  const quoteColor = isDark ? "#b4b4b4" : "#8c8c8c";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"
    />
    <style>
      :root { color-scheme: ${theme}; }
      html { background: ${backgroundColor}; }
      body {
        margin: 0;
        padding: 16px;
        font-family: "Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: ${textColor};
        background: ${backgroundColor};
        word-wrap: break-word;
      }
      img { max-width: 100%; height: auto; }
      a {
        color: ${linkColor};
        text-decoration: underline;
        text-decoration-color: ${quoteColor};
      }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap;
      }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid ${borderColor}; padding: 6px 8px; vertical-align: top; }
      blockquote {
        margin: 0;
        padding-left: 12px;
        border-left: 3px solid ${borderColor};
        color: ${quoteColor};
      }
    </style>
  </head>
  <body>${safeHtml}</body>
</html>`;
};
