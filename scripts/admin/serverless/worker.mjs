// Diagnostic codes reveal only which operation could not complete. The
// probe never writes files or exposes provider response bodies or credentials.
export async function diagnoseAuthStorage(privateApi, repositoryId) {
  try {
    await privateApi.token();
  } catch {
    return "AUTH_APP_INSTALLATION_TOKEN";
  }
  try {
    const metadata = await privateApi.request("");
    if (!metadata || metadata.private !== true ||
        metadata.full_name !== privateApi.repository ||
        metadata.default_branch !== "main" ||
        String(metadata.id) !== String(repositoryId))
      return "AUTH_PRIVATE_REPOSITORY_METADATA";
  } catch {
    return "AUTH_PRIVATE_REPOSITORY_ACCESS";
  }
  try {
    await privateApi.request(
      "contents/.morothon-state/auth?ref=admin-state",
      { allow404: true },
    );
  } catch {
    return "AUTH_PRIVATE_STATE_BRANCH_ACCESS";
  }
  return "AUTH_STATE_WRITE_OR_CRYPTO";
}
// Optional Cloudflare adapter. No data engines, filesystem, database or hosting SDK.
import storeModule from "./github-store.cjs";
import authModule from "./auth.cjs";
import gatewayModule from "./admin-gateway.cjs";
import runtimeModule from "./public-runtime-proxy.cjs";
import brokerModule from "./broker.cjs";
import oidcModule from "./oidc.cjs";
import accountsModule from "../account-directory.cjs";
let cached;
export default {
  async fetch(request, env) {
    try {
      if (!cached) {
        const required = [
          "API_ORIGIN",
          "PORTAL_URL",
          "OWNER_USER_ID",
          "OWNER_GITHUB_ID",
          "OAUTH_CLIENT_ID",
          "OAUTH_CLIENT_SECRET",
          "GITHUB_APP_ID",
          "GITHUB_INSTALLATION_ID",
          "GITHUB_APP_PRIVATE_KEY",
          "STORAGE_KEY",
          "PRIVATE_REPOSITORY",
          "PRIVATE_REPOSITORY_ID",
          "PRIVATE_WORKFLOW_SHA",
          "PROCESSOR_CODE_SHA",
          "DISPATCH_ACTOR_ID",
        ];
        if (
          required.some((k) => !env[k]) ||
          !/^[a-f0-9]{64}$/.test(env.STORAGE_KEY) ||
          !env.AUTH_LIMITER ||
          !env.API_LIMITER
        )
          throw Error("setup");
        const { connection, githubStore } = storeModule,
          key = Buffer.from(env.STORAGE_KEY, "hex"),
          common = {
            appId: env.GITHUB_APP_ID,
            installationId: env.GITHUB_INSTALLATION_ID,
            privateKey: env.GITHUB_APP_PRIVATE_KEY,
          };
        const privateApi = connection({
            ...common,
            repository: env.PRIVATE_REPOSITORY,
            permissions: { contents: "write" },
          }),
          privateActionsApi = connection({
            ...common,
            repository: env.PRIVATE_REPOSITORY,
            permissions: { actions: "write" },
          }),
          publicApi = connection({
            ...common,
            repository: "morothon-no/historikk",
            permissions: { contents: "read" },
          }),
          accounts = accountsModule.createAccountDirectory({
            users: [{ userId: env.OWNER_USER_ID, active: true }],
            externalIdentities: [
              {
                provider: "github",
                subject: env.OWNER_GITHUB_ID,
                userId: env.OWNER_USER_ID,
              },
            ],
            memberships: [
              {
                userId: env.OWNER_USER_ID,
                organizerId: "sogne-morothon",
                role: "owner",
                active: true,
              },
            ],
          }),
          stores = {
            auth: githubStore({
              api: privateApi,
              key,
              repositoryId: env.PRIVATE_REPOSITORY_ID,
              prefix: "auth",
              maxBytes: 65536,
            }),
            reviews: githubStore({
              api: privateApi,
              key,
              repositoryId: env.PRIVATE_REPOSITORY_ID,
              prefix: "reviews",
              maxBytes: 131072,
            }),
            control: githubStore({
              api: privateApi,
              key,
              repositoryId: env.PRIVATE_REPOSITORY_ID,
              prefix: "control",
              maxBytes: 131072,
            }),
          };
        const auth = authModule.createAuth({
          apiOrigin: env.API_ORIGIN,
          portalOrigin: new URL(env.PORTAL_URL).origin,
          portalUrl: env.PORTAL_URL,
          clientId: env.OAUTH_CLIENT_ID,
          clientSecret: env.OAUTH_CLIENT_SECRET,
          accounts,
          store: stores.auth,
        });
        const broker = brokerModule.createBroker({
          portalUrl: env.PORTAL_URL,
          apiOrigin: env.API_ORIGIN,
          ownerUserId: env.OWNER_USER_ID,
          ownerGithubId: env.OWNER_GITHUB_ID,
          codeSha: env.PROCESSOR_CODE_SHA,
          workflowSha: env.PRIVATE_WORKFLOW_SHA,
          auth,
          reviews: stores.reviews,
          control: stores.control,
          // The pinned broker only dispatches/reads private Actions through
          // privateApi. OAuth/review/control state independently use
          // the contents-write privateApi in the stores above.
          privateApi: privateActionsApi,
          publicApi,
          verifyOidc: oidcModule.oidcVerifier({
            repository: env.PRIVATE_REPOSITORY,
            repositoryId: env.PRIVATE_REPOSITORY_ID,
            workflowSha: env.PRIVATE_WORKFLOW_SHA,
            actorId: env.DISPATCH_ACTOR_ID,
            audience: env.API_ORIGIN + "/processor",
          }),
          rateLimit: async (r, { sensitive }) =>
            (
              await (sensitive ? env.AUTH_LIMITER : env.API_LIMITER).limit({
                key: storeModule.sha(
                  r.headers.get("CF-Connecting-IP") || "unavailable",
                ),
              })
            ).success,
          leaseTokens: async (task) => {
            const write = ["publish", "continue"].includes(task.action),
              publicConnection = connection({
                ...common,
                repository: "morothon-no/historikk",
                permissions: write
                  ? {
                      contents: "write",
                      pull_requests: "write",
                      variables: "write",
                      actions: "write",
                      checks: "read",
                      administration: "read",
                    }
                  : {
                      contents: "read",
                      actions: "read",
                      checks: "read",
                      administration: "read",
                      variables: "read",
                    },
              }),
              processorConnection = connection({
                ...common,
                repository: env.PRIVATE_REPOSITORY,
                permissions: { contents: "write" },
              });
            return {
              privateToken: await processorConnection.token(),
              publicToken: await publicConnection.token(),
              storageKey: env.STORAGE_KEY,
              privateRepository: env.PRIVATE_REPOSITORY,
              privateRepositoryId: env.PRIVATE_REPOSITORY_ID,
              publicRepository: "morothon-no/historikk",
              codeSha: env.PROCESSOR_CODE_SHA,
              ownerUserId: env.OWNER_USER_ID,
              appId: env.GITHUB_APP_ID,
            };
          },
        });
        // Separate protected document delivery from the existing bearer API.
        // ADMIN_ASSETS is a private Worker asset binding, NEVER a Pages origin.
        const gate = gatewayModule.createAdminGateway({
          portalOrigin: new URL(env.PORTAL_URL).origin,
          apiOrigin: env.API_ORIGIN,
          auth,
          rateLimit: async request =>
            (await env.AUTH_LIMITER.limit({
              key: storeModule.sha(request.headers.get("CF-Connecting-IP") || "unavailable"),
            })).success,
          assetSource: async (filename) => {
            if (!env.ADMIN_ASSETS) return null; // fail closed until cutover
            const source = new URL("/admin/" + filename, env.PORTAL_URL);
            const result = await env.ADMIN_ASSETS.fetch(new Request(source));
            if (!result.ok) return null;
            return { bytes: await result.arrayBuffer() };
          },
        });
        cached = {broker, gate, privateApi, publicRuntime: runtimeModule.createPublicRuntimeProxy()};
      }
      if (new URL(request.url).pathname.startsWith("/admin/"))
        return await cached.gate(request);
      if (new URL(request.url).pathname.startsWith("/site/"))
        return await cached.publicRuntime(request);
      // A failed OAuth start used to hide every GitHub storage error behind
      // one generic message. A read-only, bounded probe classifies the stage
      // without disclosing OAuth state, GitHub responses, tokens or secrets.
      // The broker still owns auth, CSRF validation and rate limiting.
      const response = await cached.broker.fetch(request);
      if (new URL(request.url).pathname === "/auth/begin" &&
          (response.status === 502 || response.status === 503)) {
        const code = await diagnoseAuthStorage(
          cached.privateApi, env.PRIVATE_REPOSITORY_ID,
        );
        return new Response(JSON.stringify({
          error: "Innloggingen kunne ikke starte. Ingen data er endret.",
          diagnostic: code,
        }), {
          status: response.status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
      return response;
    } catch {
      return new Response(
        JSON.stringify({
          error:
            "Innlogging og lagring er ikke aktivert. Ingen rettelse er publisert.",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    }
  },
};
