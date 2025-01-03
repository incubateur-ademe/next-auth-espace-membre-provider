import type { EspaceMembreClient as Base } from "../";
import type { EspaceMembreClient } from "../EspaceMembreClient";
import {
  EspaceMembreClientError,
  EspaceMembreClientMemberNotFoundError,
} from "../error";
import type { Member } from "../types";
import { HttpStatusCode } from "../utils/HttpStatusCode";

export class ApiMember {
  constructor(protected client: EspaceMembreClient) {}

  /**
   * Récupère un membre par son nom d'utilisateur.
   *
   * @param username Nom d'utilisateur du membre à récupérer.
   * @param fetchOptions Options de fetch à utiliser pour la requête.
   *
   * @throws {EspaceMembreClientError} Si une erreur est survenue lors de la récupération du membre.
   * @throws {EspaceMembreClientMemberNotFoundError} Si aucun membre n'a été trouvé avec le nom d'utilisateur donné.
   */
  public async getByUsername(
    username: string,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<Member> {
    if (!username) {
      throw new EspaceMembreClientError(
        "Pour récupérer un membre, le nom d'utilisateur est obligatoire et ne peut pas être vide.",
      );
    }

    try {
      // we have to await here to catch the error
      return await this.client.makeRequest<Member>(
        {
          method: "GET",
          path: `/member/${encodeURIComponent(username)}`,
        },
        fetchOptions,
      );
    } catch (error: unknown) {
      if (
        error instanceof EspaceMembreClientError &&
        error.response?.status === HttpStatusCode.NotFound
      ) {
        throw new EspaceMembreClientMemberNotFoundError(
          `Aucun membre trouvé avec le nom d'utilisateur ${username}.`,
          error.response,
        );
      }

      throw new EspaceMembreClientError(
        `Une erreur est survenue lors de la récupération du membre ${username}. (${(error as Error).message})`,
      );
    }
  }
}
