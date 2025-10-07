import React from 'react';
import { useYjsProvider } from './YjsProvider';

interface YjsSyncStatusProps {
  children: React.ReactNode;
}

export function YjsSyncStatus({ children }: YjsSyncStatusProps) {
  const { isSynced } = useYjsProvider();
  
  if (!isSynced) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Synchronizing...
          </div>
        </div>
        {children}
      </div>
    );
  }
  
  return <>{children}</>;
}