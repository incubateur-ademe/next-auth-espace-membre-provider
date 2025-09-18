# Espace Membre Provider pour NextAuth.js
## Installation
```bash
npm install @incubateur-ademe/next-auth-espace-membre-provider
```

## Utilisation
```typescript
// fichier "auth.ts" où vous configurez NextAuth.js
import { EspaceMembreProvider } from '@incubateur-ademe/next-auth-espace-membre-provider';
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";

const espaceMembreProvider = EspaceMembreProvider({
  espaceMembreApiKey: "votre-api-key", // optionnel, par défaut `process.env.ESPACE_MEMBRE_API_KEY` ou ""
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
import { EspaceMembreClient, type Member } from '@incubateur-ademe/next-auth-espace-membre-provider/client';

const client = new EspaceMembreClient({
    apiKey: "votre-api-key", // optionnel, par défaut `process.env.ESPACE_MEMBRE_API_KEY` ou ""
    fetch, // optionnel, par défaut le `fetch` de base (permet de récupérer celui de Next par exemple)
    fetchOptions: { // optionnel, par défaut {} (permet de passer des options spécifiques à Next par exemple)
        next: {
            revalidate: 300, // 5 minutes
        },
        cache: "default",
    },
  });

const member: Member = await client.member.getByUsername("nom-d-utilisateur");
```

#### ℹ️ Fetch custom
Pour enregistrer une implémentation de fetch personnalisée, vous devez fournir une fonction `fetch` qui se comporte comme la fonction native `fetch`. Cette fonction sera utilisée pour effectuer des requêtes à l'API de l'Espace Membre.

```typescript
import { EspaceMembreClient } from '@incubateur-ademe/next-auth-espace-membre-provider/client';
import { myCustomFetch } from './myCustomFetch';

declare "@incubateur-ademe/next-auth-espace-membre-provider/client" {
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
ESPACE_MEMBRE_API_KEY=votre-api-key
ESPACE_MEMBRE_URL=https://espace-membre.incubateur.net # pour changer l'URL de l'API en local par exemple
```

### Dans la table `User` en base de données
- `username` est à ajouter pour stocker le nom d'utilisateur de l'espace membre
- `isBetaGouvMember` est à ajouter pour attester que l'utilisateur vient de beta.gouv

## Licence
[MIT](./LICENSE)
