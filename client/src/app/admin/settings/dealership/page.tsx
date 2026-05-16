import { redirect } from 'next/navigation'

export default function DealershipSettingsRedirect() {
  redirect('/admin/configuration?tab=company')
}
