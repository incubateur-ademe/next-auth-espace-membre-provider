import { EspaceMembreClientError } from "../error";
import type { Member } from "../models";

/**
 * L'adresse à laquelle joindre un membre.
 *
 * La préférence `communication_email` l'emporte quand elle est rendue. Sinon, un membre
 * inactif est joint sur sa secondaire, sa principale étant une boîte beta.gouv que son
 * départ supprime. Un membre actif l'est sur sa principale. Chaque règle retombe sur
 * l'autre adresse quand la sienne manque.
 *
 * La même règle sert à l'envoi du lien et à la recherche de l'utilisateur en base, sans
 * quoi les deux ne désigneraient plus la même personne.
 *
 * @throws {EspaceMembreClientError} Si le membre n'a aucune adresse.
 */
export function getMemberEmail(
  member: Pick<
    Member,
    | "username"
    | "primary_email"
    | "secondary_email"
    | "isActive"
    | "communication_email"
  >,
): string {
  const preferSecondary =
    member.communication_email === "secondary" ||
    (member.communication_email !== "primary" && !member.isActive);
  const email = preferSecondary
    ? member.secondary_email || member.primary_email
    : member.primary_email || member.secondary_email;
  if (!email) {
    throw new EspaceMembreClientError(
      `Le membre ${member.username} n'a aucune adresse dans l'Espace Membre.`,
    );
  }
  return email;
}
