"use client";

import { createContext } from "react";

import type { AuthUser } from "../../model/types";

export const UserContext = createContext<AuthUser | null | undefined>(undefined);
