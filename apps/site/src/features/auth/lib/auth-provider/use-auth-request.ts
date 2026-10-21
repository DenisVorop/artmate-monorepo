"use client";
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AuthContext, AuthScopeContext } from "./auth.context";
import type {
  AuthOptions,
  AuthOutcome,
  AuthRouteEntry,
} from "../auth-flow-state";

export type AuthTrigger<Payload> = [Payload] extends [void]
  ? (_payload?: Payload) => Promise<AuthOutcome>
  : (_payload: Payload) => Promise<AuthOutcome>;

export function useAuthRequest<Payload = void>(
  options: AuthOptions<Payload> = {},
  entry?: AuthRouteEntry,
) {
  const coordinator = useContext(AuthContext);
  const config = useContext(AuthScopeContext);
  if (!coordinator) throw new Error("useAuth must be used within withAuth");
  const [owner] = useState(() => Symbol("auth-owner"));
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      coordinator.releaseOwner(owner);
    };
  }, [coordinator, owner]);
  const isPending = useSyncExternalStore(
    coordinator.subscribe,
    () => coordinator.isPending(owner),
    () => false,
  );
  const onAuth = useCallback(
    (payload?: Payload) => {
      if (!mounted.current)
        return Promise.resolve<AuthOutcome>({
          status: "error",
          error: { code: "cancelled" },
        });
      return coordinator.request(
        owner,
        config,
        {
          onSuccess: (user, value) => {
            if (mounted.current) return options.onSuccess?.(user, value);
          },
          onError: (error, value) => {
            if (mounted.current) return options.onError?.(error, value);
          },
        },
        payload as Payload,
        entry,
      );
    },
    [coordinator, owner, config, options, entry],
  );
  return { onAuth: onAuth as AuthTrigger<Payload>, isPending };
}
