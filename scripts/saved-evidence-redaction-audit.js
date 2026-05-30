const fs = require("fs");
const path = require("path");

const rootDir = process.env.FANPASS_EVIDENCE_REDACTION_ROOT
  ? path.resolve(process.env.FANPASS_EVIDENCE_REDACTION_ROOT)
  : path.resolve(__dirname, "..");
const evidenceDir = process.env.FANPASS_EVIDENCE_REDACTION_DIR
  ? path.resolve(process.env.FANPASS_EVIDENCE_REDACTION_DIR)
  : path.join(rootDir, "outputs");

const forbiddenPatterns = [
  {
    label: "Stripe secret key",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/,
  },
  {
    label: "Stripe publishable key",
    pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{8,}/,
  },
  {
    label: "Stripe webhook secret",
    pattern: /\bwhsec_[A-Za-z0-9]{8,}/,
  },
  {
    label: "Stripe client secret",
    pattern: /\bpi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+/,
  },
  {
    label: "bearer token",
    pattern: /Authorization:\s*Bearer\s+(?!<)[A-Za-z0-9._-]{12,}/i,
  },
  {
    label: "basic auth header",
    pattern: /Authorization:\s*Basic\s+(?!<)[A-Za-z0-9+/=]{12,}/i,
  },
  {
    label: "sensitive cookie header",
    pattern:
      /\b(?:Cookie|Set-Cookie):[^\n]*(?:session|jwt|token|auth|csrf)[^=\n]*=(?!<)[^;\s\n]{8,}/i,
  },
  {
    label: "secret-bearing HTTP header",
    pattern:
      /\b(?:X-API-Key|X-Auth-Token|X-Access-Token|X-Session-Token|X-CSRF-Token|Stripe-Signature|Privy-Access-Token|Privy-Authorization|Api-Key)\s*:\s*(?!<)[^\n]{8,}/i,
  },
  {
    label: "generic token or API key assignment",
    pattern:
      /\b(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY)\s*=\s*(?!<|Bearer\s+<|Basic\s+<)[^\s"']{8,}/i,
  },
  {
    label: "quoted secret assignment",
    pattern:
      /\b(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY|PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN|PRIVY_VERIFICATION_KEY|PROVIDER_SECRET|PROVIDER_API_KEY|ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY|QR_SIGNING_SECRET|FANPASS_QR_SIGNING_SECRET|SESSION_SIGNING_SECRET|SESSION_SECRET|CLIENT_SECRET|WEBHOOK_SECRET|AUTH_SECRET|JWT_SECRET|COOKIE_SECRET|ENCRYPTION_KEY|SIGNING_SECRET|OIDC_CLIENT_SECRET|PAYMENTS_WEBHOOK_SECRET)\s*=\s*(?:"|')(?!(?:<|Bearer\s+<|Basic\s+<))[^"'\n]{8,}(?:"|')/i,
  },
  {
    label: "quoted prefixed app secret assignment",
    pattern:
      /\b[A-Z0-9_]*(?:SESSION_SIGNING_SECRET|SESSION_SECRET|CLIENT_SECRET|WEBHOOK_SECRET|AUTH_SECRET|JWT_SECRET|COOKIE_SECRET|ENCRYPTION_KEY|SIGNING_SECRET)\s*=\s*(?:"|')(?!(?:<|Bearer\s+<|Basic\s+<))[^"'\n]{8,}(?:"|')/i,
  },
  {
    label: "snake_case secret assignment",
    pattern:
      /\b(?:access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)\s*=\s*(?!(?:"|')?<|(?:"|')?Bearer\s+<|(?:"|')?Basic\s+<)(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?/i,
  },
  {
    label: "npm registry auth token",
    pattern:
      /(?:\b(?:NPM_TOKEN|NODE_AUTH_TOKEN|YARN_NPM_AUTH_TOKEN)\s*=\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?|(?:^|[\s"'])\/\/[^\s"'=]+:_authToken\s*=\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?|\b_authToken\s*=\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?|\bnpmAuthToken\s*:\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^\s"',][^\n"',]{7,}(?:"|')?|"(?:(?:npm|node)AuthToken|npm_auth_token|node_auth_token)"\s*:\s*"(?!<|\$\{|Bearer\s+<|Basic\s+<)[^"]{8,}")/i,
  },
  {
    label: "source-control access token literal",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{20,}_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,})\b/,
  },
  {
    label: "chat or notification webhook URL",
    pattern:
      /\bhttps:\/\/(?:(?:hooks\.slack\.com\/services\/[A-Za-z0-9]{8,}\/[A-Za-z0-9]{8,}\/[A-Za-z0-9]{12,})|(?:(?:discord(?:app)?\.com)\/api\/webhooks\/\d{8,}\/[A-Za-z0-9._-]{20,})|(?:[A-Za-z0-9.-]*webhook\.office\.com\/webhookb2\/[0-9a-f-]{36}@[0-9a-f-]{36}\/IncomingWebhook\/[A-Za-z0-9]+\/[0-9a-f-]{36}))\b/i,
  },
  {
    label: "CI secret masking command literal",
    pattern:
      /(?:::add-mask::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|::set-secret\s+name=[^:\r\n]+::(?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,}|##vso\[task\.setvariable[^\]\r\n]*issecret=true[^\]\r\n]*\](?!<|\$\{|\*\*\*|redacted\b)[^\r\n]{8,})/i,
  },
  {
    label: "observability service credential assignment",
    pattern:
      /\b(?:SENTRY_AUTH_TOKEN|DATADOG_API_KEY|DD_API_KEY|HONEYCOMB_API_KEY|NEW_RELIC_LICENSE_KEY|NEW_RELIC_API_KEY|LOGTAIL_SOURCE_TOKEN|AXIOM_TOKEN)\s*=\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?/i,
  },
  {
    label: "Apple or App Store automation credential assignment",
    pattern:
      /\b(?:APP_STORE_CONNECT_API_KEY|APP_STORE_CONNECT_API_KEY_BASE64|APP_STORE_CONNECT_PRIVATE_KEY|ASC_API_KEY|ASC_PRIVATE_KEY|FASTLANE_SESSION|MATCH_PASSWORD|MATCH_GIT_BASIC_AUTHORIZATION|P8_PRIVATE_KEY)\s*=\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?/i,
  },
  {
    label: "environment-style secret YAML or colon field",
    pattern:
      /\b(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY|PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN|PRIVY_VERIFICATION_KEY|PROVIDER_SECRET|PROVIDER_API_KEY|ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*:\s*(?!(?:"|')?<|(?:"|')?Bearer\s+<|(?:"|')?Basic\s+<)(?:"|')?[^\s"',][^\n"',]{7,}(?:"|')?/i,
  },
  {
    label: "environment name-value secret YAML field",
    pattern:
      /\b(?:name|key)\s*:\s*(?:"|')?(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY|PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN|PRIVY_VERIFICATION_KEY|PROVIDER_SECRET|PROVIDER_API_KEY|ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY|access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)(?:"|')?[ \t]*(?:\r?\n[ \t-]+[A-Za-z0-9_-]+\s*:\s*[^\n]*){0,3}\r?\n[ \t-]*value\s*:\s*(?!(?:"|')?<|(?:"|')?Bearer\s+<|(?:"|')?Basic\s+<)(?:"|')?[^\s"',][^\n"',]{7,}(?:"|')?/i,
  },
  {
    label: "environment name-value secret JSON field",
    pattern:
      /(?:"(?:name|key)"\s*:\s*"(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY|PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN|PRIVY_VERIFICATION_KEY|PROVIDER_SECRET|PROVIDER_API_KEY|ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY|access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)"[^{}]{0,240}"value"\s*:\s*"(?!<|Bearer\s+<|Basic\s+<)[^"]{8,}"|"value"\s*:\s*"(?!<|Bearer\s+<|Basic\s+<)[^"]{8,}"[^{}]{0,240}"(?:name|key)"\s*:\s*"(?:ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|SESSION_TOKEN|AUTH_TOKEN|BEARER_TOKEN|CSRF_TOKEN|API_KEY|PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN|PRIVY_VERIFICATION_KEY|PROVIDER_SECRET|PROVIDER_API_KEY|ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY|access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)")/i,
  },
  {
    label: "generic token or cookie field",
    pattern:
      /"(?:accessToken|refreshToken|idToken|sessionToken|authToken|bearerToken|jwt|authorization|cookie|setCookie|csrfToken)"\s*:\s*"(?!<|Bearer\s+<|Basic\s+<)[^"]{8,}"/i,
  },
  {
    label: "secret-bearing snake_case JSON field",
    pattern:
      /"(?:access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)"\s*:\s*"(?!<|Bearer\s+<|Basic\s+<)[^"]{8,}"/i,
  },
  {
    label: "secret-bearing YAML or colon field",
    pattern:
      /\b(?:access_token|refresh_token|id_token|session_token|auth_token|bearer_token|csrf_token|client_secret|api_key|provider_api_key|chain_api_key|rpc_api_key|invite_token|staff_invite_token|webhook_secret|signing_secret)\s*:\s*(?!(?:"|')?<|(?:"|')?Bearer\s+<|(?:"|')?Basic\s+<)(?:"|')?[^\s"',][^\n"',]{7,}(?:"|')?/i,
  },
  {
    label: "secret-bearing HTTP header field",
    pattern:
      /"(?:Authorization|Cookie|Set-Cookie|X-API-Key|X-Auth-Token|X-Access-Token|X-Session-Token|X-CSRF-Token|Stripe-Signature|Privy-Access-Token|Privy-Authorization|Api-Key)"\s*:\s*"(?!<|Bearer\s+<|Basic\s+<)[^"]{8,}"/i,
  },
  {
    label: "deployment or cloud credential assignment",
    pattern:
      /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)\s*=\s*(?!<)[^\s"']{8,}/i,
  },
  {
    label: "lowercase deployment or cloud credential assignment",
    pattern:
      /\b(?:aws_access_key_id|aws_secret_access_key|aws_session_token|google_application_credentials_json|google_credentials|gcp_service_account_key|vercel_token|github_token|gh_token|netlify_auth_token|cloudflare_api_token|cf_api_token|cloudflare_api_key|cf_api_key)\s*(?::|=)\s*(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^"'\s][^"'\n]{7,}(?:"|')?/i,
  },
  {
    label: "IaC sensitive output literal",
    pattern:
      /(?:(?:"(?:sensitive|secret|secure)"\s*:\s*true)[^{}]{0,500}"(?:value|plaintext|plainText|secretValue)"\s*:\s*"(?!<|\$\{|redacted\b)[^"\n]{8,}"|"(?:value|plaintext|plainText|secretValue)"\s*:\s*"(?!<|\$\{|redacted\b)[^"\n]{8,}"[^{}]{0,500}"(?:sensitive|secret|secure)"\s*:\s*true)/i,
  },
  {
    label: "deployment or cloud credential field",
    pattern:
      /"(?:awsAccessKeyId|awsSecretAccessKey|awsSessionToken|googleApplicationCredentialsJson|googleCredentials|gcpServiceAccountKey|vercelToken|githubToken|ghToken|netlifyAuthToken|cloudflareApiToken|cfApiToken|cloudflareApiKey|cfApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
  },
  {
    label: "deployment or cloud credential environment field",
    pattern:
      /"(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_CREDENTIALS|GCP_SERVICE_ACCOUNT_KEY|VERCEL_TOKEN|GITHUB_TOKEN|GH_TOKEN|NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY|CF_API_KEY)"\s*:\s*"(?!<)[^"]{8,}"/,
  },
  {
    label: "cloud credential literal",
    pattern:
      /\b(?:(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}|AIza[0-9A-Za-z_-]{35})\b/,
  },
  {
    label: "Azure storage credential literal",
    pattern:
      /(?:DefaultEndpointsProtocol=https;AccountName=[A-Za-z0-9-]{3,};AccountKey=(?!<)[A-Za-z0-9+/=]{20,};EndpointSuffix=core\.windows\.net|SharedAccessSignature=(?!<)[A-Za-z0-9%._~+/=-]{20,}|BlobEndpoint=https:\/\/[A-Za-z0-9-]+\.blob\.core\.windows\.net\/;SharedAccessSignature=(?!<)[^\s"']{20,})/i,
  },
  {
    label: "cloud storage signed URL credential parameter",
    pattern:
      /\bhttps:\/\/(?:[A-Za-z0-9.-]+\.s3(?:[.-][A-Za-z0-9-]+)?\.amazonaws\.com|s3(?:[.-][A-Za-z0-9-]+)?\.amazonaws\.com|storage\.googleapis\.com|[A-Za-z0-9.-]+\.storage\.googleapis\.com|[A-Za-z0-9.-]+\.cloudfront\.net)\/[^\s"']*[?&](?:X-Amz-(?:Signature|Credential|Security-Token)|X-Goog-(?:Signature|Credential)|Policy|Key-Pair-Id)=(?!<)[A-Za-z0-9%._~+/=-]{8,}/i,
  },
  {
    label: "encoded deployment private key credential literal",
    pattern:
      /(?:\b(?:SSH_PRIVATE_KEY_BASE64|DEPLOY_KEY_BASE64|DEPLOY_PRIVATE_KEY_BASE64|PRIVATE_KEY_BASE64|SIGNING_KEY_BASE64|TLS_PRIVATE_KEY_BASE64|GOOGLE_APPLICATION_CREDENTIALS_BASE64|GCP_SERVICE_ACCOUNT_KEY_BASE64|SERVICE_ACCOUNT_KEY_BASE64|SERVICE_ACCOUNT_JSON_BASE64)\s*(?::|=)\s*(?!(?:"|')?(?:<|\$\{))(?:"|')?[A-Za-z0-9+/_=-]{40,}(?:"|')?|"(?:(?:ssh|deploy|private|signing|tls)KeyBase64|googleApplicationCredentialsBase64|gcpServiceAccountKeyBase64|serviceAccount(?:Key|Json)Base64)"\s*:\s*"(?!<|\$\{)[A-Za-z0-9+/_=-]{40,}")/i,
  },
  {
    label: "Kubernetes kubeconfig credential literal",
    pattern:
      /(?:\b(?:KUBECONFIG_BASE64|KUBE_CONFIG_DATA|KUBE_CONFIG_BASE64|KUBERNETES_CONFIG_BASE64|KUBECONFIG_DATA)\s*(?::|=)\s*(?!(?:"|')?(?:<|\$\{))(?:"|')?[A-Za-z0-9+/_=-]{40,}(?:"|')?|\b(?:client-key-data|client-certificate-data)\s*:\s*(?!<|\$\{)[A-Za-z0-9+/=]{40,}|"(?:(?:kube|kubernetes)Config(?:Data|Base64)|kubeconfigBase64)"\s*:\s*"(?!<|\$\{)[A-Za-z0-9+/_=-]{40,}")/i,
  },
  {
    label: "Docker or OCI registry credential literal",
    pattern:
      /(?:\bDOCKER_AUTH_CONFIG\s*=\s*(?!<|\$\{)[^\n]*"auths"\s*:\s*\{[\s\S]{0,500}"(?:auth|identitytoken)"\s*:\s*"(?!<|\$\{|Bearer\s+<|Basic\s+<)[A-Za-z0-9+/=._-]{12,}"|"auths"\s*:\s*\{[\s\S]{0,500}"(?:auth|identitytoken)"\s*:\s*"(?!<|\$\{|Bearer\s+<|Basic\s+<)[A-Za-z0-9+/=._-]{12,}"|\bdocker\s+login\b[^\n]*(?:(?:--password(?:\s+|=))|-p\s+)(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^\s"']{8,}(?:"|')?|\b(?:echo|printf)\s+(?!(?:"|')?(?:<|\$\{|Bearer\s+<|Basic\s+<))(?:"|')?[^\s"'|]{8,}(?:"|')?\s*\|\s*docker\s+login\b[^\n]*--password-stdin)/i,
  },
  {
    label: "encoded Docker or OCI registry credential literal",
    pattern:
      /\b(?:\.dockerconfigjson|dockerconfigjson|DOCKER_CONFIG_JSON|DOCKER_AUTH_CONFIG_BASE64|REGISTRY_AUTH_CONFIG_BASE64)\s*(?::|=)\s*(?!(?:"|')?(?:<|\$\{))(?:"|')?[A-Za-z0-9+/=]{40,}(?:"|')?/i,
  },
  {
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  },
  {
    label: "private key block",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  },
  {
    label: "certificate block",
    pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,
  },
  {
    label: "Apple signing material",
    pattern:
      /\b(?:CODE_SIGN_IDENTITY|APPLE_CERTIFICATE|APPLE_DISTRIBUTION_CERTIFICATE|PROVISIONING_PROFILE_BASE64)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "Apple provisioning profile marker",
    pattern:
      /\b(?:PROVISIONING_PROFILE_SPECIFIER|PROVISIONING_PROFILE|APPLE_PROVISIONING_PROFILE)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "Apple device identifier assignment",
    pattern: /\b(?:UDID|DEVICE_IDENTIFIER|DEVICE_UDID)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "raw email address",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    label: "raw wallet address",
    pattern: /\b0x[a-fA-F0-9]{40}\b/,
  },
  {
    label: "QR signing secret assignment",
    pattern:
      /\b(?:QR_SIGNING_SECRET|FANPASS_QR_SIGNING_SECRET)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "app session or client secret assignment",
    pattern:
      /\b[A-Z0-9_]*(?:SESSION_SIGNING_SECRET|SESSION_SECRET|CLIENT_SECRET|WEBHOOK_SECRET|AUTH_SECRET|JWT_SECRET|COOKIE_SECRET|ENCRYPTION_KEY|SIGNING_SECRET)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "app session or client secret field",
    pattern:
      /"(?:sessionSecret|clientSecret|webhookSecret|authSecret|jwtSecret|cookieSecret|encryptionKey|signingSecret|apiSecret|appSecret|verificationKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
  },
  {
    label: "secret-bearing URL query parameter",
    pattern:
      /[?&](?:access_token|id_token|client_secret|api_key|secret|signature|sig|auth_token|session_token|invite_token)=(?!<)[A-Za-z0-9._~%+-]{8,}/i,
  },
  {
    label: "secret-bearing URL fragment parameter",
    pattern:
      /#[^\s"']*(?:access_token|id_token|refresh_token|client_secret|api_key|secret|signature|sig|auth_token|session_token|invite_token|token)=(?!<)[A-Za-z0-9._~%+-]{8,}/i,
  },
  {
    label: "staff invite token field",
    pattern:
      /\b(?:STAFF_INVITE_TOKEN|INVITE_TOKEN)\s*=\s*(?!<)[^\s"']+|"(?:inviteToken|staffInviteToken)"\s*:\s*"(?!<)[^"]{8,}"/i,
  },
  {
    label: "raw QR nonce field",
    pattern: /"(?:nonce|payloadNonce|qrNonce)"\s*:\s*"(?!<)[^"]{8,}"/i,
  },
  {
    label: "raw signed payload field",
    pattern:
      /"(?:signedPayload|rawSignedPayload|qrPayload)"\s*:\s*"(?!<)[^"]{12,}"/i,
  },
  {
    label: "raw FanPass identity field",
    pattern:
      /"(?:userId|staffId|staffUserId|organizerId|organizerUserId|fanId|fanUserId|scannerUserId|privyUserId)"\s*:\s*"(?!<)[^"]{6,}"/i,
  },
  {
    label: "raw FanPass ticket or event identifier field",
    pattern:
      /"(?:ticketId|eventId|gateAssignmentId|checkinId)"\s*:\s*"(?!<)[^"]{6,}"/i,
  },
  {
    label: "database URL",
    pattern: /\bDATABASE_URL\s*=\s*(?!<)[^\s"']+/,
  },
  {
    label: "raw database URL",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s"']+/i,
  },
  {
    label: "credentialed service URL",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/(?!<)[^:\s/@]+:[^@\s/]+@/i,
  },
  {
    label: "Privy verification key assignment",
    pattern: /\bPRIVY_VERIFICATION_KEY\s*=\s*(?!<)[^\s"']+/,
  },
  {
    label: "Privy app secret marker",
    pattern: /\bPRIVY_APP_SECRET\b|\bprivyAppSecret\b|\bapp_secret\b/i,
  },
  {
    label: "provider secret marker",
    pattern: /\b(?:PROVIDER_SECRET|PROVIDER_API_KEY)\s*=\s*(?!<)[^\s"']+/,
  },
  {
    label: "provider API key field",
    pattern:
      /"(?:apiKey|providerApiKey|chainApiKey|rpcApiKey|alchemyApiKey|infuraApiKey|quicknodeApiKey|etherscanApiKey|polygonscanApiKey|bscscanApiKey)"\s*:\s*"(?!<)[^"]{8,}"/i,
  },
  {
    label: "provider RPC URL",
    pattern: /\b[A-Z0-9_]*RPC_URL\s*=\s*(?!<)https?:\/\/[^\s"']+/i,
  },
  {
    label: "raw provider RPC URL",
    pattern: /https?:\/\/[A-Za-z0-9.-]*(?:alchemy|infura|quicknode)[^\s"']+/i,
  },
  {
    label: "chain provider API key assignment",
    pattern:
      /\b(?:ALCHEMY_API_KEY|INFURA_API_KEY|QUICKNODE_API_KEY|ETHERSCAN_API_KEY|POLYGONSCAN_API_KEY|BSCSCAN_API_KEY)\s*=\s*(?!<)[^\s"']+/i,
  },
  {
    label: "provider access token assignment",
    pattern:
      /\b(?:PRIVY_ACCESS_TOKEN|STAGING_ADMIN_ACCESS_TOKEN|FANPASS_STAGING_ADMIN_ACCESS_TOKEN)\s*=\s*(?!<)[^\s"']+/,
  },
];

const files = listFiles(evidenceDir);
const findings = [];

for (const file of files) {
  const contents = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(contents)) {
      findings.push({
        file: normalizePath(path.relative(rootDir, file)),
        marker: rule.label,
      });
    }
  }
}

if (findings.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        evidenceDir: normalizePath(path.relative(rootDir, evidenceDir)),
        findings,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      evidenceDir: normalizePath(path.relative(rootDir, evidenceDir)),
      checkedFiles: files.length,
      forbiddenMarkers: forbiddenPatterns.map((rule) => rule.label),
    },
    null,
    2,
  ),
);

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(absolutePath);
    }
    if (!entry.isFile()) {
      return [];
    }
    return [absolutePath];
  });
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
