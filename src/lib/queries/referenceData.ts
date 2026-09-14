import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const referenceKeys = {
  currentMissionPack: ['reference', 'current-mission-pack'] as const,
  mission: (missionId: string) => ['reference', 'mission', missionId] as const,
  missions: (missionPackId: string) => ['reference', 'missions', missionPackId] as const,
  deployments: (missionPackId: string) => ['reference', 'deployments', missionPackId] as const,
  secondaries: (missionPackId: string) => ['reference', 'secondaries', missionPackId] as const,
  factions: ['reference', 'factions'] as const,
}

export function useCurrentMissionPack() {
  return useQuery({
    queryKey: referenceKeys.currentMissionPack,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_packs')
        .select('*')
        .eq('is_current', true)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No current mission pack configured')
      return data
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useMission(missionId: string | undefined) {
  return useQuery({
    queryKey: referenceKeys.mission(missionId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId as string)
        .single()
      if (error) throw error
      return data
    },
    enabled: Boolean(missionId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useMissions(missionPackId: string | undefined) {
  return useQuery({
    queryKey: referenceKeys.missions(missionPackId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('mission_pack_id', missionPackId as string)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: Boolean(missionPackId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useDeployments(missionPackId: string | undefined) {
  return useQuery({
    queryKey: referenceKeys.deployments(missionPackId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('mission_pack_id', missionPackId as string)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: Boolean(missionPackId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useSecondaryObjectives(missionPackId: string | undefined) {
  return useQuery({
    queryKey: referenceKeys.secondaries(missionPackId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secondary_objectives')
        .select('*')
        .eq('mission_pack_id', missionPackId as string)
        .order('category')
        .order('name')
      if (error) throw error
      return data
    },
    enabled: Boolean(missionPackId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useFactions() {
  return useQuery({
    queryKey: referenceKeys.factions,
    queryFn: async () => {
      const { data, error } = await supabase.from('factions').select('*').order('name')
      if (error) throw error
      return data
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}
