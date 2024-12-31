import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { EspaceMembreClient } from "./client";

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
     */
    username: string;
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
        const betaGouvUser = await client.member.getByUsername(
          user.email /* email is actually username here */,
        );

        const verifiedUser: AdapterUser = {
          ...user,
          name: betaGouvUser.fullname,
          email:
            betaGouvUser.communication_email === "primary"
              ? betaGouvUser.primary_email
              : betaGouvUser.secondary_email,
          username: betaGouvUser.username,
          image: betaGouvUser.avatar,
        };

        return originalAdapter.createUser(verifiedUser);
      },

      async getUserByEmail(emailOrUsername) {
        if (emailOrUsername.includes("@")) {
          return originalAdapter.getUserByEmail(emailOrUsername);
        }

        const betaGouvUser = await client.member.getByUsername(
          emailOrUsername /* email is actually username here */,
        );

        return originalAdapter.getUserByEmail(
          betaGouvUser.communication_email === "primary"
            ? betaGouvUser.primary_email
            : betaGouvUser.secondary_email,
        );
      },
    };
  };
}
