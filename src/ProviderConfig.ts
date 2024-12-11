import type { CommonProviderOptions } from "next-auth/providers";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";
import type { EspaceMembreClient } from "./client";

export const ESPACE_MEMBRE_PROVIDER_ID = "betagouv-email";

function assertEmailProviderConfig(
  config: CommonProviderOptions,
): asserts config is NodemailerConfig {
  if (config.id !== "email" && config.id !== "nodemailer") {
    throw new Error(
      "EspaceMembreProviderWrapper can only be used with the email provider",
    );
  }
}

export type ProviderConfigWrapper = (
  originalConfig: NodemailerConfig,
) => NodemailerConfig;

export function getProviderConfigWrapper(
  client: EspaceMembreClient,
): ProviderConfigWrapper {
  return (originalConfig) => {
    assertEmailProviderConfig(originalConfig);

    return {
      ...originalConfig,
      id: ESPACE_MEMBRE_PROVIDER_ID,
      sendVerificationRequest: async ({
        identifier: betaUsername,
        ...params
      }) => {
        const user = await client.member().getByUsername(betaUsername);
        return originalConfig.sendVerificationRequest({
          ...params,
          identifier:
            user.communication_email === "primary"
              ? user.primary_email
              : user.secondary_email,
        });
      },
      normalizeIdentifier: (identifier: string) => {
        return encodeURIComponent(identifier.toLowerCase());
      },
    };
  };
}
