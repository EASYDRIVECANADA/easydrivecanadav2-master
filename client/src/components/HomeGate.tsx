'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function HomeGate() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return

      const isVerified = typeof window !== 'undefined' && window.localStorage.getItem('edc_account_verified') === 'true'
      if (!isVerified) return

      router.replace('/inventory')
    }

    void run()
  }, [router])

  return null
}
