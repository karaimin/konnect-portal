declare global {
  interface Window {
    __APP_CONFIG__: {
      apiBaseUrl: string
    }
  }
}

export const config = {
  apiBaseUrl: window.__APP_CONFIG__?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}
