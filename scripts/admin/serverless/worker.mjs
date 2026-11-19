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
          privateApi,
          privateActionsApi,
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
        cached = {broker, gate, publicRuntime: runtimeModule.createPublicRuntimeProxy()};
      }
      if (new URL(request.url).pathname.startsWith("/admin/"))
        return await cached.gate(request);
      if (new URL(request.url).pathname.startsWith("/site/"))
        return await cached.publicRuntime(request);
      return await cached.broker.fetch(request);
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
