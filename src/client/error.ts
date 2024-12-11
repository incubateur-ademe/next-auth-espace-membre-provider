export class EspaceMembreClientError extends Error {
  public name = "EspaceMembreClientError";
  constructor(
    message: string,
    public readonly response?: Response,
  ) {
    super(message);
  }
}

export class EspaceMembreClientMemberNotFoundError extends EspaceMembreClientError {
  public name = "EspaceMembreClientMemberNotFoundError";
  constructor(
    message: string,
    public readonly response?: Response,
  ) {
    super(message, response);
  }
}
