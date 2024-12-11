import type { NextAuthConfig } from "next-auth";
import { ESPACE_MEMBRE_PROVIDER_ID } from "./ProviderConfig";
import {
  type EspaceMembreClient,
  EspaceMembreClientError,
  type Member,
} from "./client";

type JWTCallback = Required<Required<NextAuthConfig>["callbacks"]>["jwt"];
type AugmentedCallbacks = Omit<Required<NextAuthConfig>["callbacks"], "jwt"> & {
  jwt?: (
    params: Parameters<JWTCallback>["0"] & {
      /**
       * L'objet "Membre" venant de l'espace membre.
       *
       * @note Disponible quand `trigger` est `"signIn"`.
       */
      espaceMembreMember?: Member;
    },
  ) => ReturnType<JWTCallback>;
};

export type CallbacksWrapper = (
  originalCallbacks: AugmentedCallbacks,
) => AugmentedCallbacks;

export function getCallbacksWrapper(
  client: EspaceMembreClient,
): CallbacksWrapper {
  return (originalCallbacks) => {
    return {
      ...originalCallbacks,
      async signIn(params) {
        if (
          params.account?.provider === ESPACE_MEMBRE_PROVIDER_ID &&
          params.email?.verificationRequest
        ) {
          if (!params.user.email) {
            throw new Error(
              "EspaceMembreProviderWrapper.signIn: `user.email` is required when using the Espace Membre provider",
            );
          }
          const username = params.user.email;
          try {
            const betaUser = await client.member().getByUsername(username);

            params.user.name = betaUser.fullname;
            params.user.image = betaUser.avatar;
            params.user.email =
              betaUser.communication_email === "primary"
                ? betaUser.primary_email
                : betaUser.secondary_email;
            params.user.id = username;
            params.account.userId = username;
          } catch (error: unknown) {
            if (
              error instanceof EspaceMembreClientError &&
              error.response?.status === 404
            ) {
              return false;
            }
            throw error;
          }
        }
        return originalCallbacks?.signIn?.(params) ?? true;
      },

      async jwt(params) {
        if (
          params.trigger !== "update" &&
          params.account?.provider === ESPACE_MEMBRE_PROVIDER_ID
        ) {
          if (!params.token.sub) {
            throw new Error(
              "EspaceMembreProviderWrapper.jwt: `token.sub` is required when using the Espace Membre provider",
            );
          }
          const betaUser = await client
            .member()
            .getByUsername(params.token.sub);
          return (
            originalCallbacks?.jwt?.({
              ...params,
              espaceMembreMember: betaUser,
            }) ?? params.token
          );
        }
        return originalCallbacks?.jwt?.(params) ?? params.token;
      },
    };
  };
}
