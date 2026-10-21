/** Versioned HTTP metadata snapshot, captured on the server before dispatching
 * a domain command. Preserve available metadata without truncating User-Agent.
 * Headers, URL and query must be sanitized: never retain credentials, cookies,
 * OTP, CSRF tokens or provider/unsubscribe tokens. Request bodies are represented
 * by the domain's typed payload, not copied into this metadata snapshot.
 */
export interface RequestEvidenceV1 {
  /** Available site request metadata, authenticated by its signed proxy envelope.
   * The outer object retains the actual API connection and request headers.
   */
  readonly upstream?: UpstreamRequestEvidenceV1;
  readonly version: 1;
  readonly capturedAt: string;
  readonly source: "direct_request" | "trusted_site_proxy";
  readonly http: {
    readonly method: string;
    readonly url: string;
    readonly version: string;
  };
  /** Lowercase header names; preserve all values, with credentials redacted. */
  readonly headers: Readonly<Record<string, readonly string[]>>;
  readonly query: Readonly<Record<string, readonly string[]>>;
  /** Actual server-side socket values. Do not replace these with client claims. */
  readonly connection: {
    readonly remoteAddress: string | null;
    readonly remotePort: number | null;
    readonly localAddress: string | null;
    readonly localPort: number | null;
    readonly encrypted: boolean;
  };
  readonly client: {
    readonly ipAddress: string | null;
    readonly forwardedFor: readonly string[];
    readonly forwardedHeadersTrusted: boolean;
  };
}

/** Only metadata actually exposed by Next server actions. Its original HTTP
 * method/URL/version/socket are unavailable through headers(); do not invent
 * them from the target API route. The outer evidence retains the real API HTTP.
 */
export interface UpstreamRequestEvidenceV1 {
  readonly version: 1;
  readonly capturedAt: string;
  readonly source: "next_server_action";
  readonly headers: Readonly<Record<string, readonly string[]>>;
  readonly client: RequestEvidenceV1["client"];
  readonly http: {
    readonly method: null;
    readonly url: null;
    readonly version: null;
  };
  readonly connection: null;
}
