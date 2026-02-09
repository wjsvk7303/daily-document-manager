import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import DocumentApp from './DocumentApp'

export default async function DocumentsPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }
  return <DocumentApp />
}
