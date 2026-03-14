import type { DataRouteMatch, UIMatch } from "react-router";

export type RouteHandle = {
  title?: string;
  managesDocumentTitle?: boolean;
};

type MatchWithHandle = Pick<UIMatch, "handle"> | Pick<DataRouteMatch, "route">;

const getHandle = (match: MatchWithHandle): RouteHandle | undefined => {
  if ("route" in match) {
    return match.route.handle as RouteHandle | undefined;
  }

  return match.handle as RouteHandle | undefined;
};

export const resolveRouteTitle = (matches: MatchWithHandle[]) => {
  for (const match of [...matches].reverse()) {
    const handle = getHandle(match);
    if (handle?.title) {
      return handle.title;
    }
  }

  return "Workspace";
};

export const matchesManageDocumentTitle = (matches: MatchWithHandle[]) =>
  matches.some(match => getHandle(match)?.managesDocumentTitle);

export const resolveDocumentTitle = (
  matches: MatchWithHandle[],
  appName: string
) => {
  for (const match of [...matches].reverse()) {
    const handle = getHandle(match);
    if (handle?.title) {
      return `${handle.title} | ${appName}`;
    }
  }

  return appName;
};
