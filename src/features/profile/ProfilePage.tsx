import { useRef, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/lib/queries/profile'

export function ProfilePage() {
  const { user } = useAuth()
  const { data: profile, isLoading, isError, refetch } = useProfile(user?.id)
  const updateProfile = useUpdateProfile(user?.id)
  const uploadAvatar = useUploadAvatar(user?.id)
  const removeAvatar = useRemoveAvatar(user?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets picking the exact same file again still fire onChange
    if (file) uploadAvatar.mutate(file)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-paper">Profile</h1>

      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={profile.display_name} size="h-16 w-16" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploadAvatar.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadAvatar.isPending ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Add photo'}
            </Button>
            {profile.avatar_url && (
              <Button type="button" variant="ghost" disabled={removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>
                {removeAvatar.isPending ? 'Removing…' : 'Remove'}
              </Button>
            )}
          </div>
          <p className="text-xs text-paper/40">Shown wherever your name shows up -- resized and compressed automatically.</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
      </div>

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
