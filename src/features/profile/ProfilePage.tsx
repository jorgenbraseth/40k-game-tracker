import { useState } from 'react'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile, useUpdateProfile } from '@/lib/queries/profile'

export function ProfilePage() {
  const { user } = useAuth()
  const { data: profile, isLoading, isError, refetch } = useProfile(user?.id)
  const updateProfile = useUpdateProfile(user?.id)
  const [displayName, setDisplayName] = useState('')
  const [saved, setSaved] = useState(false)

  if (isLoading) return <Spinner label="Loading profile…" />
  if (isError || !profile) return <ErrorBanner message="Couldn't load your profile." onRetry={() => refetch()} />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateProfile.mutateAsync({ display_name: displayName || profile.display_name })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-paper">Profile</h1>
      <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
        <TextField
          label="Display name"
          defaultValue={profile.display_name}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField label="Email" value={user?.email ?? ''} disabled />
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </Button>
      </form>
    </div>
  )
}
