import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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
