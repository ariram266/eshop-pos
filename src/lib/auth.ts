import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined
const apiClientId = import.meta.env.VITE_ENTRA_API_CLIENT_ID as string | undefined
const authority = tenantId ? `https://login.microsoftonline.com/${tenantId}` : ''
const scopes = apiClientId ? [`api://${apiClientId}/user_impersonation`] : []
export const isLocalDevelopment = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(import.meta.env.VITE_CLOUD_API_URL || '')

const client = clientId && authority ? new PublicClientApplication({ auth: { clientId, authority, redirectUri: window.location.origin } }) : null
let activeAccount: AccountInfo | null = null

export async function initializeAuth() {
  if (!client) return
  await client.initialize()
  const redirect = await client.handleRedirectPromise()
  activeAccount = redirect?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
  if (activeAccount) client.setActiveAccount(activeAccount)
}

export async function accessToken() {
  if (!client || !activeAccount || !scopes.length) return undefined
  const result = await client.acquireTokenSilent({ account: activeAccount, scopes })
  return result.accessToken
}

export async function startEntraLogin() {
  if (isLocalDevelopment) return
  if (!client || !scopes.length) throw new Error('Entra authentication is not configured for this deployment.')
  await client.loginRedirect({ scopes })
}

export async function signOut() {
  if (client && activeAccount) await client.logoutRedirect({ account: activeAccount, postLogoutRedirectUri: window.location.origin })
}
