const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const auditScript = path.join(
  rootDir,
  "scripts/saved-evidence-redaction-audit.js",
);

const cases = [
  {
    label: "accepts redacted saved evidence bundle",
    expected: "pass",
    files: {
      "outputs/alpha-walkthrough/manifest.md":
        "local-only evidence with bearer placeholders like Authorization: Bearer <accessToken>",
      "outputs/provider/redacted-env.log":
        "ACCESS_TOKEN=<redacted>\nAPI_KEY=<redacted>",
      "outputs/provider/redacted-snake-case-env.log": [
        "access_token=<redacted>",
        'refresh_token="<redacted>"',
        "chain_api_key='<redacted>'",
        "rpc_api_key=<redacted>",
      ].join("\n"),
      "outputs/ci/redacted-npm-auth.log": [
        "NPM_TOKEN=<redacted>",
        'NODE_AUTH_TOKEN="<redacted>"',
        "//registry.npmjs.org/:_authToken=<redacted>",
        "npmAuthToken: <redacted>",
      ].join("\n"),
      "outputs/ci/redacted-source-control-tokens.log": [
        "github token: <redacted>",
        "github fine grained token: <redacted>",
        "gitlab token: <redacted>",
      ].join("\n"),
      "outputs/ci/redacted-chat-webhooks.log": [
        "slack webhook: <redacted>",
        "discord webhook: <redacted>",
        "teams webhook: <redacted>",
      ].join("\n"),
      "outputs/ci/redacted-secret-mask-commands.log": [
        "::add-mask::<redacted>",
        "::set-secret name=FANPASS_TOKEN::<redacted>",
        "##vso[task.setvariable variable=FANPASS_TOKEN;issecret=true]<redacted>",
      ].join("\n"),
      "outputs/ci/redacted-observability-env.log": [
        "SENTRY_AUTH_TOKEN=<redacted>",
        'DATADOG_API_KEY="<redacted>"',
        "HONEYCOMB_API_KEY='<redacted>'",
        "NEW_RELIC_LICENSE_KEY=<redacted>",
      ].join("\n"),
      "outputs/deployment/redacted-cloud-literals.log": [
        "aws access key id: <redacted>",
        "google api key: <redacted>",
        "azure storage connection string: <redacted>",
        "azure shared access signature: <redacted>",
      ].join("\n"),
      "outputs/deployment/redacted-lowercase-cloud-env.log": [
        "aws_access_key_id = <redacted>",
        "aws_secret_access_key = <redacted>",
        'aws_session_token: "<redacted>"',
        'cloudflare_api_token: "<redacted>"',
        "vercel_token: <redacted>",
        "netlify_auth_token='<redacted>'",
      ].join("\n"),
      "outputs/deployment/redacted-iac-sensitive-outputs.json": JSON.stringify({
        terraform: {
          outputs: {
            db_password: {
              sensitive: true,
              type: "string",
              value: "<redacted>",
            },
          },
        },
        pulumi: {
          resources: [
            {
              outputs: {
                apiToken: {
                  secret: true,
                  value: "<redacted>",
                },
              },
            },
          ],
        },
      }),
      "outputs/deployment/redacted-cloud-signed-urls.log": [
        "aws presigned url: https://fanpass-staging.s3.us-east-1.amazonaws.com/evidence.json?X-Amz-Signature=<redacted>",
        "gcs signed url: https://storage.googleapis.com/fanpass-staging/evidence.json?X-Goog-Signature=<redacted>",
        "cloudfront signed url: https://d111111abcdef8.cloudfront.net/evidence.json?Key-Pair-Id=<redacted>",
      ].join("\n"),
      "outputs/deployment/redacted-encoded-private-keys.log": [
        "SSH_PRIVATE_KEY_BASE64=<redacted>",
        "DEPLOY_KEY_BASE64=<redacted>",
        "GCP_SERVICE_ACCOUNT_KEY_BASE64=<redacted>",
        JSON.stringify({ serviceAccountJsonBase64: "<redacted>" }),
      ].join("\n"),
      "outputs/deployment/redacted-kubeconfig.log": [
        "KUBECONFIG_BASE64=<redacted>",
        "KUBE_CONFIG_DATA=<redacted>",
        "client-key-data: <redacted>",
        "client-certificate-data: <redacted>",
        JSON.stringify({ kubernetesConfigBase64: "<redacted>" }),
      ].join("\n"),
      "outputs/ci/redacted-docker-registry-auth.log": [
        "DOCKER_AUTH_CONFIG=<redacted>",
        ".dockerconfigjson: <redacted>",
        "DOCKER_AUTH_CONFIG_BASE64=<redacted>",
        "docker login ghcr.io --username <redacted> --password <redacted>",
        "docker login registry.example.com --username <redacted> --password-stdin < <redacted-file>",
        "registry auth: <redacted>",
      ].join("\n"),
      "outputs/ios/redacted-app-store-automation-env.log": [
        "APP_STORE_CONNECT_API_KEY=<redacted>",
        'APP_STORE_CONNECT_PRIVATE_KEY="<redacted>"',
        "FASTLANE_SESSION='<redacted>'",
        "MATCH_PASSWORD=<redacted>",
      ].join("\n"),
      "outputs/provider/redacted-quoted-env.log": [
        'ACCESS_TOKEN="<redacted>"',
        "API_KEY='<redacted>'",
        'VERCEL_TOKEN="<redacted>"',
        "AWS_SECRET_ACCESS_KEY='<redacted>'",
        'FANPASS_SESSION_SECRET="<redacted>"',
        "NEXTAUTH_SECRET='<redacted>'",
      ].join("\n"),
      "outputs/provider/redacted-provider-export.yml": [
        "access_token: <redacted>",
        'refresh_token: "<redacted>"',
        "client_secret: <redacted>",
        "api_key: <redacted>",
      ].join("\n"),
      "outputs/provider/redacted-env-map.yml": [
        "ACCESS_TOKEN: <redacted>",
        'API_KEY: "<redacted>"',
        "VERCEL_TOKEN: <redacted>",
        "AWS_SECRET_ACCESS_KEY: <redacted>",
      ].join("\n"),
      "outputs/provider/redacted-env-list.yml": [
        "- name: ACCESS_TOKEN",
        "  value: <redacted>",
        "- key: api_key",
        '  value: "<redacted>"',
      ].join("\n"),
      "outputs/provider/redacted-env-list.json": JSON.stringify([
        { name: "ACCESS_TOKEN", value: "<redacted>" },
        { key: "api_key", value: "<redacted>" },
      ]),
      "outputs/privy/redirect-url.txt":
        "https://console.fanpass.example/callback#access_token=<redacted>&id_token=<redacted>",
      "outputs/privy/redacted-token-fields.json": JSON.stringify({
        access_token: "<redacted>",
        refresh_token: "<redacted>",
        id_token: "<redacted>",
        client_secret: "<redacted>",
        api_key: "<redacted>",
      }),
      "outputs/staging-runtime/evidence.json": JSON.stringify({
        ok: true,
        headers: {
          Authorization: "Bearer <accessToken>",
          "Set-Cookie": "<redacted>",
        },
        adminSideEffectHealth: "admin side-effect outbox health ok",
        redaction: { tokensRedacted: true },
      }),
    },
  },
  {
    label: "ignores Xcode build packs outside the text evidence boundary",
    expected: "pass",
    files: {
      "outputs/ios-sim-build/FanPass/SourcePackages/dependency.pack":
        "sk_test_fixture_should_not_be_scanned",
      "outputs/ios/evidence.json": JSON.stringify({
        providerSecretAvailable: false,
        redacted: true,
      }),
    },
  },
  {
    label: "rejects Stripe secret key",
    expected: "fail",
    files: {
      "outputs/stripe/evidence.log":
        "STRIPE_SECRET_KEY=sk_test_fixturesecret1234",
    },
  },
  {
    label: "rejects Stripe publishable key",
    expected: "fail",
    files: {
      "outputs/stripe/evidence.log":
        "STRIPE_PUBLISHABLE_KEY=pk_test_fixturepublishable1234",
    },
  },
  {
    label: "rejects Stripe webhook secret",
    expected: "fail",
    files: {
      "outputs/stripe/evidence.log": "webhook=whsec_fixturesecret1234",
    },
  },
  {
    label: "rejects Stripe client secret",
    expected: "fail",
    files: {
      "outputs/stripe/evidence.log":
        "client_secret=pi_fixture_secret_fixture1234",
    },
  },
  {
    label: "rejects bearer token",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log":
        "Authorization: Bearer real-looking-token-value",
    },
  },
  {
    label: "rejects Basic auth and sensitive cookie headers",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log": [
        "Authorization: Basic Zml4dHVyZTpwYXNzd29yZA==",
        "Set-Cookie: fanpass_console_session=fixture-session-cookie; HttpOnly; Secure",
        "Cookie: csrfToken=fixture-csrf-token",
      ].join("\n"),
    },
  },
  {
    label: "rejects secret-bearing HTTP headers",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log": [
        "X-API-Key: fixture-provider-api-key",
        "X-CSRF-Token: fixture-csrf-token",
        "Stripe-Signature: t=1234567890,v1=fixturewebhooksignature",
      ].join("\n"),
    },
  },
  {
    label: "rejects generic token and API key assignments",
    expected: "fail",
    files: {
      "outputs/provider/env.log": [
        "ACCESS_TOKEN=fixture-access-token",
        "REFRESH_TOKEN=fixture-refresh-token",
        "ID_TOKEN=fixture-id-token",
        "API_KEY=fixture-provider-api-key",
      ].join("\n"),
    },
  },
  {
    label: "rejects quoted secret assignments",
    expected: "fail",
    files: {
      "outputs/provider/quoted-env.log": [
        'ACCESS_TOKEN="fixture-access-token"',
        "API_KEY='fixture-provider-api-key'",
        'PROVIDER_API_KEY="fixture-provider-api-key"',
        "AWS_SECRET_ACCESS_KEY='fixture-aws-secret-key'",
        'VERCEL_TOKEN="fixture-vercel-deploy-token"',
        'SESSION_SIGNING_SECRET="fixture-session-secret"',
        "OIDC_CLIENT_SECRET='fixture-client-secret'",
        'STAGING_ADMIN_ACCESS_TOKEN="fixture-admin-token"',
      ].join("\n"),
    },
  },
  {
    label: "rejects quoted prefixed app secret assignments",
    expected: "fail",
    files: {
      "outputs/provider/quoted-prefixed-app-secrets.log": [
        'FANPASS_SESSION_SIGNING_SECRET="fixture-session-secret"',
        "FANPASS_CONSOLE_CLIENT_SECRET='fixture-client-secret'",
        'NEXTAUTH_SECRET="fixture-nextauth-secret"',
        "FANPASS_COOKIE_SECRET='fixture-cookie-secret'",
        'FANPASS_ENCRYPTION_KEY="fixture-encryption-key"',
        "APPLE_PASS_SIGNING_SECRET='fixture-signing-secret'",
      ].join("\n"),
    },
  },
  {
    label: "rejects snake_case secret assignments",
    expected: "fail",
    files: {
      "outputs/provider/snake-case-env.log": [
        "access_token=fixture-access-token",
        'refresh_token="fixture-refresh-token"',
        "id_token='fixture-id-token'",
        "chain_api_key=fixture-chain-api-key",
        'rpc_api_key="fixture-rpc-api-key"',
        "client_secret=fixture-client-secret",
        "webhook_secret=fixture-webhook-secret",
        "signing_secret='fixture-signing-secret'",
      ].join("\n"),
    },
  },
  {
    label: "rejects npm registry auth tokens",
    expected: "fail",
    files: {
      "outputs/ci/npm-auth.log": [
        "NPM_TOKEN=fixture-npm-registry-token",
        'NODE_AUTH_TOKEN="fixture-node-auth-token"',
        "YARN_NPM_AUTH_TOKEN='fixture-yarn-auth-token'",
        "//registry.npmjs.org/:_authToken=fixture-npmrc-auth-token",
        "_authToken=fixture-short-npmrc-token",
        "npmAuthToken: fixture-yarnrc-auth-token",
        JSON.stringify({ npmAuthToken: "fixture-json-npm-token" }),
      ].join("\n"),
    },
  },
  {
    label: "rejects source-control access token literals",
    expected: "fail",
    files: {
      "outputs/ci/source-control-tokens.log": [
        "GitHub token ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "GitHub app token ghs_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "GitHub fine grained token github_pat_cccccccccccccccccccccc_dddddddddddddddddddddddddddddddddddd",
        "GitLab token glpat-eeeeeeeeeeeeeeeeeeee",
      ].join("\n"),
    },
  },
  {
    label: "rejects chat and notification webhook URLs",
    expected: "fail",
    files: {
      "outputs/ci/chat-webhooks.log": [
        "Slack webhook https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
        "Discord webhook https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEF",
        "Teams webhook https://tenant.webhook.office.com/webhookb2/11111111-1111-1111-1111-111111111111@22222222-2222-2222-2222-222222222222/IncomingWebhook/abcdefghijklmnopqrstuvwxyz/33333333-3333-3333-3333-333333333333",
      ].join("\n"),
    },
  },
  {
    label: "rejects CI secret masking command literals",
    expected: "fail",
    files: {
      "outputs/ci/secret-mask-commands.log": [
        "::add-mask::fixture-github-mask-secret",
        "::set-secret name=FANPASS_TOKEN::fixture-github-set-secret",
        "##vso[task.setvariable variable=FANPASS_TOKEN;issecret=true]fixture-azure-pipelines-secret",
      ].join("\n"),
    },
  },
  {
    label: "rejects observability service credential assignments",
    expected: "fail",
    files: {
      "outputs/ci/observability-env.log": [
        "SENTRY_AUTH_TOKEN=fixture-sentry-auth-token",
        'DATADOG_API_KEY="fixture-datadog-api-key"',
        "HONEYCOMB_API_KEY='fixture-honeycomb-api-key'",
        "NEW_RELIC_LICENSE_KEY=fixture-new-relic-license-key",
        "LOGTAIL_SOURCE_TOKEN=fixture-logtail-source-token",
      ].join("\n"),
    },
  },
  {
    label: "rejects Apple and App Store automation credential assignments",
    expected: "fail",
    files: {
      "outputs/ios/app-store-automation-env.log": [
        "APP_STORE_CONNECT_API_KEY=fixture-app-store-connect-key",
        'APP_STORE_CONNECT_PRIVATE_KEY="fixture-app-store-private-key"',
        "ASC_API_KEY='fixture-asc-api-key'",
        "FASTLANE_SESSION=fixture-fastlane-session",
        "MATCH_PASSWORD=fixture-match-password",
        "MATCH_GIT_BASIC_AUTHORIZATION=fixture-match-basic-auth",
      ].join("\n"),
    },
  },
  {
    label: "rejects environment-style secret YAML and colon fields",
    expected: "fail",
    files: {
      "outputs/provider/env-map.yml": [
        "ACCESS_TOKEN: fixture-access-token",
        "REFRESH_TOKEN: fixture-refresh-token",
        "ID_TOKEN: fixture-id-token",
        "API_KEY: fixture-provider-api-key",
        "PRIVY_ACCESS_TOKEN: fixture-privy-access-token",
        "PROVIDER_API_KEY: fixture-provider-api-key",
        "AWS_SECRET_ACCESS_KEY: fixture-aws-secret-key",
        "VERCEL_TOKEN: fixture-vercel-deploy-token",
        "CLOUDFLARE_API_TOKEN: fixture-cloudflare-token",
      ].join("\n"),
    },
  },
  {
    label: "rejects environment name-value YAML secret fields",
    expected: "fail",
    files: {
      "outputs/provider/env-list.yml": [
        "- name: ACCESS_TOKEN",
        "  value: fixture-access-token",
        "- name: api_key",
        "  value: fixture-provider-api-key",
        "- key: VERCEL_TOKEN",
        "  value: fixture-vercel-deploy-token",
        "- key: AWS_SECRET_ACCESS_KEY",
        "  value: fixture-aws-secret-key",
      ].join("\n"),
    },
  },
  {
    label: "rejects environment name-value JSON secret fields",
    expected: "fail",
    files: {
      "outputs/provider/env-list.json": JSON.stringify([
        { name: "ACCESS_TOKEN", value: "fixture-access-token" },
        { name: "api_key", value: "fixture-provider-api-key" },
        { key: "VERCEL_TOKEN", value: "fixture-vercel-deploy-token" },
        { value: "fixture-aws-secret-key", key: "AWS_SECRET_ACCESS_KEY" },
      ]),
    },
  },
  {
    label: "rejects generic token and cookie JSON fields",
    expected: "fail",
    files: {
      "outputs/staging/evidence.json": JSON.stringify({
        accessToken: "fixture-access-token",
        refreshToken: "fixture-refresh-token",
        idToken: "fixture-id-token",
        authorization: "Bearer fixture-token",
        setCookie: "fanpass_session=fixture-session-cookie",
      }),
    },
  },
  {
    label: "rejects secret-bearing HTTP header JSON fields",
    expected: "fail",
    files: {
      "outputs/staging/headers.json": JSON.stringify({
        Authorization: "Bearer fixture-access-token",
        "Set-Cookie": "fanpass_session=fixture-session-cookie",
        "X-API-Key": "fixture-provider-api-key",
        "Stripe-Signature": "t=1234567890,v1=fixturewebhooksignature",
        "Privy-Access-Token": "fixture-privy-access-token",
      }),
    },
  },
  {
    label: "rejects secret-bearing snake_case JSON fields",
    expected: "fail",
    files: {
      "outputs/provider/snake-case-fields.json": JSON.stringify({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        id_token: "fixture-id-token",
        client_secret: "fixture-client-secret",
        api_key: "fixture-provider-api-key",
        provider_api_key: "fixture-provider-api-key",
        webhook_secret: "fixture-webhook-secret",
        signing_secret: "fixture-signing-secret",
      }),
    },
  },
  {
    label: "rejects secret-bearing YAML and colon fields",
    expected: "fail",
    files: {
      "outputs/provider/provider-export.yml": [
        "access_token: fixture-access-token",
        "refresh_token: fixture-refresh-token",
        "id_token: fixture-id-token",
        'client_secret: "fixture-client-secret"',
        "api_key: fixture-provider-api-key",
        "provider_api_key: fixture-provider-api-key",
        "webhook_secret: fixture-webhook-secret",
        "signing_secret: fixture-signing-secret",
      ].join("\n"),
    },
  },
  {
    label: "rejects deployment and cloud credential assignments",
    expected: "fail",
    files: {
      "outputs/deployment/evidence.log": [
        "VERCEL_TOKEN=fixture-vercel-deploy-token",
        "AWS_SECRET_ACCESS_KEY=fixture-aws-secret-key",
        "CLOUDFLARE_API_TOKEN=fixture-cloudflare-token",
      ].join("\n"),
    },
  },
  {
    label: "rejects lowercase deployment and cloud credential assignments",
    expected: "fail",
    files: {
      "outputs/deployment/lowercase-cloud-credentials.log": [
        "aws_access_key_id = AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key = fixture-aws-secret-access-key",
        'aws_session_token = "fixture-aws-session-token"',
        "cloudflare_api_token: fixture-cloudflare-api-token",
        "netlify_auth_token='fixture-netlify-auth-token'",
      ].join("\n"),
    },
  },
  {
    label: "rejects IaC sensitive output literals",
    expected: "fail",
    files: {
      "outputs/deployment/iac-sensitive-outputs.json": JSON.stringify({
        terraform: {
          outputs: {
            db_password: {
              sensitive: true,
              type: "string",
              value: "fixture-terraform-sensitive-output",
            },
          },
        },
        pulumi: {
          resources: [
            {
              outputs: {
                apiToken: {
                  value: "fixture-pulumi-sensitive-output",
                  secret: true,
                },
              },
            },
          ],
        },
      }),
    },
  },
  {
    label: "rejects deployment and cloud credential fields",
    expected: "fail",
    files: {
      "outputs/deployment/evidence.json": JSON.stringify({
        vercelToken: "fixture-vercel-deploy-token",
        awsSecretAccessKey: "fixture-aws-secret-key",
        cloudflareApiToken: "fixture-cloudflare-token",
      }),
    },
  },
  {
    label: "rejects deployment and cloud credential environment fields",
    expected: "fail",
    files: {
      "outputs/deployment/env-map.json": JSON.stringify({
        VERCEL_TOKEN: "fixture-vercel-deploy-token",
        AWS_SECRET_ACCESS_KEY: "fixture-aws-secret-key",
        CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
      }),
    },
  },
  {
    label: "rejects raw cloud credential literals",
    expected: "fail",
    files: {
      "outputs/deployment/raw-cloud-literals.log": [
        "AWS access key id AKIAIOSFODNN7EXAMPLE",
        "Google API key AIzaSyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ].join("\n"),
    },
  },
  {
    label: "rejects Azure storage credential literals",
    expected: "fail",
    files: {
      "outputs/deployment/azure-storage-credentials.log": [
        "DefaultEndpointsProtocol=https;AccountName=fanpassstaging;AccountKey=abcdefghijklmnopqrstuvwxyz0123456789+/==;EndpointSuffix=core.windows.net",
        "BlobEndpoint=https://fanpassstaging.blob.core.windows.net/;SharedAccessSignature=sv=2026-01-01&ss=b&srt=sco&sp=rl&se=2026-12-31T00%3A00%3A00Z&sig=fixtureAzureStorageSignature",
      ].join("\n"),
    },
  },
  {
    label: "rejects cloud storage signed URL credential parameters",
    expected: "fail",
    files: {
      "outputs/deployment/cloud-signed-urls.log": [
        "https://fanpass-staging.s3.us-east-1.amazonaws.com/evidence.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "https://storage.googleapis.com/fanpass-staging/evidence.json?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=fanpass-service%2F20260530%2Fauto%2Fstorage%2Fgoog4_request",
        "https://d111111abcdef8.cloudfront.net/evidence.json?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9maXh0dXJlLmV4YW1wbGUifV19",
      ].join("\n"),
    },
  },
  {
    label: "rejects encoded deployment private key credential literals",
    expected: "fail",
    files: {
      "outputs/deployment/encoded-private-key-credentials.log": [
        "SSH_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBPUFROU1NIIFBSSVZBVEUgS0VZLS0tLS1maXh0dXJlLWtleS1tYXRlcmlhbA==",
        "DEPLOY_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tZml4dHVyZS1kZXBsb3kta2V5LW1hdGVyaWFs",
        "GCP_SERVICE_ACCOUNT_KEY_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJpdmF0ZV9rZXlfaWQiOiJmaXh0dXJlIn0=",
        JSON.stringify({
          serviceAccountJsonBase64:
            "eyJjbGllbnRfZW1haWwiOiJmaXh0dXJlQGV4YW1wbGUuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20ifQ==",
        }),
      ].join("\n"),
    },
  },
  {
    label: "rejects Kubernetes kubeconfig credential literals",
    expected: "fail",
    files: {
      "outputs/deployment/kubeconfig-credentials.log": [
        "KUBECONFIG_BASE64=YXBpVmVyc2lvbjogdjEKY2x1c3RlcnM6Ci0gY2x1c3RlcjoKICAgIGNlcnRpZmljYXRlLWF1dGhvcml0eS1kYXRhOiBmaXh0dXJl",
        "KUBE_CONFIG_DATA=YXBpVmVyc2lvbjogdjEKdXNlcnM6Ci0gbmFtZTogZmFucGFzcy1kZXBsb3ltZW50CiAgdXNlcjoKICAgIHRva2VuOiBmaXh0dXJl",
        "client-key-data: LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tZml4dHVyZS1rdWJlLWNsaWVudC1rZXk=",
        "client-certificate-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tZml4dHVyZS1rdWJlLWNsaWVudC1jZXJ0",
        JSON.stringify({
          kubernetesConfigBase64:
            "YXBpVmVyc2lvbjogdjEKY29udGV4dHM6Ci0gY29udGV4dDogeyBjbHVzdGVyOiBmaXh0dXJlIH0=",
        }),
      ].join("\n"),
    },
  },
  {
    label: "rejects Docker and OCI registry credential literals",
    expected: "fail",
    files: {
      "outputs/ci/docker-registry-auth.log": [
        'DOCKER_AUTH_CONFIG={"auths":{"ghcr.io":{"auth":"ZmFucGFzczpmaXh0dXJlLXJlZ2lzdHJ5LXRva2Vu"}}}',
        "docker login ghcr.io --username fanpass-ci --password fixture-registry-password",
        "printf fixture-registry-token | docker login registry.example.com --username fanpass-ci --password-stdin",
      ].join("\n"),
    },
  },
  {
    label: "rejects encoded Docker and OCI registry credential literals",
    expected: "fail",
    files: {
      "outputs/deployment/kubernetes-registry-secret.yml": [
        "apiVersion: v1",
        "kind: Secret",
        "type: kubernetes.io/dockerconfigjson",
        "data:",
        "  .dockerconfigjson: eyJhdXRocyI6eyJnaGNyLmlvIjp7ImF1dGgiOiJabUZ1Y0dGemN6cG1hWGgwZFhKbExYSmxaMmx6ZEhKNUxYUnZhMlZ1In19fQ==",
        "REGISTRY_AUTH_CONFIG_BASE64=ZXlKaGRYUm9jeUk2ZXlKbmFHTnlMbWx2SWpwN0ltRjFkR2dpT2lKYVowWjFZMWRIYzBwMldIaDBPWEpvTVc5c1dWaEtNV0p1SW4xOWZRPT0=",
      ].join("\n"),
    },
  },
  {
    label: "rejects JWT",
    expected: "fail",
    files: {
      "outputs/privy/evidence.log":
        "token eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signature",
    },
  },
  {
    label: "rejects private key block",
    expected: "fail",
    files: {
      "outputs/chain/evidence.log":
        "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----",
    },
  },
  {
    label: "rejects Apple signing and device markers",
    expected: "fail",
    files: {
      "outputs/ios/evidence.log":
        "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----\nPROVISIONING_PROFILE_SPECIFIER=private-profile\nUDID=00008030ABCDEF12",
    },
  },
  {
    label: "rejects raw email and wallet address",
    expected: "fail",
    files: {
      "outputs/staff/evidence.json": JSON.stringify({
        reviewerEmail: "staff@example.com",
        walletAddress: "0x1111111111111111111111111111111111111111",
      }),
    },
  },
  {
    label: "rejects QR signing secret, invite token, nonce, and signed payload",
    expected: "fail",
    files: {
      "outputs/scanner/evidence.log": [
        "QR_SIGNING_SECRET=fixture-qr-signing-secret",
        JSON.stringify({
          inviteToken: "fixture-invite-token",
          nonce: "fixture-nonce-123",
          signedPayload: "fixture-signed-payload",
        }),
      ].join("\n"),
    },
  },
  {
    label: "rejects app session and client secret assignments",
    expected: "fail",
    files: {
      "outputs/runtime/evidence.log": [
        "SESSION_SIGNING_SECRET=fixture-session-secret",
        "OIDC_CLIENT_SECRET=fixture-client-secret",
        "PAYMENTS_WEBHOOK_SECRET=fixture-webhook-secret",
      ].join("\n"),
    },
  },
  {
    label: "rejects app session and client secret fields",
    expected: "fail",
    files: {
      "outputs/runtime/evidence.json": JSON.stringify({
        sessionSecret: "fixture-session-secret",
        clientSecret: "fixture-client-secret",
        webhookSecret: "fixture-webhook-secret",
      }),
    },
  },
  {
    label: "rejects secret-bearing URL query parameters",
    expected: "fail",
    files: {
      "outputs/runtime/evidence.log": [
        "https://staging.fanpass.example/callback?access_token=fixture-access-token",
        "https://staging.fanpass.example/provider?client_secret=fixture-client-secret",
      ].join("\n"),
    },
  },
  {
    label: "rejects secret-bearing URL fragment parameters",
    expected: "fail",
    files: {
      "outputs/runtime/evidence.log": [
        "https://staging.fanpass.example/callback#access_token=fixture-access-token",
        "https://staging.fanpass.example/return#state=ok&id_token=fixture-id-token",
      ].join("\n"),
    },
  },
  {
    label: "rejects raw FanPass identity and ticket/event identifiers",
    expected: "fail",
    files: {
      "outputs/staging/evidence.json": JSON.stringify({
        staffId: "usr_gate_demo",
        organizerId: "org_demo",
        ticketId: "tkt_weekend_demo",
        eventId: "evt_weekend_demo",
      }),
    },
  },
  {
    label: "rejects database URL",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log":
        "DATABASE_URL=postgres://fixture:secret@localhost/fanpass",
    },
  },
  {
    label: "rejects credentialed service URLs",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log":
        "REDIS_URL=redis://fixture-user:fixture-password@redis.internal:6379/0",
    },
  },
  {
    label: "rejects provider secret and raw database URL",
    expected: "fail",
    files: {
      "outputs/provider/evidence.log":
        "PROVIDER_SECRET=fixture-provider-secret\npostgresql://fixture:secret@localhost/fanpass",
    },
  },
  {
    label: "rejects provider API key fields",
    expected: "fail",
    files: {
      "outputs/provider/evidence.json": JSON.stringify({
        apiKey: "fixture-provider-api-key",
        alchemyApiKey: "fixture-alchemy-api-key",
      }),
    },
  },
  {
    label: "rejects provider RPC URL and chain API key",
    expected: "fail",
    files: {
      "outputs/chain/evidence.log":
        "CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/fixture-secret\nALCHEMY_API_KEY=fixture-alchemy-key",
    },
  },
  {
    label: "rejects Privy verification key assignment",
    expected: "fail",
    files: {
      "outputs/privy/evidence.log": "PRIVY_VERIFICATION_KEY=fixture-secret",
    },
  },
  {
    label: "rejects staging admin token assignment",
    expected: "fail",
    files: {
      "outputs/staging/evidence.log":
        "STAGING_ADMIN_ACCESS_TOKEN=fixture-admin-token",
    },
  },
];

const results = cases.map((testCase) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "fanpass-evidence-redaction-"),
  );
  try {
    for (const [relativePath, contents] of Object.entries(testCase.files)) {
      writeFixtureFile(fixtureRoot, relativePath, contents);
    }
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        FANPASS_EVIDENCE_REDACTION_ROOT: fixtureRoot,
      },
      encoding: "utf8",
    });
    const passed = result.status === 0;
    const expectedPass = testCase.expected === "pass";
    return {
      label: testCase.label,
      expected: testCase.expected,
      status: result.status,
      ok: passed === expectedPass,
      stderr: result.stderr.trim(),
    };
  } finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: results.map(({ label, expected, status }) => ({
        label,
        expected,
        status,
      })),
    },
    null,
    2,
  ),
);

function writeFixtureFile(fixtureRoot, relativePath, contents) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
