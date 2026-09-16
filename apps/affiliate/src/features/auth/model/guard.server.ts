import "server-only";

import { redirect } from "next/navigation";

import type { AffiliatePartner } from "@/entities/affiliate-partner";
import { getAffiliatePartner } from "@/shared/actions/affiliate";
import { getAuthSession, type AuthUserDTO } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { isApiError } from "@/shared/lib";

import {
  getAccessFailureDecision,
  getAffiliateAccessDecision,
} from "../lib/access";
import { getSafeRedirectPath } from "../lib/safe-redirect";

export type AffiliateAccess = { partner: AffiliatePartner; user: AuthUserDTO };

export async function getAffiliateAccess(): Promise<
  | { decision: "allow"; access: AffiliateAccess }
  | { decision: "login" | "denied" | "error" }
> {
  try {
    const session = await getAuthSession();

    if (!session.user) {
      return { decision: "login" };
    }

    const partner = await getAffiliatePartner();
    const profileState = partner.status === "active" ? "active" : "suspended";
    const decision = getAffiliateAccessDecision(true, profileState);

    return decision === "allow"
      ? { access: { partner, user: session.user }, decision }
      : { decision };
  } catch (error) {
    return {
      decision: getAccessFailureDecision(
        isApiError(error) ? error.status : undefined,
      ),
    };
  }
}

export async function requireAffiliateAccess(nextPath = "/") {
  const result = await getAffiliateAccess();

  if (result.decision !== "allow") {
    if (result.decision === "login") {
      redirect(
        `${routes.login}?next=${encodeURIComponent(getSafeRedirectPath(nextPath))}`,
      );
    }

    redirect(
      result.decision === "denied" ? routes.accessDenied : routes.unavailable,
    );
  }

  return result.access;
}
