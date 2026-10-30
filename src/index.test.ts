import type { Adapter } from "next-auth/adapters";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";
import { describe, expect, it, vi } from "vitest";
import { ESPACE_MEMBRE_PROVIDER_ID, EspaceMembreProvider } from ".";
import {
  EspaceMembreClient,
  EspaceMembreClientError,
  EspaceMembreClientMemberNotFoundError,
} from "./client";

const ORIGIN = "https://em.exemple.invalid";

type Call = {
  url: string;
  authorization: string | null;
  custom: string | null;
};

/** Un transport doublé : chaque URL complète a sa réponse, les autres répondent 404. */
function transport(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      authorization: headers.get("authorization"),
      custom: headers.get("x-trace"),
    });
    const route = routes[url];
    return route
      ? route()
      : Response.json(
          { type: "about:blank", title: "Not Found", status: 404 },
          { status: 404 },
        );
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

function member(
  username: string,
  emails: { primary: string | null; secondary: string | null },
) {
  return {
    uuid: `uuid-${username}`,
    username,
    fullname: `Nom de ${username}`,
    primary_email: emails.primary,
    secondary_email: emails.secondary,
    missions: [],
    teams: [],
    startups: [],
    avatar: null,
    isActive: true,
  };
}

const page =
  (data: unknown[], total: number, offset = 0) =>
  () =>
    Response.json({
      data,
      meta: { total, limit: 100, offset, perimeter: "global" },
    });

