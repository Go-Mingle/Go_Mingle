import { httpClient } from '../../../shared/api/httpClient'

export interface SecurityOverview {
  twoStep: {
    enabled: boolean
    enabledAt: string | null
    backupCodesLeft: number
    required: boolean
  }
  policy: { requireTwoStep: boolean }
  canChangePolicy: boolean
}

export interface AdminSignIn {
  id: string
  userAgent: string
  ip: string
  method: 'none' | 'totp' | 'backup'
  createdAt: string
  lastSeenAt: string
  current: boolean
}

const BASE = '/api/v1/security'

/** The Security page's API (GM-346). */
export const securityService = {
  overview: () => httpClient.get<SecurityOverview>(BASE),
  beginSetup: () =>
    httpClient.post<{ secret: string; otpauthUrl: string }>(`${BASE}/two-step/setup`, {}),
  enable: (code: string) =>
    httpClient.post<{ backupCodes: string[] }>(`${BASE}/two-step/enable`, { code }),
  disable: (password: string) =>
    httpClient.post<{ enabled: false }>(`${BASE}/two-step/disable`, { password }),
  newBackupCodes: (password: string) =>
    httpClient.post<{ backupCodes: string[] }>(`${BASE}/two-step/backup-codes`, { password }),
  sessions: () => httpClient.get<{ items: AdminSignIn[] }>(`${BASE}/sessions`),
  signOut: (id: string) =>
    httpClient.delete<{ id: string }>(`${BASE}/sessions/${encodeURIComponent(id)}`),
  signOutOthers: () =>
    httpClient.post<{ signedOut: number }>(`${BASE}/sessions/sign-out-others`, {}),
  setPolicy: (requireTwoStep: boolean) =>
    httpClient.put<{ requireTwoStep: boolean }>(`${BASE}/policy`, { requireTwoStep }),
}

/** "Chrome on macOS", "Safari on iPhone"… from a user-agent string. */
export function describeDevice(ua: string): { browser: string; os: string; mobile: boolean } {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'unknown device'
  return { browser, os, mobile: /iPhone|Android|Mobile/.test(ua) }
}

/** `JBSWY3DPEHPK3PXP` → `JBSW Y3DP EHPK 3PXP`, easier to type into an app. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim()
