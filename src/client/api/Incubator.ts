import type { EspaceMembreClient as Base } from "..";
import type { EspaceMembreClient } from "../EspaceMembreClient";
import { EspaceMembreClientError } from "../error";
import type {
  Incubator,
  IncubatorWithMembers,
  IncubatorWithStartups,
} from "../models";
import type { AnyNonNullable } from "../types";

type GetAllOption<WithStartups extends boolean, WithMembers extends boolean> = {
  withStartups?: WithStartups;
  withMembers?: WithMembers;
};
type GetAllReturn<
  WithStartups extends boolean,
  WithMembers extends boolean,
> = ((WithStartups extends true ? IncubatorWithStartups : Incubator) &
  (WithMembers extends true ? IncubatorWithMembers : AnyNonNullable))[];

export class ApiIncubator {
  constructor(protected client: EspaceMembreClient) {}

  /**
   * Récupère tous les incubateurs.
   *
   * @param options Options de récupération des incubateurs.
   * @param fetchOptions Options de fetch à utiliser pour la requête.
   *
   * @throws {EspaceMembreClientError} Si une erreur est survenue lors de la récupération des incubateurs.
   */
  public async getAll<
    WithStartups extends boolean = false,
    WithMembers extends boolean = false,
  >(
    options?: GetAllOption<WithStartups, WithMembers>,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<GetAllReturn<WithStartups, WithMembers>> {
    const searchParams = new URLSearchParams();
    if (options?.withStartups) {
      searchParams.append("includes", "startups");
    }
    if (options?.withMembers) {
      searchParams.append("includes", "members");
    }
    const qs = searchParams.toString();
    try {
      return await this.client.makeRequest<
        GetAllReturn<WithStartups, WithMembers>
      >(
        {
          method: "GET",
          path: `/incubator${qs ? `?${qs}` : ""}`,
        },
        fetchOptions,
      );
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération des incubateurs. (${(error as Error).message})`,
      );
    }
  }
}
