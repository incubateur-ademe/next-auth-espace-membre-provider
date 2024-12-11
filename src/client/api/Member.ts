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
      return this.client.makeRequest<Member>(
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