describe("la connexion par l'Espace Membre", () => {
  it("résout un username en adresse par l'API v1, la même pour l'envoi du lien et pour la base", async () => {
    // Given un membre sans adresse principale, et un autre absent de l'Espace Membre
    const { calls, fetch } = transport({
      [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
        Response.json({
          data: member("camille.exemple", {
            primary: null,
            secondary: "camille@perso.invalid",
          }),
        }),
    });
    const provider = EspaceMembreProvider({
      espaceMembreApiKey: "em1_cle",
      espaceMembreUrl: ORIGIN,
      fetch,
      authOptions: { allowInactive: false },
    });

    const sendVerificationRequest = vi.fn(async () => {});
    const config = provider.ProviderWrapper({
      id: "nodemailer",
      type: "email",
      name: "Nodemailer",
      server: {},
      from: "outil@exemple.invalid",
      maxAge: 1800,
      sendVerificationRequest,
      options: {},
    } as unknown as NodemailerConfig);

    // When le lien est envoyé pour ce username
    await config.sendVerificationRequest({
      identifier: "camille.exemple",
    } as Parameters<NodemailerConfig["sendVerificationRequest"]>[0]);

    // Then il part à la seule adresse connue, et la requête vise la v1 en Bearer
    expect(sendVerificationRequest).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "camille@perso.invalid" }),
    );
    expect(calls[0]).toEqual({
      url: `${ORIGIN}/api/v1/members/camille.exemple`,
      authorization: "Bearer em1_cle",
      custom: null,
    });

    // When l'adaptateur cherche l'utilisateur par ce username
    const getUserByEmail = vi.fn(async () => null);
    const adapter = provider.AdapterWrapper({
      createUser: vi.fn(),
      getUserByEmail,
    } as unknown as Adapter);
    await adapter.getUserByEmail?.("camille.exemple");

    // Then il cherche la même adresse que celle du lien
    expect(getUserByEmail).toHaveBeenCalledWith("camille@perso.invalid");

    // When la connexion est validée
    const callbacks = provider.CallbacksWrapper({});
    const user = { email: "camille.exemple" } as {
      email: string;
      name?: string;
      id?: string;
    };
    const account = { provider: ESPACE_MEMBRE_PROVIDER_ID } as {
      provider: string;
      userId?: string;
    };
    const accepted = await callbacks.signIn?.({
      user,
      account,
      email: { verificationRequest: true },
    } as never);

    // Then la session porte le nom et l'adresse de la fiche, et le username comme identifiant
    expect(accepted).toBe(true);
    expect(user).toMatchObject({
      name: "Nom de camille.exemple",
      email: "camille@perso.invalid",
      id: "camille.exemple",
    });
    expect(account.userId).toBe("camille.exemple");

    // When un username inconnu demande un lien
    const refused = await callbacks.signIn?.({
      user: { email: "inconnu.exemple" },
      account: { provider: ESPACE_MEMBRE_PROVIDER_ID },
      email: { verificationRequest: true },
    } as never);

    // Then la connexion est refusée sans erreur
    expect(refused).toBe(false);
    await expect(
      provider.client.member.getByUsername("inconnu.exemple"),
    ).rejects.toBeInstanceOf(EspaceMembreClientMemberNotFoundError);
  });

  it("dit pourquoi l'Espace Membre refuse, et ne confond pas un refus avec un membre absent", async () => {
    // Given une clef sans la portée members:read
    const { fetch } = transport({
      [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
        Response.json(
          {
            type: "about:blank",
            title: "Forbidden",
            status: 403,
            detail: "portée members:read manquante",
          },
          { status: 403 },
        ),
    });
    const client = new EspaceMembreClient({
      apiKey: "em1_cle",
      endpointUrl: ORIGIN,
      fetch,
    });

    // Then l'erreur porte le détail RFC 9457 et la réponse, et ce n'est pas un « introuvable »
    const error = await client.member
      .getByUsername("camille.exemple")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EspaceMembreClientError);
    expect(error).not.toBeInstanceOf(EspaceMembreClientMemberNotFoundError);
    expect((error as Error).message).toMatch(
      /403.*portée members:read manquante/u,
    );
    expect((error as EspaceMembreClientError).response?.status).toBe(403);

    // Given un membre sans aucune adresse
    const sansAdresse = transport({
      [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
        Response.json({
          data: member("camille.exemple", { primary: null, secondary: null }),
        }),
    });
    const provider = EspaceMembreProvider({
      espaceMembreApiKey: "em1_cle",
      espaceMembreUrl: ORIGIN,
      fetch: sansAdresse.fetch,
    });
    const config = provider.ProviderWrapper({
      id: "nodemailer",
      type: "email",
      sendVerificationRequest: vi.fn(),
      options: {},
    } as unknown as NodemailerConfig);

    // Then aucun lien ne part vers une adresse vide
    await expect(
      config.sendVerificationRequest({
        identifier: "camille.exemple",
      } as never),
    ).rejects.toThrow(/aucune adresse/u);
  });

  it("retrouve l'utilisateur créé avec sa secondaire, et refuse sans planter un username inconnu ou mal formé", async () => {
    // Given un membre qui a ses deux adresses, enregistré en base avec la secondaire
    const { fetch } = transport({
      [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
        Response.json({
          data: member("camille.exemple", {
            primary: "camille@beta.invalid",
            secondary: "camille@perso.invalid",
          }),
        }),
      [`${ORIGIN}/api/v1/members/camille%2540perso.invalid`]: () =>
        Response.json(
          { type: "about:blank", title: "Unprocessable", status: 422 },
          { status: 422 },
        ),
    });
    const provider = EspaceMembreProvider({
      espaceMembreApiKey: "em1_cle",
      espaceMembreUrl: ORIGIN,
      fetch,
    });
    const enBase = { id: "u-1", email: "camille@perso.invalid" };
    const getUserByEmail = vi.fn(async (email: string) =>
      email === enBase.email ? enBase : null,
    );
    const adapter = provider.AdapterWrapper({
      createUser: vi.fn(),
      getUserByEmail,
    } as unknown as Adapter);

    // When l'adaptateur cherche ce membre par son username
    const trouve = await adapter.getUserByEmail?.("camille.exemple");

    // Then il essaie la principale, puis retrouve la ligne existante par la secondaire
    expect(getUserByEmail.mock.calls.map(([email]) => email)).toEqual([
      "camille@beta.invalid",
      "camille@perso.invalid",
    ]);
    expect(trouve).toBe(enBase);

    // When un username inconnu, puis une adresse saisie à la place du username, arrivent
    // jusqu'à l'adaptateur et au callback, comme NextAuth les y fait passer
    const callbacks = provider.CallbacksWrapper({});
    for (const saisie of ["inconnu.exemple", "camille%40perso.invalid"]) {
      await expect(
        adapter.getUserByEmail?.(saisie),
        saisie,
      ).resolves.toBeNull();
      await expect(
        callbacks.signIn?.({
          user: { email: saisie },
          account: { provider: ESPACE_MEMBRE_PROVIDER_ID },
          email: { verificationRequest: true },
        } as never),
        saisie,
      ).resolves.toBe(false);
    }
  });
});

