import { createServiceClient } from './supabase/service'

type AuthSuccess = { familyId: string }
type AuthError = Response

export async function authenticate(req: Request): Promise<AuthSuccess | AuthError> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing Authorization: Bearer <api_key> header' }, { status: 401, headers: cors() })
  }

  const key = auth.slice(7).trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    return Response.json({ error: 'Invalid API key' }, { status: 401, headers: cors() })
  }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('families')
    .select('id')
    .eq('api_key', key)
    .single()

  if (error && error.code !== 'PGRST116') {
    return Response.json({ error: 'Authentication service unavailable' }, { status: 500, headers: cors() })
  }
  if (!data) {
    return Response.json({ error: 'Invalid API key' }, { status: 401, headers: cors() })
  }

  return { familyId: data.id }
}

export function isAuthError(result: AuthSuccess | AuthError): result is AuthError {
  return result instanceof Response
}

export function cors() {
  const origin = process.env.CORS_ORIGIN
    ?? (process.env.NODE_ENV === 'production' ? 'https://chorequest.dresponda.com' : '*')
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}
