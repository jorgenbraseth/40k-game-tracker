import { useRef, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import { clsx } from '@/lib/clsx'
import { cacheLogo, LOGOS } from '@/lib/logo'
import { useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/lib/queries/profile'
import { applyTheme, THEMES } from '@/lib/theme'

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

  const onPickTheme = (theme: (typeof THEMES)[number]['id']) => {
    applyTheme(theme) // instant, so picking a swatch previews it right away
    updateProfile.mutate({ theme })
  }

  const onPickLogo = (logo: (typeof LOGOS)[number]['id']) => {
    cacheLogo(logo) // instant, so picking a crest previews it right away everywhere it's shown
    updateProfile.mutate({ logo })
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

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-paper">Theme</h2>
          <p className="text-xs text-paper/40">Applies everywhere, on every device you sign into.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onPickTheme(theme.id)}
              aria-pressed={profile.theme === theme.id}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
                profile.theme === theme.id ? 'border-gold bg-gold/10' : 'border-veil-strong hover:bg-veil',
              )}
            >
              <span className="flex gap-1">
                <span className="h-5 w-5 rounded-full border border-veil-loud" style={{ background: theme.preview.ink }} />
                <span className="h-5 w-5 rounded-full border border-veil-loud" style={{ background: theme.preview.blood }} />
                <span className="h-5 w-5 rounded-full border border-veil-loud" style={{ background: theme.preview.gold }} />
              </span>
              <span className="text-xs font-medium text-paper">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-paper">Logo</h2>
          <p className="text-xs text-paper/40">The crest shown in the header and on the sign-in screen.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {LOGOS.map((logo) => (
            <button
              key={logo.id}
              type="button"
              onClick={() => onPickLogo(logo.id)}
              aria-pressed={profile.logo === logo.id}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
                profile.logo === logo.id ? 'border-gold bg-gold/10' : 'border-veil-strong hover:bg-veil',
              )}
            >
              <img src={logo.src} alt="" className="h-12 w-12 object-contain" />
              <span className="text-xs font-medium text-paper">{logo.label}</span>
            </button>
          ))}
        </div>
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
