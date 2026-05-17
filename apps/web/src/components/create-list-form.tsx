'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { name: string }) => api.createList(input),
    onSuccess: ({ list, ownerToken }) => {
      saveOwnerToken(list.id, ownerToken);
      onDone?.();
      router.push(`/lists/${list.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create list.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setError(null);
    mutation.mutate({ name: trimmed });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
