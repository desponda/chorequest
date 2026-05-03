import { createServiceClient } from './supabase/service'

type AuthSuccess = { familyId: string }
type AuthError = Response

export async function authenticate(req: Request): Promise<AuthSuccess | AuthError> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing Authorization: Bearer <api_key> header' }, { status: 401 })
  }

  const key = auth.slice(7).trim()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('families')
    .select('id')
    .eq('api_key', key)
    .single()

  if (!data) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 })
  }

  return { familyId: data.id }
}

export function isAuthError(result: AuthSuccess | AuthError): result is AuthError {
  return result instanceof Response
}

export function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}
