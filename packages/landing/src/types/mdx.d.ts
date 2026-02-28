declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXComponent: ComponentType<{
    components?: Record<string, ComponentType>;
  }>;

  export default MDXComponent;
}
