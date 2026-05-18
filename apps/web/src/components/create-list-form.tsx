'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { saveOwnerToken } from '@/lib/owner-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  onDone?: () => void;
}

export function CreateListForm({ onDone }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: (input: { name: string }) => api.createList(input),
    onSuccess: ({ list, ownerToken }) => {
      saveOwnerToken(list.id, ownerToken);
      onDone?.();
      router.push(`/lists/${list.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create list.');
    },
  });

  function action() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    mutation.mutate({ name: trimmed });
  }

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name (e.g. Groceries)"
        maxLength={200}
        autoFocus
      />
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create list'}
      </Button>
    </form>
  );
}
