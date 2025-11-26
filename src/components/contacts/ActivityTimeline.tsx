import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  PhoneCall, 
  Mail, 
  Calendar, 
  FileText, 
  Edit2, 
  StickyNote,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  metadata?: Record<string, any>;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call':
      return <PhoneCall className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'meeting':
    case 'appointment':
      return <Calendar className="h-4 w-4" />;
    case 'letter':
      return <FileText className="h-4 w-4" />;
    case 'edit':
      return <Edit2 className="h-4 w-4" />;
    case 'note':
      return <StickyNote className="h-4 w-4" />;
    case 'created':
      return <UserPlus className="h-4 w-4" />;
    case 'deleted':
      return <Trash2 className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'call':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'email':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'meeting':
    case 'appointment':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'letter':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    case 'edit':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    case 'note':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300';
    case 'created':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300';
    case 'deleted':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function ActivityTimeline({ activities, loading = false }: ActivityTimelineProps) {
  const [expandedActivities, setExpandedActivities] = React.useState<Set<string>>(new Set());

  const toggleActivity = (id: string) => {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Noch keine Aktivitäten vorhanden
          </p>
          <p className="text-sm text-muted-foreground">
            Aktivitäten werden automatisch protokolliert
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const isExpanded = expandedActivities.has(activity.id);
        const hasDescription = activity.description && activity.description.length > 0;

        return (
          <div key={activity.id} className="relative">
            {/* Timeline connector line */}
            {index < activities.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
            )}

            <div className="flex gap-4">
              {/* Activity icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.activity_type)}`}>
                {getActivityIcon(activity.activity_type)}
              </div>

              {/* Activity content */}
              <Card className="flex-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{activity.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>

                  {/* User avatar */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={activity.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(activity.profiles?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Description (collapsible if long) */}
                {hasDescription && (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleActivity(activity.id)}>
                    <div className="mt-3">
                      <CollapsibleContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {activity.description}
                        </p>
                      </CollapsibleContent>
                      {activity.description.length > 100 && (
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Weniger anzeigen
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Mehr anzeigen
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                  </Collapsible>
                )}

                {/* Metadata tags */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activity.metadata.changed_fields && Array.isArray(activity.metadata.changed_fields) && (
                      <div className="text-xs text-muted-foreground">
                        Geändert: {activity.metadata.changed_fields.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
}
