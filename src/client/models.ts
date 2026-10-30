/**
 * Modèles de l'API v1 de l'Espace Membre (`/api/v1`), tels que les décrit son document
 * OpenAPI (`/api/v1/openapi.json`).
 */

export type IncubatorRef = {
  uuid: string;
  ghid: string;
  title: string;
};

export type Incubator = {
  uuid: string;
  title: string;
  ghid: string;
  short_description: string | null;
  description: string | null;
  contact: string | null;
  address: string | null;
  website: string | null;
  github: string | null;
  highlighted_startups: string[];
};

export type Phase = {
  name: string;
  start: string | null;
  end: string | null;
};

export type Startup = {
  uuid: string;
  ghid: string;
  name: string;
  pitch: string | null;
  incubator_id: string | null;
  /** Tous les incubateurs liés, y compris hors du périmètre de la clef. */
  incubators: IncubatorRef[];
  contact: string | null;
  description: string | null;
  link: string | null;
  repository: string | null;
  accessibility_status: string | null;
  dsfr_status: string | null;
  techno: string[];
  thematiques: string[];
  usertypes: string[];
  phases: Phase[];
  current_phase: string | null;
};

export type StartupWithIncubator = Startup & {
  /** L'incubateur principal, celui que désigne `incubator_id`. */
  incubator: IncubatorRef | null;
};

/** Produit tel que le rend la liste des produits d'un incubateur. */
export type IncubatorStartup = {
  uuid: string;
  ghid: string;
  name: string;
  pitch: string | null;
  phases: Phase[];
  current_phase: string | null;
};

export type MissionStartup = {
  uuid: string;
  ghid: string;
};

export type Mission = {
  uuid?: string;
  start: string | null;
  end?: string | null;
  status?: string | null;
  employer?: string | null;
  startups?: MissionStartup[];
};

export type Team = {
  uuid: string;
  name: string;
  mission?: string | null;
  ghid?: string | null;
  incubator: IncubatorRef | null;
};

export type MemberStartup = {
  uuid: string;
  ghid: string | null;
  name: string | null;
  start: string | null;
  end: string | null;
  incubator_id: string | null;
  incubator: IncubatorRef | null;
  incubators: IncubatorRef[];
  isCurrent: boolean;
};

/** Fiche complète d'un membre (`GET /api/v1/members/{id}`). */
export type Member = {
  uuid: string;
  username: string;
  fullname: string;
  role?: string | null;
  domaine?: string | null;
  bio?: string | null;
  link?: string | null;
  github?: string | null;
  primary_email: string | null;
  secondary_email: string | null;
  competences?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  missions: Mission[];
  teams: Team[] | null;
  startups: MemberStartup[];
  avatar: string | null;
  isActive: boolean;
  /**
   * Adresse choisie par le membre. Absente de l'API v1 à ce jour, et prise en compte par
   * `getMemberEmail` dès qu'elle y apparaît.
   */
  communication_email?: "primary" | "secondary" | null;
};

/** Membre tel que le rend la liste des membres d'un incubateur. */
export type IncubatorMember = {
  uuid: string;
  username: string;
  fullname: string;
  github: string | null;
  primary_email: string | null;
  secondary_email: string | null;
  missions: Mission[];
  /** Voie par laquelle le membre relève de l'incubateur. */
  attachment: "startups" | "teams" | "both";
  teams: string[];
};

export type IncubatorWithMembers = Incubator & {
  members: IncubatorMember[];
};

export type IncubatorWithStartups = Incubator & {
  startups: IncubatorStartup[];
};
