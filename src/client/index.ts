export { EspaceMembreClient } from "./EspaceMembreClient";
export * from "./error";
export * from "./types";

export namespace EspaceMembreClient {
  /**
   * Add a custom fetch implementation to the Espace Membre client module.
   *
   * To register a custom fetch implementation, you must provide a `fetch` function that
   * behaves like the native `fetch` function. This function will be used to make requests
   * to the Airtable API.
   *
   * @example
   * ```typescript
   * import EspaceMembreClient from '@incubateur-ademe/next-auth-espace-membre-provider';
   *
   * declare "@incubateur-ademe/next-auth-espace-membre-provider" {
   *  namespace EspaceMembreClient {
   *   interface RegisterFetch {
   *    fetch: typeof myCustomFetch;
   *   }
   *  }
   * }
   *
   * EspaceMembreClient.configure({
   *   fetch: myCustomFetch,
   * });
   * ```
   */

  // biome-ignore lint/suspicious/noEmptyInterface: This interface is used to extend the module.
  export interface RegisterFetch {}
  export type RegisteredFetch = RegisterFetch extends {
    fetch: infer TFetch extends typeof fetch;
  }
    ? TFetch
    : typeof fetch;
  export type RegisteredFetchOptions = Parameters<RegisteredFetch>[1];
}