describe("le transport du client", () => {
  it("garde l'autorisation quand l'appelant passe ses en-têtes, et cesse de réessayer un 429", async () => {
    vi.useFakeTimers();
    try {
      // Given un appelant qui passe ses propres en-têtes dans les options de fetch
      const { calls, fetch } = transport({
        [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
          Response.json({
            data: member("camille.exemple", {
              primary: "camille@beta.invalid",
              secondary: null,
            }),
          }),
      });
      const client = new EspaceMembreClient({
        apiKey: "em1_cle",
        endpointUrl: ORIGIN,
        fetch,
        fetchOptions: { headers: { "X-Trace": "abc" } },
      });

      // Then la clef part toujours, avec l'en-tête de l'appelant
      await client.member.getByUsername("camille.exemple");
      expect(calls[0]).toMatchObject({
        authorization: "Bearer em1_cle",
        custom: "abc",
      });

      // Given une API qui répond 429 sans fin
      const limitee = transport({
        [`${ORIGIN}/api/v1/members/camille.exemple`]: () =>
          new Response(null, { status: 429 }),
      });
      const patient = new EspaceMembreClient({
        apiKey: "em1_cle",
        endpointUrl: ORIGIN,
        fetch: limitee.fetch,
      });

      // When le temps des réessais s'écoule
      const attente = patient.member
        .getByUsername("camille.exemple")
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      // Then le 429 remonte après la première tentative et trois réessais
      expect((await attente) as Error).toBeInstanceOf(EspaceMembreClientError);
      expect(limitee.calls).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("les collections de l'API v1", () => {
  it("lit toutes les pages, rattache l'incubateur principal, et refuse une lecture qui se contredit", async () => {
    const startups = Array.from({ length: 120 }, (_, index) => ({
      uuid: `s-${index}`,
      ghid: `produit-${index}`,
      name: `Produit ${index}`,
      incubator_id: "i-1",
      incubators: [
        { uuid: "i-2", ghid: "autre", title: "Autre" },
        { uuid: "i-1", ghid: "principal", title: "Principal" },
      ],
      phases: [],
      current_phase: "construction",
    }));
    const base = `${ORIGIN}/api/v1/startups`;

    // Given 120 startups servies en deux pages, filtrées par phase
    const { calls, fetch } = transport({
      [`${base}?phase=construction%2Cacceleration&limit=100&offset=0`]: page(
        startups.slice(0, 100),
        120,
      ),
      [`${base}?phase=construction%2Cacceleration&limit=100&offset=100`]: page(
        startups.slice(100),
        120,
        100,
      ),
    });
    const client = new EspaceMembreClient({
      apiKey: "em1_cle",
      endpointUrl: ORIGIN,
      fetch,
      customHeaders: { "X-Trace": "abc" },
    });

    // When on les lit avec leur incubateur
    const lues = await client.startup.getAll({
      withIncubator: true,
      phases: ["construction", "acceleration"],
    });

    // Then les deux pages sont lues, l'incubateur est celui de incubator_id, et l'en-tête
    // personnalisé accompagne chaque requête
    expect(lues).toHaveLength(120);
    expect(lues[119]?.incubator).toEqual({
      uuid: "i-1",
      ghid: "principal",
      title: "Principal",
    });
    expect(calls.map((call) => call.custom)).toEqual(["abc", "abc"]);

    // Given un total qui change, un décalage ignoré, une page vide, un doublon
    const cas: [string, Record<string, () => Response>, RegExp][] = [
      [
        "total",
        {
          [`${base}?limit=100&offset=0`]: page(startups.slice(0, 100), 120),
          [`${base}?limit=100&offset=100`]: page(
            startups.slice(100, 119),
            119,
            100,
          ),
        },
        /120 puis 119/u,
      ],
      [
        "décalage",
        {
          [`${base}?limit=100&offset=0`]: page(startups.slice(0, 100), 120),
          [`${base}?limit=100&offset=100`]: page(
            startups.slice(0, 100),
            120,
            0,
          ),
        },
        /décalage 0 au lieu de 100/u,
      ],
      [
        "page vide",
        {
          [`${base}?limit=100&offset=0`]: page(startups.slice(0, 100), 120),
          [`${base}?limit=100&offset=100`]: page([], 120, 100),
        },
        /page vide/u,
      ],
      [
        "doublon",
        {
          [`${base}?limit=100&offset=0`]: page(startups.slice(0, 100), 120),
          [`${base}?limit=100&offset=100`]: page(
            [...startups.slice(101), startups[0]],
            120,
            100,
          ),
        },
        /s-0 deux fois/u,
      ],
      [
        "enveloppe",
        { [`${base}?limit=100&offset=0`]: () => Response.json(startups) },
        /enveloppe/u,
      ],
    ];

    // Then chacune lève au lieu de rendre une liste partielle
    for (const [nom, routes, motif] of cas) {
      const fautif = new EspaceMembreClient({
        apiKey: "em1_cle",
        endpointUrl: ORIGIN,
        fetch: transport(routes).fetch,
      });
      await expect(fautif.startup.getAll(), nom).rejects.toThrow(motif);
    }
  });

  it("complète chaque incubateur par ses propres routes de produits et de membres", async () => {
    const incubateur = (ghid: string) => ({
      uuid: `uuid-${ghid}`,
      title: ghid,
      ghid,
      highlighted_startups: [],
    });
    const { calls, fetch } = transport({
      [`${ORIGIN}/api/v1/incubators?limit=100&offset=0`]: page(
        [incubateur("a"), incubateur("b")],
        2,
      ),
      [`${ORIGIN}/api/v1/incubators/a/members?limit=100&offset=0`]: page(
        [
          {
            uuid: "m-1",
            username: "m.un",
            fullname: "M Un",
            attachment: "startups",
            teams: [],
          },
        ],
        1,
      ),
      [`${ORIGIN}/api/v1/incubators/b/members?limit=100&offset=0`]: page([], 0),
    });
    const client = new EspaceMembreClient({
      apiKey: "em1_cle",
      endpointUrl: ORIGIN,
      fetch,
    });

    // When on lit les incubateurs avec leurs membres
    const incubateurs = await client.incubator.getAll({ withMembers: true });

    // Then chacun porte ses membres, sans que les produits aient été demandés
    expect(
      incubateurs.map(({ ghid, members }) => [
        ghid,
        members.map((m) => m.username),
      ]),
    ).toEqual([
      ["a", ["m.un"]],
      ["b", []],
    ]);
    expect(calls.some((call) => call.url.includes("/startups"))).toBe(false);

    // When on les lit sans rien d'autre
    const seuls = await client.incubator.getAll();

    // Then une seule requête part, et aucun incubateur ne porte de membres
    expect(seuls[0]).not.toHaveProperty("members");
  });
});
