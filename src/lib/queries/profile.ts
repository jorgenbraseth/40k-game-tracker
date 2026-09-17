import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resizeImageToAvatar } from '@/lib/resizeImage'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId as string)
        .single()
      if (error) throw error
      return data
    },
    enabled: Boolean(userId),
  })
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { display_name?: string; avatar_url?: string | null }) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) })
    },
  })
}

const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

/** Resizes/compresses client-side (see resizeImage.ts), then uploads to a fixed
 * "<user id>/avatar.<ext>" path in the `avatars` storage bucket (issue #73) -- a fixed name per
 * user means a re-upload just overwrites the old one via `upsert`, never accumulating orphaned
 * files. The public URL gets a cache-busting query param, since the path itself doesn't change on
 * a re-upload and browsers would otherwise keep showing the stale cached image. */
export function useUploadAvatar(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Not signed in')
      const blob = await resizeImageToAvatar(file)
      const extension = AVATAR_EXTENSION_BY_MIME[blob.type] ?? 'webp'
      const path = `${userId}/avatar.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: blob.type, upsert: true })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = `${publicUrl}?v=${Date.now()}`

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
      if (updateError) throw updateError
      return avatarUrl
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Couldn't upload that image. Try again."),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) })
    },
  })
}

/** Clears the profile's avatar_url and removes every possible extension's object from storage --
 * cheap to just try all three rather than track which one is actually live, and a delete for a
 * path that doesn't exist is a harmless no-op. */
export function useRemoveAvatar(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in')
      const paths = Object.values(AVATAR_EXTENSION_BY_MIME).map((ext) => `${userId}/avatar.${ext}`)
      await supabase.storage.from('avatars').remove(paths)
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't remove your avatar. Try again."),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) })
    },
  })
}
