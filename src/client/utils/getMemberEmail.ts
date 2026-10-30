import { EspaceMembreClientError } from "../error";
import type { Member } from "../models";

/**
 * L'adresse à laquelle joindre un membre : la principale, à défaut la secondaire.
 *
 * L'API v1 ne rend plus la préférence que portait `communication_email`. La même règle
 * sert à l'envoi du lien et à la recherche de l'utilisateur en base, sans quoi les deux
 * ne désigneraient plus la même personne.
 *
 * @throws {EspaceMembreClientError} Si le membre n'a aucune adresse.
 */
export function getMemberEmail(
  member: Pick<Member, "username" | "primary_email" | "secondary_email">,
): string {
  const email = member.primary_email || member.secondary_email;
  if (!email) {
    throw new EspaceMembreClientError(
      `Le membre ${member.username} n'a aucune adresse dans l'Espace Membre.`,
    );
  }
  return email;
}
