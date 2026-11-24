import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckInResponse } from '../types';

const API_URL = 'http://localhost:3001';

export const useCheckIn = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (capsuleId: string) => {
      const response = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capsuleId }),
      });
      if (!response.ok) throw new Error('Check-in failed');
      const json = (await response.json()) as CheckInResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] });
    },
  });

  return {
    checkIn: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
};
