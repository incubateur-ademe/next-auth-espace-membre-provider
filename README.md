# Espace Membre Provider pour NextAuth.js
## Installation
```bash
npm install @incubateur-ademe/next-auth-espace-membre-provider
```

## Clef d'API

Le provider et le client lisent l'API v1 de l'Espace Membre (`/api/v1`, documentée sur
[`/api/docs`](https://espace-membre.beta.gouv.fr/api/docs)). Il faut une clef v1 (`em1…`),
créée depuis l'Espace Membre, envoyée en `Authorization: Bearer`.

- La connexion demande la portée `members:read`.
- `client.startup` demande `startups:read`, `client.incubator` demande `incubators:read`, plus
  `startups:read` ou `members:read` avec `withStartups` ou `withMembers`.
- Une fiche hors du périmètre de la clef répond 403. Pour que n'importe quel membre puisse
  se connecter, la clef doit avoir le périmètre global.

## Utilisation
```typescript
// fichier "auth.ts" où vous configurez NextAuth.js
import { EspaceMembreProvider } from '@incubateur-ademe/next-auth-espace-membre-provider';
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";

const espaceMembreProvider = EspaceMembreProvider({
  espaceMembreApiKey: "em1_...", // optionnel, par défaut `process.env.ESPACE_MEMBRE_API_KEY` ou ""
  espaceMembreUrl: "https://espace-membre.beta.gouv.fr", // optionnel, par défaut `process.env.ESPACE_MEMBRE_URL` ou cette adresse
  fetch, // optionnel, par défaut le `fetch` de base (permet de récupérer celui de Next par exemple)
  fetchOptions: { // optionnel, par défaut {} (permet de passer des options spécifiques à Next par exemple)
    next: {
      revalidate: 300, // 5 minutes
    },
    cache: "default",
  },
  authOptions: {
    allowInactive: true, // optionnel, par défaut `false` (permet d'autoriser les membres inactifs à se connecter)
  }
});

export default NextAuth({
  adapter: espaceMembreProvider.AdapterWrapper(PrismaAdapter(prisma)),
  providers: [
    espaceMembreProvider.ProviderWrapper(
      Nodemailer({
        server: process.env.EMAIL_SERVER,
        from: process.env.EMAIL_FROM,
      }),
    ),
  ],
  callbacks: espaceMembreProvider.CallbacksWrapper({
    async signIn(user, account, profile) {
      // non obligatoire. Le wrapper s'occupe ici de valider le nom d'utilisateur.
      // vous récupérez alors le "user" avec le nom d'utilisateur validé, et "account.userId" correctement renseigné
    },
    async jwt(token, user, account, espaceMembreMember /* nouvelle propriété */) {
      // vous pouvez si vous le souhaitez compléter le token avec des informations de l'espace membre
    },
  }),
  // ...
});
```

### Client interne
```typescript
import { EspaceMembreClient, getMemberEmail, type Member } from '@incubateur-ademe/next-auth-espace-membre-provider/EspaceMembreClient';

const client = new EspaceMembreClient({
    apiKey: "em1_...", // optionnel, par défaut `process.env.ESPACE_MEMBRE_API_KEY` ou ""
    fetch, // optionnel, par défaut le `fetch` de base (permet de récupérer celui de Next par exemple)
    fetchOptions: { // optionnel, par défaut {} (permet de passer des options spécifiques à Next par exemple)
        next: {
            revalidate: 300, // 5 minutes
        },
        cache: "default",
    },
  });

const member: Member = await client.member.getByUsername("nom-d-utilisateur");
const email = getMemberEmail(member); // adresse principale, à défaut secondaire
```

Les listes (`startup.getAll`, `incubator.getAll`) sont lues page après page. Une lecture qui
se contredit (total qui change, page manquante, élément lu deux fois) lève une
`EspaceMembreClientError`. Un départ et une arrivée croisés entre deux pages restent
invisibles. Une liste ne rend que ce que couvre le périmètre de la clef, sans erreur.

#### ℹ️ Fetch custom
Pour enregistrer une implémentation de fetch personnalisée, vous devez fournir une fonction `fetch` qui se comporte comme la fonction native `fetch`. Cette fonction sera utilisée pour effectuer des requêtes à l'API de l'Espace Membre.

```typescript
import { EspaceMembreClient } from '@incubateur-ademe/next-auth-espace-membre-provider/EspaceMembreClient';
import { myCustomFetch } from './myCustomFetch';

declare module "@incubateur-ademe/next-auth-espace-membre-provider/EspaceMembreClient" {
 namespace EspaceMembreClient {
  interface RegisterFetch {
   fetch: typeof myCustomFetch;
  }
 }
}

const client = new EspaceMembreClient({
  fetch: myCustomFetch,
});
```

## Configuration additionnelle
Si besoin, vous pouvez ajouter des variables d'environnement pour configurer le client utilisé par le provider.
```bash
ESPACE_MEMBRE_API_KEY=em1_...
ESPACE_MEMBRE_URL=https://espace-membre.beta.gouv.fr # pour changer l'URL de l'API en local par exemple
```

### Dans la table `User` en base de données
- `username` est à ajouter pour stocker le nom d'utilisateur de l'espace membre
- `isBetaGouvMember` est à ajouter pour attester que l'utilisateur vient de beta.gouv

## Passer de 0.3 à 1.0

La 1.0 quitte l'API `/api/protected` pour l'API v1. Ce qui change pour un consommateur :

- **La clef.** Une clef v1 `em1…` remplace l'ancienne clef `X-API-Key`.
- **L'adresse.** Le défaut devient `https://espace-membre.beta.gouv.fr`. Une adresse passée
  explicitement (`endpointUrl`, `espaceMembreUrl`, `ESPACE_MEMBRE_URL`) qui vise encore
  `espace-membre.incubateur.net` doit changer aussi. Elle redirige vers une autre origine,
  `fetch` y retire l'en-tête `Authorization`, et l'API répond 401.
- **Le périmètre.** Les listes ne rendent que ce que couvre le périmètre de la clef, sans
  erreur. Une clef de périmètre global les rend entières.
- **Les refus.** Un membre hors du périmètre de la clef lève une `EspaceMembreClientError` de
  statut 403, et non `EspaceMembreClientMemberNotFoundError`. Un identifiant mal formé
  (422) lève `EspaceMembreClientMemberNotFoundError`, comme un 404.
- **`communication_email` disparaît.** Le lien part à l'adresse principale, à défaut la
  secondaire (`getMemberEmail`). L'adaptateur cherche l'utilisateur en base par cette
  adresse, puis par la secondaire à condition que la ligne porte le même `username`. Un
  utilisateur créé en 0.3 avec sa secondaire mais sans `username` ne sera plus retrouvé.
- **`Member`** suit la fiche v1.
  - Disparaissent `communication_email`, `mattermost`, `primary_email_status`,
    `primary_email_status_updated_at` et `email_is_redirection`.
  - `primary_email` et `secondary_email` peuvent valoir `null`, tout comme `teams`.
    `role`, `domaine`, `bio`, `link`, `github` et `competences` deviennent facultatifs.
  - `teams[].incubator` et `startups[].incubator` deviennent des références
    `{ uuid, ghid, title }`, qui peuvent valoir `null`. `startups[].ghid` et
    `startups[].name` aussi.
  - `missions[].startups` passe de `string[]` à `{ uuid, ghid }[]`. `missions[].id` et
    `missions[].user_id` disparaissent.
- **`Startup`** suit la v1.
  - `incubators` liste tous les incubateurs liés. `phases` et `current_phase` apparaissent.
  - Plusieurs champs facultatifs disparaissent (`sponsors`, `fast`, `budget_url`…).
  - `withIncubator` rattache une référence `{ uuid, ghid, title }`, ou `null`.
- **`Incubator`** suit la v1. `owner_id` disparaît. `description` et `short_description`
  peuvent valoir `null`. `contact`, `address`, `website` et `github` passent de
  facultatifs à `string | null`.
- **`IncubatorWithStartups.startups`** porte des produits réduits : `uuid`, `ghid`, `name`,
  `pitch`, `phases`, `current_phase`.
- **`IncubatorWithMembers.members`** porte `uuid`, `username`, `fullname`, `github`, les deux
  adresses, `missions`, `attachment` et `teams` (des noms). Les partants y figurent.
- **Le coût.** `withStartups` et `withMembers` font une lecture par incubateur.

## Licence
[MIT](./LICENSE)
