import type { CommonProviderOptions } from "next-auth/providers";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";
import type { EspaceMembreClient } from "./client";

/**
 * À utiliser lors de l'utilisation de la fonction `signIn` de l'API de NextAuth.
 */
export const ESPACE_MEMBRE_PROVIDER_ID = "espace-membre-beta-gouv-email";

function assertEmailProviderConfig(
  config: CommonProviderOptions,
): asserts config is NodemailerConfig {
  if (config.id !== "email" && config.id !== "nodemailer") {
    throw new Error(
      "EspaceMembreProviderWrapper can only be used with the email provider",
    );
  }
}

/**
 * Wrapper pour la configuration du fournisseur d'authentification.
 */
export type ProviderConfigWrapper = (
  originalConfig: NodemailerConfig,
) => NodemailerConfig;

/**
 * Récupère le wrapper pour la configuration du fournisseur d'authentification.
 */
export function getProviderConfigWrapper(
  client: EspaceMembreClient,
): ProviderConfigWrapper {
  return (originalConfig) => {
    assertEmailProviderConfig(originalConfig);

    const { options, ...configWithoutOptions } = originalConfig;
    const { sendVerificationRequest, normalizeIdentifier, ...cleanedOptions } =
      options ?? {};
    const baseConfig = {
      ...configWithoutOptions,
      sendVerificationRequest:
        sendVerificationRequest ?? configWithoutOptions.sendVerificationRequest,
      normalizeIdentifier:
        normalizeIdentifier ?? configWithoutOptions.normalizeIdentifier,
      ...cleanedOptions,
    };

    return {
      ...baseConfig,
      id: ESPACE_MEMBRE_PROVIDER_ID,
      sendVerificationRequest: async ({
        identifier: betaUsername,
        ...params
      }) => {
        const user = await client.member.getByUsername(betaUsername);
        return baseConfig.sendVerificationRequest({
          ...params,
          identifier:
            user.communication_email === "primary"
              ? user.primary_email
              : user.secondary_email,
        });
      },
      normalizeIdentifier: (identifier: string) => {
        const normalizedIdentifier = encodeURIComponent(
          identifier.toLowerCase(),
        );
        return (
          baseConfig.normalizeIdentifier?.(normalizedIdentifier) ??
          normalizedIdentifier
        );
      },
    };
  };
}
