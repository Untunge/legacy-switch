import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContactListResponse, ContactResponse } from '../types';

const API_URL = 'http://localhost:3001';

export const useContacts = (capsuleId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', capsuleId],
    queryFn: async () => {
      if (!capsuleId) return [];
      const response = await fetch(
        `${API_URL}/capsules/${capsuleId}/contacts`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const json = (await response.json()) as ContactListResponse;
      return json.data;
    },
    enabled: !!capsuleId,
  });

  const addMutation = useMutation({
    mutationFn: async (contact: {
      email: string;
      name?: string;
      passphrase: string;
    }) => {
      if (!capsuleId) throw new Error('No capsule ID');
      const response = await fetch(
        `${API_URL}/capsules/${capsuleId}/contacts`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contact),
        }
      );
      if (!response.ok) throw new Error('Failed to add contact');
      const json = (await response.json()) as ContactResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', capsuleId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!capsuleId) throw new Error('No capsule ID');
      const response = await fetch(
        `${API_URL}/capsules/${capsuleId}/contacts/${contactId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to remove contact');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', capsuleId] });
    },
  });

  return {
    contacts: data || [],
    isLoading,
    addContact: addMutation.mutate,
    removeContact: removeMutation.mutate,
  };
};
