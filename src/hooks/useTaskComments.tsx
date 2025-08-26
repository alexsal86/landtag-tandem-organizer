import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { TaskComment } from "@/types/taskTypes";

export const useTaskComments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [taskComments, setTaskComments] = useState<{ [taskId: string]: TaskComment[] }>({});
  const [newComment, setNewComment] = useState<{ [taskId: string]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});

  const loadTaskComments = async (taskId?: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          content,
          user_id,
          created_at
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user display names separately  
      const userIds = [...new Set((data || []).map(comment => comment.user_id))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile.display_name || 'Unbekannter Benutzer';
          return acc;
        }, {} as Record<string, string>);
      }

      const commentsByTask: { [taskId: string]: TaskComment[] } = {};
      
      (data || []).forEach(comment => {
        if (!commentsByTask[comment.task_id]) {
          commentsByTask[comment.task_id] = [];
        }
        
        commentsByTask[comment.task_id].push({
          id: comment.id,
          taskId: comment.task_id,
          content: comment.content,
          userId: comment.user_id,
          userName: profilesMap[comment.user_id] || 'Unbekannter Benutzer',
          createdAt: comment.created_at
        });
      });

      if (taskId) {
        setTaskComments(prev => ({
          ...prev,
          [taskId]: commentsByTask[taskId] || []
        }));
      } else {
        setTaskComments(commentsByTask);
      }
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const addComment = async (taskId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          content: content.trim(),
          user_id: user.id
        });

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [taskId]: '' }));
      await loadTaskComments(taskId);
      
      toast({
        title: "Erfolgreich",
        description: "Kommentar wurde hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const updateComment = async (commentId: string, content: string) => {
    if (!content.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: content.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingComment(prev => {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      });
      
      await loadTaskComments();
      
      toast({
        title: "Erfolgreich",
        description: "Kommentar wurde aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      await loadTaskComments();
      
      toast({
        title: "Erfolgreich",
        description: "Kommentar wurde gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTaskComments();
  }, []);

  return {
    taskComments,
    newComment,
    setNewComment,
    editingComment,
    setEditingComment,
    loadTaskComments,
    addComment,
    updateComment,
    deleteComment
  };
};