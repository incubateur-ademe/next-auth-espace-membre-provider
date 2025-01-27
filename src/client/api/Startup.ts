import type { EspaceMembreClient as Base } from "..";
import type { EspaceMembreClient } from "../EspaceMembreClient";
import { EspaceMembreClientError } from "../error";
import type { Startup, StartupWithIncubator } from "../models";

type GetAllOption<WithIncubator extends boolean> = {
  withIncubator?: WithIncubator;
};
type GetAllReturn<WithIncubator extends boolean> = (WithIncubator extends true
  ? StartupWithIncubator
  : Startup)[];
export class ApiStartup {
  constructor(protected client: EspaceMembreClient) {}

  /**
   * Récupère tous les incubateurs.
   *
   * @param options Options de récupération des incubateurs.
   * @param fetchOptions Options de fetch à utiliser pour la requête.
   *
   * @throws {EspaceMembreClientError} Si une erreur est survenue lors de la récupération des incubateurs.
   */
  public async getAll<WithIncubator extends boolean = false>(
    options?: GetAllOption<WithIncubator>,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<GetAllReturn<WithIncubator>> {
    const searchParams = new URLSearchParams();
    if (options?.withIncubator) {
      searchParams.append("includes", "incubator");
    }
    const qs = searchParams.toString();
    try {
      return await this.client.makeRequest<GetAllReturn<WithIncubator>>(
        {
          method: "GET",
          path: `/startup${qs ? `?${qs}` : ""}`,
        },
        fetchOptions,
      );
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération des startups. (${(error as Error).message})`,
      );
    }
  }

  public async getByGhid(
    ghid: string,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<StartupWithIncubator> {
    try {
      return await this.client.makeRequest<StartupWithIncubator>(
        {
          method: "GET",
          path: `/startup/${ghid}`,
        },
        fetchOptions,
      );
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération de la startup. (${(error as Error).message})`,
      );
    }
  }
}
