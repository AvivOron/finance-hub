import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[Tour API] GET request received, starting tour setup...')

    // Temporary: just return success to test the route
    return NextResponse.json({ message: 'Tour route works!' })
  } catch (error) {
    console.error('[Tour API] ERROR:', error)
    return NextResponse.json({ error: 'Tour setup failed' }, { status: 500 })
  }
}
