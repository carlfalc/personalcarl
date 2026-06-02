// Server-only. Never import from client code.
function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set.");
  return key;
}

export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  connectorClientId: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
  responseMode?: "redirect" | "web_message";
  webMessageTargetOrigin?: string;
}

export async function authorizeAppUserOAuth(params: AppUserOAuthAuthorizeParams) {
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      connector_client_id: params.connectorClientId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
      response_mode: params.responseMode,
      web_message_target_origin: params.webMessageTargetOrigin,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth start failed (${res.status}): ${text || res.statusText}`);
  const body = JSON.parse(text) as { authorization_url?: string; session_id?: string };
  if (!body.authorization_url) throw new Error("Missing authorization_url");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export async function callAsAppUser(opts: {
  gatewayBaseUrl: string;
  connectionId: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}): Promise<Response> {
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const headers = new Headers(opts.init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-App-User-Connection-Id", opts.connectionId);
  return fetch(`${opts.gatewayBaseUrl}/${opts.connectorId}${path}`, { ...opts.init, headers });
}
