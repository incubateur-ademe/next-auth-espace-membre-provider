import { type AdapterWrapper, getAdapterWrapper } from "./Adapter";
import { type CallbacksWrapper, getCallbacksWrapper } from "./Callbacks";
import {
  type ProviderConfigWrapper,
  getProviderConfigWrapper,
} from "./ProviderConfig";
import { EspaceMembreClient } from "./client";
import type { ClientOptions } from "./client/EspaceMembreClient";

export interface EspaceMembreProviderConfig {
  /**
   * @see {@link ClientOptions.apiKey}
   */
  espaceMembreApiKey?: string;
  /**
   * @see {@link ClientOptions.fetch}
   */
  fetch?: EspaceMembreClient.RegisteredFetch;
  /**
   * @see {@link ClientOptions.fetchOptions}
   */
  fetchOptions?: EspaceMembreClient.RegisteredFetchOptions;
}

/**
 * Wrappers pour les différentes parties de la configuration du provider.
 */
export interface EspaceMembreProviderWrappers {
  ProviderWrapper: ProviderConfigWrapper;
  AdapterWrapper: AdapterWrapper;
  CallbacksWrapper: CallbacksWrapper;
}

/**
 * Crée les wrappers pour les différentes parties de la configuration du provider.
 * 
 * @param config Configuration du provider
 * @returns Les wrappers
 *
 * @example
 * ```typescript
  // fichier "auth.ts" où vous configurez NextAuth.js
  import { EspaceMembreProvider } from '@incubateur-ademe/next-auth-espace-membre-provider';
  import NextAuth from "next-auth";
  import { PrismaAdapter } from "@auth/prisma-adapter";
  import { prisma } from "@/prisma";

  const espaceMembreProvider = EspaceMembreProvider({
    espaceMembreApiKey: "votre-api-key", // optionnel, par défaut `process.env.ESPACE_MEMBRE_API_KEY` ou ""
    fetch, // optionnel, par défaut le `fetch` de base (permet de récupérer celui de Next par exemple)
    fetchOptions: { // optionnel, par défaut {} (permet de passer des options spécifiques à Next par exemple)
      next: {
        revalidate: 300, // 5 minutes
      },
      cache: "default",
    },
  });

  export default NextAuth({
    adapter: espaceMembreProvider.AdapterWrapper(PrismaAdapter(prisma)),
    providers: [
      espaceMembreProvider.ProviderWrapper(
        Nodemailer({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM,
        }),
      ),
    ],
    callbacks: espaceMembreProvider.CallbacksWrapper({
      async signIn(user, account, profile) {
        // non obligatoire. Le wrapper s'occupe ici de valider le nom d'utilisateur.
        // vous récupérez alors le "user" avec le nom d'utilisateur validé, et "account.userId" correctement renseigné
      },
      async jwt(token, user, account, espaceMembreMember) { // nouvelle propriété "espaceMembreMember"
        // vous pouvez si vous le souhaitez compléter le token avec des informations de l'espace membre
      },
    }),
    // ...
  });
 * ```
 */
export function EspaceMembreProvider(config: EspaceMembreProviderConfig) {
  const client = new EspaceMembreClient({
    apiKey: config.espaceMembreApiKey,
    fetch: config.fetch,
    fetchOptions: config.fetchOptions,
  });

  return {
    ProviderWrapper: getProviderConfigWrapper(client),
    AdapterWrapper: getAdapterWrapper(client),
    CallbacksWrapper: getCallbacksWrapper(client),
  } as const;
}

export { ESPACE_MEMBRE_PROVIDER_ID } from "./ProviderConfig";
