import type { Adapter, AdapterUser } from "next-auth/adapters";
import {
  type EspaceMembreClient,
  EspaceMembreClientMemberNotFoundError,
  type Member,
  getMemberEmail,
} from "./client";

type MinimalAdapter = Omit<Adapter, "createUser" | "getUserByEmail"> &
  Required<Pick<Adapter, "createUser" | "getUserByEmail">>;
function assertMinimalAdapter(
  adapter: Adapter,
): asserts adapter is MinimalAdapter {
  if (!adapter.createUser || !adapter.getUserByEmail) {
    throw new Error(
      "EspaceMembreProviderWrapper can only be used with an adapter that supports createUser and getUserByEmail",
    );
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    /**
     * "username" du membre de l'espace membre.
     *
     * @info Overloadé par "@incubateur-ademe/next-auth-espace-membre-provider".
     * @info Doit être ajouté en base de données pour que l'adaptateur fonctionne.
     */
    username: string;
    /**
     * Atteste que l'utilisateur vient de beta.gouv.
     *
     * @info Overloadé par "@incubateur-ademe/next-auth-espace-membre-provider".
     * @info Doit être ajouté en base de données pour que l'adaptateur fonctionne.
     */
    isBetaGouvMember: boolean;
  }
}

/**
 * Wrapper pour l'adaptateur de NextAuth.
 */
export type AdapterWrapper = (originalAdapter: Adapter) => Adapter;

/**
 * Récupère le wrapper pour l'adaptateur de NextAuth.
 */
export function getAdapterWrapper(client: EspaceMembreClient): AdapterWrapper {
  return (originalAdapter) => {
    assertMinimalAdapter(originalAdapter);

    return {
      ...originalAdapter,
      async createUser(user) {
        if (user.email.includes("@")) {
          return originalAdapter.createUser(user);
        }

        // Si l'utilisateur n'a pas d'email, on le crée avec le username
        const betaGouvUser = await client.member.getByUsername(
          user.email /* email is actually username here */,
        );

        const verifiedUser: AdapterUser = {
          ...user,
          name: betaGouvUser.fullname,
          email: getMemberEmail(betaGouvUser),
          username: betaGouvUser.username,
          image: betaGouvUser.avatar,
          isBetaGouvMember: true,
        };

        return originalAdapter.createUser(verifiedUser);
      },

      async getUserByEmail(emailOrUsername) {
        if (emailOrUsername.includes("@")) {
          return originalAdapter.getUserByEmail(emailOrUsername);
        }

        let betaGouvUser: Member;
        try {
          betaGouvUser = await client.member.getByUsername(
            emailOrUsername /* email is actually username here */,
          );
        } catch (error: unknown) {
          // NextAuth appelle l'adaptateur avant le callback signIn, qui refuse ce membre.
          if (error instanceof EspaceMembreClientMemberNotFoundError) {
            return null;
          }
          throw error;
        }

        // Un utilisateur créé en 0.3 avec son adresse secondaire doit être retrouvé, sans
        // quoi NextAuth en créerait un second pour le même membre.
        for (const email of new Set([
          getMemberEmail(betaGouvUser),
          betaGouvUser.secondary_email,
        ])) {
          if (!email) {
            continue;
          }
          const user = await originalAdapter.getUserByEmail(email);
          if (user) {
            return user;
          }
        }
        return null;
      },
    };
  };
}
