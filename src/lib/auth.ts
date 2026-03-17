// src/lib/auth.ts

import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

interface AdminPayload {
  userId: number
  id: number
  email: string
  role: string
  firstname?: string
  lastname?: string
  adminId?: number
}

export async function verifyAdminToken(req: NextRequest): Promise<AdminPayload | null> {
  let token: string | undefined

  // 1. Try Authorization header (Bearer token)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  // 2. Fall back to admin-token cookie (set by login route)
  if (!token) {
    token = req.cookies.get('admin-token')?.value
  }

  // 3. Fall back to generic token cookie
  if (!token) {
    token = req.cookies.get('token')?.value
  }

  if (!token) return null

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminPayload
    if (payload.role !== 'admin') return null
    return payload
  } catch {
    return null
  }
}