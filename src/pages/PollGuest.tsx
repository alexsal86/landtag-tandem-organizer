import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PollResponseInterface } from '@/components/poll/PollResponseInterface';

export default function PollGuest() {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isPreview = searchParams.get('preview') === 'true';

  if (!pollId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Ungültiger Link</h1>
          <p className="text-muted-foreground mt-2">
            Der Abstimmungslink ist ungültig oder beschädigt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto py-8">
        <PollResponseInterface 
          pollId={pollId} 
          token={token || undefined}
          isPreview={isPreview}
        />
      </div>
    </div>
  );
}