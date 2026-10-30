import type { EspaceMembreClient as Base } from "..";
import type { EspaceMembreClient } from "../EspaceMembreClient";
import { EspaceMembreClientError } from "../error";
import type {
  Incubator,
  IncubatorMember,
  IncubatorStartup,
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

/**
 * L'API v1 n'inclut ni produits ni membres dans la liste des incubateurs : chacun se lit
 * par sa propre route. Borner la concurrence évite d'ouvrir une requête par incubateur
 * d'un coup.
 */
const CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index] as T);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

export class ApiIncubator {
  constructor(protected client: EspaceMembreClient) {}

  /**
   * Récupère tous les incubateurs dans le périmètre de la clef.
   *
   * `withStartups` et `withMembers` coûtent une lecture par incubateur, et exigent les
   * portées `startups:read` et `members:read`. Les membres comprennent ceux dont la
   * mission est terminée.
   *
   * @param options Options de récupération des incubateurs.
   * @param fetchOptions Options de fetch à utiliser pour chaque requête.
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
    try {
      const incubators = await this.client.getCollection<Incubator>(
        "/incubators",
        {},
        fetchOptions,
      );
      if (!options?.withStartups && !options?.withMembers) {
        return incubators as GetAllReturn<WithStartups, WithMembers>;
      }

      return (await mapLimit(incubators, CONCURRENCY, async (incubator) => {
        const id = encodeURIComponent(incubator.ghid);
        const [startups, members] = await Promise.all([
          options.withStartups
            ? this.client.getCollection<IncubatorStartup>(
                `/incubators/${id}/startups`,
                {},
                fetchOptions,
              )
            : undefined,
          options.withMembers
            ? this.client.getCollection<IncubatorMember>(
                `/incubators/${id}/members`,
                {},
                fetchOptions,
              )
            : undefined,
        ]);
        return {
          ...incubator,
          ...(startups ? { startups } : {}),
          ...(members ? { members } : {}),
        };
      })) as GetAllReturn<WithStartups, WithMembers>;
    } catch (error: unknown) {
      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération des incubateurs. (${(error as Error).message})`,
        error instanceof EspaceMembreClientError ? error.response : undefined,
      );
    }
  }
}
