'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import './spa.css'
import { SPA_HTML } from './spa-html'
import { SPA_JS } from './spa-js'

export default function DocumentApp() {
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const { user } = useUser()

  useEffect(() => {
    if (!containerRef.current || initializedRef.current || !user) return
    initializedRef.current = true

    // Pass Clerk userId to SPA
    ;(window as unknown as Record<string, string>).__CLERK_USER_ID__ = user.id

    // 1. Inject HTML
    containerRef.current.innerHTML = SPA_HTML

    // 2. Load Supabase CDN then execute SPA JS
    const supabaseScript = document.createElement('script')
    supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
    supabaseScript.onload = () => {
      const spaScript = document.createElement('script')
      spaScript.setAttribute('data-spa', 'true')
      spaScript.textContent = `(function() { ${SPA_JS} })();`
      document.body.appendChild(spaScript)
    }
    document.head.appendChild(supabaseScript)

    return () => {
      document.querySelectorAll('[data-spa="true"]').forEach(el => el.remove())
    }
  }, [user])

  return <div ref={containerRef} className="spa-container" />
}
