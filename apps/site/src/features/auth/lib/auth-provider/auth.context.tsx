"use client";
import { createContext } from "react";
import type { AuthFlowCoordinator } from "../auth-flow-coordinator";
import type { AuthFlowConfig } from "../auth-flow-state";

export const AuthContext = createContext<AuthFlowCoordinator | undefined>(undefined);
export const AuthScopeContext = createContext<AuthFlowConfig>({});
