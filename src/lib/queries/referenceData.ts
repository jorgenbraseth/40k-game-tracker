import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const referenceKeys = {
  currentMissionPack: ['reference', 'current-mission-pack'] as const,
  mission: (missionId: string) => ['reference', 'mission', missionId] as const,
  deployments: (missionPackId: string) => ['reference', 'deployments', missionPackId] as const,
  secondaries: (missionPackId: string) => ['reference', 'secondaries', missionPackId] as const,
  missionObjectiveLines: (missionId: string) => ['reference', 'mission-objective-lines', missionId] as const,
  factions: ['reference', 'factions'] as const,
  forceDispositions: ['reference', 'force-dispositions'] as const,
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
        .order('name')
      if (error) throw error
      return data
    },
    enabled: Boolean(missionPackId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** The actual scoring conditions printed on a mission's card -- what a player ticks/counts instead of typing a raw VP number. */
export function useMissionObjectiveLines(missionId: string | undefined) {
  return useQuery({
    queryKey: referenceKeys.missionObjectiveLines(missionId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_objective_lines')
        .select('*')
        .eq('mission_id', missionId as string)
        .order('sort_order')
      if (error) throw error
      return data
    },
    enabled: Boolean(missionId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/**
 * All scoring lines for a set of secondary objectives (typically every
 * secondary in the pack -- there are few enough, ~30 rows, to fetch once
 * rather than per-card). Takes ids directly since this table has no
 * mission_pack_id of its own -- callers already have the ids from
 * useSecondaryObjectives().
 */
export function useSecondaryObjectiveLines(secondaryObjectiveIds: string[] | undefined) {
  return useQuery({
    queryKey: ['reference', 'secondary-objective-lines', ...(secondaryObjectiveIds ?? [])],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secondary_objective_lines')
        .select('*')
        .in('secondary_objective_id', secondaryObjectiveIds as string[])
        .order('sort_order')
      if (error) throw error
      return data
    },
    enabled: Boolean(secondaryObjectiveIds?.length),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useForceDispositions() {
  return useQuery({
    queryKey: referenceKeys.forceDispositions,
    queryFn: async () => {
      const { data, error } = await supabase.from('force_dispositions').select('*').order('name')
      if (error) throw error
      return data
    },
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
