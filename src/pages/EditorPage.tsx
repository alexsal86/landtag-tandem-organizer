import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Edit3 } from 'lucide-react';
import LexicalEditor from '@/components/LexicalEditor';

const EditorPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Collaborative Editor
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create and edit documents collaboratively in real-time with other users.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg min-h-[600px]">
              <LexicalEditor
                initialContent=""
                placeholder="Start writing your document..."
                showToolbar={true}
                onChange={(content) => {
                  console.log('Document content changed:', content.length, 'characters');
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditorPage;