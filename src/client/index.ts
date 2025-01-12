export { EspaceMembreClient } from "./EspaceMembreClient";
export * from "./error";
export * from "./models";

export namespace EspaceMembreClient {
  /**
   * Ajouter une implémentation de fetch personnalisée au module client de l'Espace Membre.
   *
   * Pour enregistrer une implémentation de fetch personnalisée, vous devez fournir une fonction `fetch` qui
   * se comporte comme la fonction native `fetch`. Cette fonction sera utilisée pour effectuer des requêtes
   * à l'API de l'Espace Membre.
   *
   * @example
   * ```typescript
   * import { EspaceMembreClient } from '@incubateur-ademe/next-auth-espace-membre-provider/client';
   * import { myCustomFetch } from './myCustomFetch';
   *
   * declare "@incubateur-ademe/next-auth-espace-membre-provider/client" {
   *  namespace EspaceMembreClient {
   *   interface RegisterFetch {
   *    fetch: typeof myCustomFetch;
   *   }
   *  }
   * }
   *
   * const client = new EspaceMembreClient({
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
