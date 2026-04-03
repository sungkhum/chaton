// Type declarations for React canary features (ViewTransition, addTransitionType)
// These are not yet in @types/react but are available in react@canary

import "react";

declare module "react" {
  interface ViewTransitionProps {
    children: ReactNode;
    name?: string;
    default?: "auto" | "none" | string;
    enter?: string | Record<string, string>;
    exit?: string | Record<string, string>;
    update?: string | Record<string, string>;
    share?: string | Record<string, string>;
  }

  const ViewTransition: React.FC<ViewTransitionProps>;

  function addTransitionType(type: string): void;
}
