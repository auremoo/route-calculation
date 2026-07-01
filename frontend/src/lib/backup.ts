const DATASAFE_URL_KEY = 'routecalc_datasafe_url'
const DATASAFE_API_KEY_KEY = 'routecalc_datasafe_api_key'
const DATASAFE_APP_NAME_KEY = 'routecalc_datasafe_app_name'

export interface DataSafeConfig {
  url: string
  apiKey: string
  appName: string
}

export function getDataSafeConfig(): DataSafeConfig {
  return {
    url: localStorage.getItem(DATASAFE_URL_KEY) || '',
    apiKey: localStorage.getItem(DATASAFE_API_KEY_KEY) || '',
    appName: localStorage.getItem(DATASAFE_APP_NAME_KEY) || '',
  }
}

export function setDataSafeConfig(config: DataSafeConfig): void {
  if (config.url.trim()) localStorage.setItem(DATASAFE_URL_KEY, config.url.trim())
  else localStorage.removeItem(DATASAFE_URL_KEY)

  if (config.apiKey.trim()) localStorage.setItem(DATASAFE_API_KEY_KEY, config.apiKey.trim())
  else localStorage.removeItem(DATASAFE_API_KEY_KEY)

  if (config.appName.trim()) localStorage.setItem(DATASAFE_APP_NAME_KEY, config.appName.trim())
  else localStorage.removeItem(DATASAFE_APP_NAME_KEY)
}

export function isDataSafeConfigured(): boolean {
  const c = getDataSafeConfig()
  return !!(c.url && c.apiKey && c.appName)
}

function collectLocalStorageData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('routecalc_')) continue
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      data[key] = raw
    }
  }
  return data
}

function downloadJson(payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `routecalc-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ExportResult =
  | { mode: 'datasafe'; success: true; slug?: string; versions?: number }
  | { mode: 'download'; success: true; reason?: 'not-configured' | 'network-error' }

export async function exportData(): Promise<ExportResult> {
  const config = getDataSafeConfig()
  const payload: Record<string, unknown> = {
    _meta: {
      exportedAt: new Date().toISOString(),
      storage: ['localStorage'],
    },
    ...collectLocalStorageData(),
  }

  if (config.url && config.apiKey && config.appName) {
    payload._datasafe = {
      apiKey: config.apiKey,
      url: config.url,
      appName: config.appName,
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'X-App-Name': config.appName,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`DataSafe HTTP ${response.status}`)
      const result = await response.json()
      return { mode: 'datasafe', success: true, slug: result.slug, versions: result.versions }
    } catch {
      downloadJson(payload)
      return { mode: 'download', success: true, reason: 'network-error' }
    }
  }

  downloadJson(payload)
  return { mode: 'download', success: true, reason: 'not-configured' }
}
