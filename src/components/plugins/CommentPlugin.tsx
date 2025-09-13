import React, { useState, useEffect, useCallback } from 'react';
import { 
  $getSelection, 
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  $getNodeByKey,
  NodeKey
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createMarkNode, $isMarkNode, MarkNode } from '@lexical/mark';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, X, Check, Reply, Trash2, MessageSquarePlus } from 'lucide-react';
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
  replies: Comment[];
  markNodeKey?: NodeKey;
}

// Custom CommentMarkNode class for text highlighting
class CommentMarkNode extends MarkNode {
  __commentId: string;

  static getType(): string {
    return 'comment-mark';
  }

  static clone(node: CommentMarkNode): CommentMarkNode {
    return new CommentMarkNode(node.__commentId, node.__key);
  }

  // Make commentId have a default value to satisfy Lexical's requirements
  constructor(commentId: string = '', key?: NodeKey) {
    super([`comment-${commentId}`], key);
    this.__commentId = commentId;
  }

  // Required for serialization
  static importJSON(serializedNode: any): CommentMarkNode {
    const { commentId } = serializedNode;
    return new CommentMarkNode(commentId);
  }

  // Required for serialization
  exportJSON(): any {
    return {
      ...super.exportJSON(),
      commentId: this.__commentId,
      type: 'comment-mark',
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement('mark');
    element.className = `comment-highlight comment-${this.__commentId}`;
    element.setAttribute('data-comment-id', this.__commentId);
    element.addEventListener('click', () => {
      // Dispatch custom event to highlight comment in sidebar
      window.dispatchEvent(new CustomEvent('comment-highlight-click', {
        detail: { commentId: this.__commentId }
      }));
    });
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getCommentId(): string {
    return this.__commentId;
  }

  setCommentId(commentId: string): void {
    const writable = this.getWritable();
    writable.__commentId = commentId;
  }
}

function $createCommentMarkNode(commentId: string): CommentMarkNode {
  return new CommentMarkNode(commentId);
}

function $isCommentMarkNode(node: any): node is CommentMarkNode {
  return node instanceof CommentMarkNode;
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
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kommentar hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {selectedText && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              "{selectedText}"
            </div>
          )}
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Ihr Kommentar..."
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button
              onClick={() => onSave(commentText)}
              disabled={!commentText.trim()}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommentThread: React.FC<{
  comment: Comment;
  onResolve: (commentId: string) => void;
  onReply: (commentId: string, text: string) => void;
  onDelete: (commentId: string) => void;
  onHighlight: (commentId: string) => void;
  isHighlighted: boolean;
}> = ({ comment, onResolve, onReply, onDelete, onHighlight, isHighlighted }) => {
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
    <div 
      className={`border rounded-lg p-4 space-y-3 bg-card cursor-pointer transition-all duration-200 ${
        isHighlighted 
          ? 'border-primary shadow-md bg-primary/5 ml-2' 
          : 'hover:border-border/60'
      }`}
      onClick={() => onHighlight(comment.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={comment.avatarUrl} />
            <AvatarFallback className="text-xs">
              {comment.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.timestamp).toLocaleString()}
          </span>
          {comment.resolved && (
            <Badge variant="secondary" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Resolved
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {!comment.resolved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id);
              }}
              className="h-7 w-7 p-0"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(comment.id);
            }}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-foreground">
        {comment.text}
      </div>

      {comment.replies.length > 0 && (
        <div className="space-y-2 ml-4 border-l border-border pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="bg-muted/30 rounded p-2">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium">{reply.authorName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs">{reply.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowReply(!showReply);
          }}
          className="h-7 text-xs"
        >
          <Reply className="h-3 w-3 mr-1" />
          Antworten
        </Button>
      </div>

      {showReply && (
        <div className="space-y-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Antwort..."
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={handleReply} className="h-7 text-xs">
              Antworten
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowReply(false)}
              className="h-7 text-xs"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export function CommentPlugin({ documentId }: { documentId?: string }) {
  const [editor] = useLexicalComposerContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [textPosition, setTextPosition] = useState(0);
  const [textLength, setTextLength] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [highlightedComment, setHighlightedComment] = useState<string | null>(null);
  const { toast } = useToast();

  const loadComments = async () => {
    if (!documentId) return;
    
    try {
      // First get comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('letter_comments')
        .select('*')
        .eq('letter_id', documentId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Then get user profiles for the comment authors
      const userIds = [...new Set(commentsData?.map(comment => comment.user_id) || [])];
      
      let profilesData = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);

        if (profilesError) {
          console.warn('Could not load user profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Combine comments with profile data
      const commentsWithProfiles = commentsData?.map((comment: any) => {
        const profile = profilesData.find(p => p.user_id === comment.user_id);
        return {
          id: comment.id,
          text: comment.content,
          author: comment.user_id,
          authorName: profile?.display_name || 'Unknown User',
          avatarUrl: profile?.avatar_url,
          timestamp: comment.created_at,
          position: comment.text_position || 0,
          length: comment.text_length || 0,
          resolved: comment.resolved || false,
          replies: [] // Load replies separately if needed
        };
      }) || [];

      setComments(commentsWithProfiles);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast({
        title: "Fehler",
        description: "Kommentare konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadComments();
  }, [documentId]);

  const handleAddComment = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const text = selection.getTextContent();
        setSelectedText(text);
        setTextPosition(0);
        setTextLength(text.length);
        setShowDialog(true);
      } else {
        toast({
          title: "Hinweis",
          description: "Bitte markieren Sie zuerst einen Text für Ihren Kommentar.",
        });
      }
    });
  };

  const saveComment = async (text: string) => {
    if (!documentId || !selectedText) return;

    try {
      const { data, error } = await supabase
        .from('letter_comments')
        .insert({
          letter_id: documentId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          content: text,
          text_position: textPosition,
          text_length: textLength
        })
        .select()
        .single();

      if (error) throw error;

      // Create highlight in editor
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const markNode = $createCommentMarkNode(data.id);
          selection.insertNodes([markNode]);
        }
      });

      // Add to local state
      const newComment: Comment = {
        id: data.id,
        text: text,
        author: data.user_id,
        authorName: 'You', // Will be updated when we reload
        timestamp: data.created_at,
        position: textPosition,
        length: textLength,
        resolved: false,
        replies: []
      };

      setComments(prev => [...prev, newComment]);
      setShowDialog(false);
      setSelectedText('');
      
      // Reload comments to get proper author info
      loadComments();

      toast({
        title: "Comment added",
        description: "Your comment has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: "Error",
        description: "Failed to save comment. Please try again.",
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

      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, resolved: true }
            : comment
        )
      );

      toast({
        title: "Comment resolved",
        description: "The comment has been marked as resolved.",
      });
    } catch (error) {
      console.error('Error resolving comment:', error);
      toast({
        title: "Error",
        description: "Failed to resolve comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const replyToComment = async (commentId: string, text: string) => {
    // Placeholder for reply functionality
    console.log('Reply to comment:', commentId, text);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('letter_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Remove highlight from editor
      editor.update(() => {
        const root = editor.getRootElement();
        if (root) {
          const highlightElements = root.querySelectorAll(`[data-comment-id="${commentId}"]`);
          highlightElements.forEach(element => {
            const node = $getNodeByKey(element.getAttribute('data-lexical-key') || '');
            if ($isCommentMarkNode(node)) {
              node.remove();
            }
          });
        }
      });

      setComments(prev => prev.filter(comment => comment.id !== commentId));

      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle comment highlighting from text clicks
  const handleCommentHighlight = useCallback((commentId: string) => {
    setHighlightedComment(commentId);
    
    // Add CSS class to highlight the text
    const highlightElements = document.querySelectorAll(`[data-comment-id="${commentId}"]`);
    highlightElements.forEach(element => {
      element.classList.add('comment-highlight-active');
    });

    // Remove highlight after a few seconds
    setTimeout(() => {
      setHighlightedComment(null);
      highlightElements.forEach(element => {
        element.classList.remove('comment-highlight-active');
      });
    }, 3000);
  }, []);

  // Register editor commands and event listeners
  useEffect(() => {
    const selectionCommand = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          const selectedText = selection.getTextContent();
          if (selectedText.trim()) {
            setSelectedText(selectedText);
            // Calculate position roughly (this could be improved)
            setTextPosition(0);
            setTextLength(selectedText.length);
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const handleCommentClick = (event: CustomEvent) => {
      handleCommentHighlight(event.detail.commentId);
    };

    window.addEventListener('comment-highlight-click', handleCommentClick as EventListener);

    return () => {
      selectionCommand();
      window.removeEventListener('comment-highlight-click', handleCommentClick as EventListener);
    };
  }, [editor, handleCommentHighlight]);

  return (
    <>
      {/* Floating action buttons */}
      <div className="fixed right-4 top-4 z-40 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddComment}
          className="bg-background shadow-lg"
        >
          <MessageSquarePlus className="h-4 w-4 mr-1" />
          Kommentar
        </Button>
        <Button
          variant={showSidebar ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSidebar(!showSidebar)}
          className="bg-background shadow-lg"
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {comments.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Comment Dialog */}
      {showDialog && (
        <CommentDialog
          position={textPosition}
          length={textLength}
          selectedText={selectedText}
          onSave={saveComment}
          onCancel={() => setShowDialog(false)}
        />
      )}

      {/* Comments Sidebar */}
      {showSidebar && (
        <div className="fixed right-4 top-20 w-80 max-h-[calc(100vh-120px)] bg-background border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">
              Kommentare ({comments.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Keine Kommentare vorhanden. Markieren Sie Text und klicken Sie auf "Kommentar".
              </p>
            ) : (
              comments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  onResolve={resolveComment}
                  onReply={replyToComment}
                  onDelete={deleteComment}
                  onHighlight={handleCommentHighlight}
                  isHighlighted={highlightedComment === comment.id}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Export the custom node for registration
export { CommentMarkNode, $createCommentMarkNode, $isCommentMarkNode };