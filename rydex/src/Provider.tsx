'use client'
import { SessionProvider } from 'next-auth/react'
import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'

function Provider({children}:{children:React.ReactNode}) {
  return (
    <SessionProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SessionProvider>
  )
}

export default Provider
