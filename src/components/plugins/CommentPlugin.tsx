import React, { useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageCircle, X, Check, Reply, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  text: string;
  author: string;
  authorName: string;
  avatarUrl?: string;
  timestamp: string;
  position: number;
  length: number;
  resolved: boolean;
  replies: CommentReply[];
}

interface CommentReply {
  id: string;
  text: string;
  author: string;
  authorName: string;
  timestamp: string;
}

interface CommentDialogProps {
  position: number;
  length: number;
  selectedText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

const CommentDialog: React.FC<CommentDialogProps> = ({
  position,
  length,
  selectedText,
  onSave,
  onCancel
}) => {
  const [commentText, setCommentText] = useState('');

  return (
    <Card className="w-80 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Kommentar hinzufügen</h4>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {selectedText && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            "{selectedText}"
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Ihr Kommentar..."
          rows={3}
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onSave(commentText)}
            disabled={!commentText.trim()}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Kommentar
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CommentThread: React.FC<{
  comment: Comment;
  onResolve: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}> = ({ comment, onResolve, onReply, onDelete }) => {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText);
      setReplyText('');
      setShowReply(false);
    }
  };

  return (
    <Card className={`mb-2 ${comment.resolved ? 'opacity-50' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {comment.avatarUrl ? (
            <img
              src={comment.avatarUrl}
              alt={comment.authorName}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
              {comment.authorName.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{comment.authorName}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(comment.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-sm">{comment.text}</p>
            
            {comment.replies.map((reply) => (
              <div key={reply.id} className="mt-2 ml-4 p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{reply.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs">{reply.text}</p>
              </div>
            ))}
            
            <div className="flex gap-1 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReply(!showReply)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Antworten
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResolve(comment.id)}
                className={comment.resolved ? 'text-green-600' : ''}
              >
                <Check className="h-3 w-3 mr-1" />
                {comment.resolved ? 'Aufgelöst' : 'Lösen'}
              </Button>
            </div>
            
            {showReply && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Antwort..."
                  rows={2}
                />
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleReply}>
                    Antworten
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowReply(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function CommentPlugin({ documentId }: { documentId?: string }) {
  const [editor] = useLexicalComposerContext();
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ position: 0, length: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load comments for document and setup real-time updates
  useEffect(() => {
    if (!documentId) return;
    
    loadComments();
    
    // Subscribe to real-time updates for comments
    const channel = supabase
      .channel(`letter-comments-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'letter_comments',
          filter: `letter_id=eq.${documentId}`
        },
        () => {
          loadComments(); // Reload comments when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  const loadComments = async () => {
    if (!documentId) return;
    
    try {
      const { data, error } = await supabase
        .from('letter_comments')
        .select(`
          *,
          profiles!letter_comments_user_id_fkey (display_name, avatar_url)
        `)
        .eq('letter_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsData = data?.map((comment: any) => ({
        id: comment.id,
        text: comment.content,
        author: comment.user_id,
        authorName: comment.profiles?.display_name || 'Unknown User',
        avatarUrl: comment.profiles?.avatar_url,
        timestamp: comment.created_at,
        position: comment.text_position || 0,
        length: comment.text_length || 0,
        resolved: comment.resolved || false,
        replies: [] // Load replies separately if needed
      })) || [];

      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast({
        title: "Fehler",
        description: "Kommentare konnten nicht geladen werden",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = () => {
    if (!documentId) {
      toast({
        title: "Hinweis", 
        description: "Bitte speichern Sie das Dokument erst, bevor Sie Kommentare hinzufügen können.",
        variant: "default",
      });
      return;
    }

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        if (text) {
          setSelectedText(text);
          setSelectionPosition({
            position: selection.anchor.offset,
            length: text.length
          });
          setShowCommentDialog(true);
        } else {
          toast({
            title: "Hinweis",
            description: "Bitte markieren Sie zuerst einen Text für Ihren Kommentar.",
            variant: "default",
          });
        }
      }
    });
  };

  const saveComment = async (text: string) => {
    if (!user || !text.trim()) return;

    try {
      const { error } = await supabase
        .from('letter_comments')
        .insert({
          letter_id: documentId,
          user_id: user.id,
          content: text,
          text_position: selectionPosition.position,
          text_length: selectionPosition.length,
          comment_type: 'comment'
        });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Kommentar wurde hinzugefügt",
      });

      loadComments();
      setShowCommentDialog(false);
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Kommentars",
        variant: "destructive",
      });
    }
  };

  const resolveComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('letter_comments')
        .update({ resolved: true })
        .eq('id', commentId);

      if (error) throw error;

      loadComments();
    } catch (error) {
      console.error('Error resolving comment:', error);
    }
  };

  const replyToComment = async (commentId: string, text: string) => {
    // Implementation for comment replies
    console.log('Reply to comment:', commentId, text);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('letter_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Don't render anything if no documentId
  if (!documentId) {
    return null;
  }

  return (
    <>
      {/* Comment Toggle Button */}
      <div className="fixed right-4 top-4 z-40">
        <Button
          variant={showCommentsSidebar ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
          className="bg-background shadow-lg"
          title={showCommentsSidebar ? "Kommentare ausblenden" : "Kommentare anzeigen"}
        >
          {showCommentsSidebar ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          Kommentare
          {comments.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 ml-2">
              {comments.length}
            </span>
          )}
        </Button>
      </div>

      {/* Add Comment Button */}
      <div className="fixed right-20 top-4 z-40">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddComment}
          className="bg-background shadow-lg"
          title="Kommentar hinzufügen"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <CommentDialog
            position={selectionPosition.position}
            length={selectionPosition.length}
            selectedText={selectedText}
            onSave={saveComment}
            onCancel={() => setShowCommentDialog(false)}
          />
        </div>
      )}

      {/* Comments Sidebar - Only show when toggled */}
      {showCommentsSidebar && (
        <div className="fixed right-4 top-20 w-80 max-h-[calc(100vh-120px)] bg-background border rounded-lg shadow-lg p-4 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Kommentare ({comments.length})</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentsSidebar(false)}
              title="Kommentare ausblenden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        
        {comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            onResolve={resolveComment}
            onReply={replyToComment}
            onDelete={deleteComment}
          />
        ))}
        
          {comments.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Keine Kommentare vorhanden. Markieren Sie Text und klicken Sie auf das Kommentar-Symbol.
            </p>
          )}
        </div>
      )}
    </>
  );
}