import { ServiceUnavailableException } from "@nestjs/common";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { TrustedProxyEvidence } from "../common/trusted-proxy-evidence";

/** Auth requires its configured proxy protocol. Other domains may capture a
 * direct request without coupling withdrawal availability to Auth settings. */
export class FlowRequestEvidence {
  public static from(
    request: EvidenceRequest & { readonly body?: unknown },
  ): RequestEvidenceV1 {
    const secret = process.env.AUTH_FLOW_PROXY_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        "Auth flow proxy is not configured",
      );
    return TrustedProxyEvidence.from(request, secret);
  }
}
