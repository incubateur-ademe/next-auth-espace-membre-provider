export type Member = {
  avatar: string | null;
  bio: string;
  communication_email: string;
  competences: string[];
  domaine: string;
  email_is_redirection: boolean;
  fullname: string;
  github: string;
  link: string;
  mattermost: Mattermost;
  missions: Mission[];
  primary_email: string;
  primary_email_status: string;
  primary_email_status_updated_at: string;
  role: string;
  secondary_email: string;
  startups: Startup[];
  teams: Team[];
  updated_at: string;
  username: string;
  uuid: string;
};

export type Mission = {
  employer: string;
  end: string;
  id: number;
  start: string;
  startups: string[];
  status: string;
  user_id: string;
  uuid: string;
};

export type Team = {
  ghid: string;
  incubator: Incubator;
  incubator_id: string;
  incubator_title: string;
  mission: null;
  name: string;
  uuid: string;
};

export type Incubator = {
  address: string;
  contact: string;
  description: string;
  ghid: string;
  github: string;
  highlighted_startups: string[];
  owner_id: string;
  short_description: string;
  title: string;
  uuid: string;
  website: string;
};

export type Mattermost = {
  mattermostUser: MattermostUser;
  mattermostUserInTeamAndActive: MattermostUser;
};

export type MattermostUser = {
  auth_data: string;
  auth_service: string;
  create_at: number;
  delete_at: number;
  disable_welcome_email: boolean;
  email: string;
  first_name: string;
  id: string;
  last_name: string;
  last_picture_update: number;
  locale: string;
  nickname: string;
  position: string;
  props: MattermostUserProps;
  roles: string;
  timezone: MattermostTimezone;
  update_at: number;
  username: string;
};

export type MattermostUserProps = {
  customStatus: string;
  last_search_pointer: string;
  show_last_active: string;
};

export type MattermostTimezone = {
  automaticTimezone: string;
  manualTimezone: string;
  useAutomaticTimezone: string;
};

export type Startup = {
  end: string;
  ghid: string;
  incubator: Incubator;
  incubator_id: string;
  isCurrent: boolean;
  name: string;
  start: string;
  uuid: string;
};