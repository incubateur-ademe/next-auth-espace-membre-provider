import type { EspaceMembreClient as Base } from "..";
import type { EspaceMembreClient } from "../EspaceMembreClient";
import { EspaceMembreClientError } from "../error";
import type { Startup, StartupWithIncubator } from "../models";

type GetAllOption<WithIncubator extends boolean> = {
  withIncubator?: WithIncubator;
  /** Filtre sur la phase courante, par exemple `["construction", "acceleration"]`. */
  phases?: string[];
};
type GetAllReturn<WithIncubator extends boolean> = (WithIncubator extends true
  ? StartupWithIncubator
  : Startup)[];

/** L'incubateur principal, celui que désigne `incubator_id`, parmi les incubateurs liés. */
function withIncubator(startup: Startup): StartupWithIncubator {
  return {
    ...startup,
    incubator:
      startup.incubators.find((ref) => ref.uuid === startup.incubator_id) ??
      null,
  };
}

export class ApiStartup {
  constructor(protected client: EspaceMembreClient) {}

  /**
   * Récupère toutes les startups dans le périmètre de la clef.
   *
   * @param options Options de récupération des startups.
   * @param fetchOptions Options de fetch à utiliser pour chaque page.
   *
   * @throws {EspaceMembreClientError} Si une erreur est survenue lors de la récupération des startups.
   */
  public async getAll<WithIncubator extends boolean = false>(
    options?: GetAllOption<WithIncubator>,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<GetAllReturn<WithIncubator>> {
    const query: Record<string, string> = {};
    if (options?.phases?.length) {
      query.phase = options.phases.join(",");
    }
    try {
      const startups = await this.client.getCollection<Startup>(
        "/startups",
        query,
        fetchOptions,
      );
      return (
        options?.withIncubator ? startups.map(withIncubator) : startups
      ) as GetAllReturn<WithIncubator>;
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération des startups. (${(error as Error).message})`,
        error instanceof EspaceMembreClientError ? error.response : undefined,
      );
    }
  }

  /**
   * Récupère une startup par son ghid, avec ses incubateurs.
   *
   * @throws {EspaceMembreClientError} Si une erreur est survenue lors de la récupération de la startup.
   */
  public async getByGhid(
    ghid: string,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<StartupWithIncubator> {
    try {
      return await this.client.getOne<StartupWithIncubator>(
        `/startups/${encodeURIComponent(ghid)}`,
        fetchOptions,
      );
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération de la startup. (${(error as Error).message})`,
        error instanceof EspaceMembreClientError ? error.response : undefined,
      );
    }
  }
}
