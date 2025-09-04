import React from 'react';
import LexicalCollaborationDemo from '@/components/LexicalCollaborationDemo';
import LexicalDemo from '@/components/LexicalDemo';

const LexicalDemoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <LexicalDemo />
      <hr style={{ margin: '3rem 0', border: '1px solid #e5e7eb' }} />
      <LexicalCollaborationDemo />
    </div>
  );
};

export default LexicalDemoPage;