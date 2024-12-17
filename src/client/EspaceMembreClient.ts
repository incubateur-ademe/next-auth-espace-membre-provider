import type { EspaceMembreClient as Base } from ".";
import {
  name as packageName,
  version as packageVersion,
} from "../../package.json" with { type: "json" };
import { ApiMember } from "./api/Member";
import { EspaceMembreClientError } from "./error";
import { HttpStatusCode } from "./utils/HttpStatusCode";
import { exponentialBackoffWithJitter } from "./utils/exponentialBackoffWithJitter";

type CustomHeaders = Record<string, string>;

export interface ClientOptions {
  /**
   * Clef d'API pour se connecter à l'Espace Membre.
   *
   * @default process.env.ESPACE_MEMBRE_API_KEY
   */
  apiKey?: string;
  /**
   * Headers personnalisés à ajouter à chaque requête.
   */
  customHeaders?: CustomHeaders;
  /**
   * URL de l'Espace Membre.
   *
   * @default process.env.ESPACE_MEMBRE_URL "https://espace-membre.incubateur.net"
   */
  endpointUrl?: string;
  /**
   * Fonction de fetch à utiliser pour les requêtes.
   *
   * @see {@link Base.RegisterFetch}
   */
  fetch?: Base.RegisteredFetch;
  /**
   * Options à passer à la fonction de fetch pour chaque requête.
   *
   * @see {@link Base.RegisterFetch}
   */
  fetchOptions?: Base.RegisteredFetchOptions;
  /**
   * Ne pas réessayer la requête si le taux limite est atteint.
   *
   * @default false
   */
  noRetryIfRateLimited?: boolean;
  /**
   * Délai d'attente pour la requête en millisecondes.
   *
   * @default 300000 (5 minutes)
   */
  requestTimeout?: number;
}
const API_BASE_PATH = "/api/protected";
const defaultConfig: Required<ClientOptions> = {
  apiKey: process.env.ESPACE_MEMBRE_API_KEY ?? "",
  customHeaders: {},
  endpointUrl:
    process.env.ESPACE_MEMBRE_URL || "https://espace-membre.incubateur.net",
  fetch,
  fetchOptions: {},
  noRetryIfRateLimited: false,
  requestTimeout: 300 * 1000, // 5 minutes
};

const userAgent = `${packageName}@${packageVersion}`;

type Method = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
interface BaseRequestOptions {
  _numAttempts?: number;
  // body?: unknown; // TODO: Add support for request body
  headers?: Record<string, string>;
  method?: Lowercase<Method> | Method;
  path?: string;
  // qs?: Record<string, unknown>; // TODO: Add support for query string parameters
}

/**
 * Client pour l'API de l'Espace Membre.
 */
export class EspaceMembreClient {
  public readonly apiKey: string;
  public readonly customHeaders: CustomHeaders;
  public readonly endpointUrl: string;
  public readonly fetch: Base.RegisteredFetch;
  public readonly fetchOptions: Base.RegisteredFetchOptions;
  public readonly noRetryIfRateLimited: boolean;
  public readonly requestTimeout: number;

  constructor({
    apiKey,
    customHeaders,
    endpointUrl,
    fetch,
    fetchOptions,
    noRetryIfRateLimited,
    requestTimeout,
  }: ClientOptions) {
    this.apiKey = apiKey ?? defaultConfig.apiKey;
    this.customHeaders = customHeaders ?? defaultConfig.customHeaders;
    this.endpointUrl = endpointUrl ?? defaultConfig.endpointUrl;
    this.fetch = fetch ?? defaultConfig.fetch;
    this.fetchOptions = fetchOptions ?? defaultConfig.fetchOptions;
    this.noRetryIfRateLimited =
      noRetryIfRateLimited ?? defaultConfig.noRetryIfRateLimited;
    this.requestTimeout = requestTimeout ?? defaultConfig.requestTimeout;

    if (!this.apiKey) {
      throw new EspaceMembreClientError(
        "Une clef d'API est obligatoire pour se connecter à l'Espace Membre.",
      );
    }
  }

  /**
   * API pour les membres : "/api/protected/member".
   */
  public get member() {
    return new ApiMember(this);
  }

  public async makeRequest<T>(
    options: BaseRequestOptions = {},
    fetchOptions: Base.RegisteredFetchOptions = {},
  ) {
    const method = (options.method ?? "GET").toUpperCase();

    const url = new URL(
      `${API_BASE_PATH}${options.path ?? "/"}`,
      this.endpointUrl,
    );

    const controller = new AbortController();
    const headers = this.getRequestHeaders({
      ...this.customHeaders,
      ...(options.headers ?? {}),
    });

    const requestOptions: Base.RegisteredFetchOptions = {
      method,
      headers,
      signal: controller.signal,
      ...this.fetchOptions,
      ...fetchOptions,
    };

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.requestTimeout);

    return new Promise<T>((resolve, reject) => {
      this.fetch(url, requestOptions)
        .then((response) => {
          clearTimeout(timeout);

          if (
            response.status === HttpStatusCode.TooManyRequests &&
            !this.noRetryIfRateLimited
          ) {
            const numAttempts = options._numAttempts ?? 0;
            const backoffDelayMs = exponentialBackoffWithJitter(numAttempts);
            setTimeout(() => {
              const newOptions = {
                ...options,
                _numAttempts: numAttempts + 1,
              };
              this.makeRequest<T>(newOptions, fetchOptions)
                .then(resolve)
                .catch(reject);
            }, backoffDelayMs);
          } else if (!response.ok) {
            reject(
              new EspaceMembreClientError(
                `Une erreur est survenue lors de la requête. Code d'erreur : ${response.status}.`,
                response,
              ),
            );
          } else {
            response
              .json()
              .then(resolve)
              .catch((error: Error) => {
                reject(
                  new EspaceMembreClientError(
                    `Une erreur est survenue lors de la lecture de la réponse. (${error.message})`,
                    response,
                  ),
                );
              });
          }
        })
        .catch((error: Error) => {
          clearTimeout(timeout);
          reject(
            new EspaceMembreClientError(
              `Une erreur est survenue lors de la requête. (${error.message})`,
            ),
          );
        });
    });
  }

  private getRequestHeaders(headers: CustomHeaders = {}): CustomHeaders {
    const defaultHeaders: CustomHeaders = {
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
    };
    for (const [key, value] of Object.entries(headers)) {
      if (
        ![...Object.keys(headers)].some(
          (header) => header.toLowerCase() === key.toLowerCase(),
        )
      ) {
        defaultHeaders[key] = value;
      }
    }

    return defaultHeaders;
  }
}
