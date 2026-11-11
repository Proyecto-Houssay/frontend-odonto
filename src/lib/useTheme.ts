import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('novadent-theme')
      if (stored === 'dark' || stored === 'light') return stored
      // Fallback a preferencia del sistema operativo si no está definido
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('novadent-theme', theme)
    } catch {
      /* localStorage no disponible */
    }
  }, [theme])

  const toggleTheme = () => setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'))

  return { theme, setTheme, toggleTheme }
}
