import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Capsule, CapsuleListResponse, CapsuleResponse } from '../types';

const API_URL = 'http://localhost:3001';

export const useCapsules = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['capsules'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/capsules`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch capsules');
      const json = (await response.json()) as CapsuleListResponse;
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (capsule: Partial<Capsule>) => {
      const response = await fetch(`${API_URL}/capsules`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capsule),
      });
      if (!response.ok) throw new Error('Failed to create capsule');
      const json = (await response.json()) as CapsuleResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Capsule>;
    }) => {
      const response = await fetch(`${API_URL}/capsules/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update capsule');
      const json = (await response.json()) as CapsuleResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/capsules/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete capsule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] });
    },
  });

  return {
    capsules: data || [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    createCapsule: createMutation.mutate,
    updateCapsule: updateMutation.mutate,
    deleteCapsule: deleteMutation.mutate,
  };
};
