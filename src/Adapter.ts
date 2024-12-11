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

export type AdapterWrapper = (originalAdapter: Adapter) => Adapter;

export function getAdapterWrapper(client: EspaceMembreClient): AdapterWrapper {
  return (originalAdapter) => {
    assertMinimalAdapter(originalAdapter);

    return {
      ...originalAdapter,
      async createUser(user) {
        const betaGouvUser = await client
          .member()
          .getByUsername(user.email /* email is actually username here */);

        const verifiedUser: AdapterUser = {
          ...user,
          name: betaGouvUser.fullname,
          email:
            betaGouvUser.communication_email === "primary"
              ? betaGouvUser.primary_email
              : betaGouvUser.secondary_email,
          id: betaGouvUser.username,
          image: betaGouvUser.avatar,
        };

        return originalAdapter.createUser(verifiedUser);
      },

      async getUserByEmail(email) {
        if (email.includes("@")) {
          return originalAdapter.getUserByEmail(email);
        }

        const betaGouvUser = await client
          .member()
          .getByUsername(email /* email is actually username here */);

        return originalAdapter.getUserByEmail(
          betaGouvUser.communication_email === "primary"
            ? betaGouvUser.primary_email
            : betaGouvUser.secondary_email,
        );
      },
    };
  };
}
