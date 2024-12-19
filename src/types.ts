import type { EspaceMembreClient } from "./client";

export interface EspaceMembreAuthOptions {
  /**
   * Si `true`, les utilisateurs inactifs peuvent se connecter.
   *
   * Dans le cas contraire, ils seront refusés par NextAuth.
   *
   * @default false
   */
  allowInactive?: boolean;
}

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
  /**
   * Options d'authentification à l'espace membre.
   */
  authOptions?: EspaceMembreAuthOptions;
}
