import { Suspense } from 'react'
import AdminCostumerView from './AdminCostumerView'

export default function AdminCostumerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>}>
      <AdminCostumerView />
    </Suspense>
  )
}
