import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";

import { type AdapterWrapper, getAdapterWrapper } from "./Adapter";
import { type CallbacksWrapper, getCallbacksWrapper } from "./Callbacks";
import {
  type ProviderConfigWrapper,
  getProviderConfigWrapper,
} from "./ProviderConfig";
import { EspaceMembreClient, type Member } from "./client";

export interface EspaceMembreConfig extends NodemailerConfig {}

export interface EspaceMembreProviderWrapperParam {
  espaceMembreApiKey: string;
  fetch?: EspaceMembreClient.RegisteredFetch;
  fetchOptions?: EspaceMembreClient.RegisteredFetchOptions;
}

export interface EspaceMembreProviderWrappers {
  ProviderWrapper: ProviderConfigWrapper;
  AdapterWrapper: AdapterWrapper;
  CallbacksWrapper: CallbacksWrapper;
}
export function EspaceMembreProvider(
  espaceMembreParams: EspaceMembreProviderWrapperParam,
) {
  const client = new EspaceMembreClient({
    apiKey: espaceMembreParams.espaceMembreApiKey,
    fetch: espaceMembreParams.fetch,
    fetchOptions: espaceMembreParams.fetchOptions,
  });

  return {
    ProviderWrapper: getProviderConfigWrapper(client),
    AdapterWrapper: getAdapterWrapper(client),
    CallbacksWrapper: getCallbacksWrapper(client),
  } as const;
}
