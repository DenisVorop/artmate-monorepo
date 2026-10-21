"use client";
import { useContext, type ComponentType } from "react";
import type { AuthFlowConfig } from "../auth-flow-state";
import { AuthContext, AuthScopeContext } from "./auth.context";
import { AuthProvider } from "./auth-provider";

export function withAuth<Props extends object>(
  Component: ComponentType<Props>,
  options?: AuthFlowConfig | ((_props: Props) => AuthFlowConfig),
) {
  function WithAuth(props: Props) {
    const existing = useContext(AuthContext);
    const parent = useContext(AuthScopeContext);
    const config = { ...parent, ...(typeof options === "function" ? options(props) : options) };
    const content = (
      <AuthScopeContext.Provider value={config}>
        <Component {...props} />
      </AuthScopeContext.Provider>
    );
    return existing ? content : <AuthProvider>{content}</AuthProvider>;
  }
  WithAuth.displayName = `withAuth(${Component.displayName ?? Component.name ?? "Component"})`;
  return WithAuth;
}
