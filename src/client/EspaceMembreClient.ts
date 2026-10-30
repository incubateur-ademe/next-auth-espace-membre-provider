import type { EspaceMembreClient as Base } from ".";
import {
  name as packageName,
  version as packageVersion,
} from "../../package.json" with { type: "json" };
import { ApiIncubator } from "./api/Incubator";
import { ApiMember } from "./api/Member";
import { ApiStartup } from "./api/Startup";
import { EspaceMembreClientError } from "./error";
import { HttpStatusCode } from "./utils/HttpStatusCode";
import { exponentialBackoffWithJitter } from "./utils/exponentialBackoffWithJitter";

type CustomHeaders = Record<string, string>;

export interface ClientOptions {
  /**
   * Clef d'API v1 (`em1…`), créée depuis l'Espace Membre. Elle part en
   * `Authorization: Bearer`.
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
   * L'ancienne adresse, `espace-membre.incubateur.net`, redirige vers une autre origine,
   * et `fetch` retire alors l'en-tête `Authorization`.
   *
   * @default process.env.ESPACE_MEMBRE_URL "https://espace-membre.beta.gouv.fr"
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
const API_BASE_PATH = "/api/v1";
/** Le maximum que l'API accepte. */
const PAGE_SIZE = 100;
/** Au-delà, le 429 remonte, une connexion ne devant pas attendre indéfiniment. */
const MAX_RATE_LIMIT_RETRIES = 3;
const defaultConfig: Required<ClientOptions> = {
  apiKey: process.env.ESPACE_MEMBRE_API_KEY ?? "",
  customHeaders: {},
  endpointUrl:
    process.env.ESPACE_MEMBRE_URL || "https://espace-membre.beta.gouv.fr",
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
  }

  /**
   * API pour les membres : "/api/v1/members".
   */
  public get member() {
    return new ApiMember(this);
  }

  /**
   * API pour les startups : "/api/v1/startups".
   */
  public get startup() {
    return new ApiStartup(this);
  }

  /**
   * API pour les incubateurs : "/api/v1/incubators".
   */
  public get incubator() {
    return new ApiIncubator(this);
  }

  public async makeRequest<T>(
    options: BaseRequestOptions = {},
    fetchOptions: Base.RegisteredFetchOptions = {},
  ) {
    // Validé ici (au moment de l'appel) et non dans le constructeur : instancier le
    // client ne doit pas throw (sinon le build des consommateurs casse au module-load,
    // ex. provider NextAuth eager), seul un vrai appel sans clé doit échouer.
    if (!this.apiKey) {
      throw new EspaceMembreClientError(
        "Une clef d'API est obligatoire pour se connecter à l'Espace Membre.",
      );
    }

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

    // Les en-têtes passés en options de fetch s'ajoutent à ceux du client au lieu de
    // les remplacer, et avec eux l'autorisation.
    const mergedHeaders = new Headers(headers);
    for (const extra of [this.fetchOptions?.headers, fetchOptions?.headers]) {
      new Headers(extra).forEach((value, key) => {
        mergedHeaders.set(key, value);
      });
    }

    const requestOptions: Base.RegisteredFetchOptions = {
      ...this.fetchOptions,
      ...fetchOptions,
      method,
      headers: mergedHeaders,
      signal: controller.signal,
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
            !this.noRetryIfRateLimited &&
            (options._numAttempts ?? 0) < MAX_RATE_LIMIT_RETRIES
          ) {
            void response.body?.cancel();
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
            problemDetail(response).then((detail) => {
              reject(
                new EspaceMembreClientError(
                  `Une erreur est survenue lors de la requête. Code d'erreur : ${response.status}.${detail ? ` (${detail})` : ""}`,
                  response,
                ),
              );
            });
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

  /**
   * Une ressource unitaire, extraite de son enveloppe `{ data }`.
   *
   * @throws {EspaceMembreClientError} Si la réponse n'a pas d'enveloppe.
   */
  public async getOne<T>(
    path: string,
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<T> {
    const body = await this.makeRequest<unknown>(
      { method: "GET", path },
      fetchOptions,
    );
    if (!isObject(body) || !("data" in body)) {
      throw new EspaceMembreClientError(
        `La réponse de ${path} n'a pas d'enveloppe { data }.`,
      );
    }
    return body.data as T;
  }

  /**
   * Une collection entière, lue page après page dans ses enveloppes `{ data, meta }`.
   *
   * Une lecture incomplète lève au lieu de rendre une liste partielle. Quatre cas sont
   * refusés : un total qui change entre deux pages, une page qui ne commence pas au
   * décalage demandé, une page vide avant le total annoncé, un même `uuid` lu deux fois.
   * Un départ et une arrivée croisés entre deux pages restent invisibles.
   *
   * @param query Paramètres de requête, hors `limit` et `offset`.
   * @throws {EspaceMembreClientError} Si une page manque ou se contredit.
   */
  public async getCollection<T>(
    path: string,
    query: Record<string, string> = {},
    fetchOptions?: Base.RegisteredFetchOptions,
  ): Promise<T[]> {
    const items: unknown[] = [];
    let total: number | null = null;

    while (total === null || items.length < total) {
      const params = new URLSearchParams({
        ...query,
        limit: String(PAGE_SIZE),
        offset: String(items.length),
      });
      const body = await this.makeRequest<unknown>(
        { method: "GET", path: `${path}?${params}` },
        fetchOptions,
      );
      const page = readPage(body);
      if (!page) {
        throw new EspaceMembreClientError(
          `La réponse de ${path} n'a pas d'enveloppe { data, meta }.`,
        );
      }
      if (total !== null && page.total !== total) {
        throw new EspaceMembreClientError(
          `Le total de ${path} a changé en cours de lecture (${total} puis ${page.total}).`,
        );
      }
      if (page.offset !== items.length) {
        throw new EspaceMembreClientError(
          `${path} a rendu le décalage ${page.offset} au lieu de ${items.length}.`,
        );
      }
      if (page.data.length === 0 && items.length < page.total) {
        throw new EspaceMembreClientError(
          `${path} a rendu une page vide après ${items.length} éléments sur ${page.total}.`,
        );
      }
      total = page.total;
      items.push(...page.data);
    }

    if (items.length !== total) {
      throw new EspaceMembreClientError(
        `${path} a rendu ${items.length} éléments pour un total de ${total}.`,
      );
    }
    const seen = new Set<unknown>();
    for (const item of items) {
      const uuid = isObject(item) ? item.uuid : undefined;
      if (uuid === undefined) {
        continue;
      }
      if (seen.has(uuid)) {
        throw new EspaceMembreClientError(
          `${path} a rendu ${String(uuid)} deux fois en cours de lecture.`,
        );
      }
      seen.add(uuid);
    }
    return items as T[];
  }

  private getRequestHeaders(headers: CustomHeaders = {}): CustomHeaders {
    const result: CustomHeaders = {
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    for (const [key, value] of Object.entries(headers)) {
      for (const existing of Object.keys(result)) {
        if (existing.toLowerCase() === key.toLowerCase()) {
          delete result[existing];
        }
      }
      result[key] = value;
    }

    return result;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPage(
  body: unknown,
): { data: unknown[]; total: number; offset: number } | null {
  if (!isObject(body) || !Array.isArray(body.data) || !isObject(body.meta)) {
    return null;
  }
  const { total, offset } = body.meta;
  if (
    typeof total !== "number" ||
    typeof offset !== "number" ||
    !Number.isInteger(total) ||
    !Number.isInteger(offset)
  ) {
    return null;
  }
  return { data: body.data, total, offset };
}

/** Le `detail` (ou à défaut le `title`) d'une erreur RFC 9457, quand le corps en est une. */
async function problemDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json();
    if (isObject(body)) {
      const detail = body.detail ?? body.title;
      return typeof detail === "string" ? detail : null;
    }
  } catch {
    // Corps absent ou illisible, le code HTTP suffit.
  }
  return null;
}
