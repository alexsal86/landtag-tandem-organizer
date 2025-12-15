import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Route, X, GripVertical, Plus, Navigation, Trash2, Clock, Ruler } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
}

interface RoutePlannerPanelProps {
  waypoints: Waypoint[];
  onWaypointsChange: (waypoints: Waypoint[]) => void;
  onClose: () => void;
  isAddingWaypoint: boolean;
  onToggleAddWaypoint: () => void;
  routeInfo?: {
    distance: number; // meters
    duration: number; // seconds
  } | null;
}

export const RoutePlannerPanel = ({
  waypoints,
  onWaypointsChange,
  onClose,
  isAddingWaypoint,
  onToggleAddWaypoint,
  routeInfo,
}: RoutePlannerPanelProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(waypoints);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    onWaypointsChange(items);
  };

  const handleRemove = (id: string) => {
    onWaypointsChange(waypoints.filter(w => w.id !== id));
  };

  const handleStartEdit = (waypoint: Waypoint) => {
    setEditingId(waypoint.id);
    setEditName(waypoint.name || `${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}`);
  };

  const handleSaveEdit = (id: string) => {
    onWaypointsChange(
      waypoints.map(w => w.id === id ? { ...w, name: editName } : w)
    );
    setEditingId(null);
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} Std ${minutes} Min`;
    }
    return `${minutes} Min`;
  };

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Route className="h-5 w-5" />
            Routenplanung
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Button
          variant={isAddingWaypoint ? "default" : "outline"}
          size="sm"
          onClick={onToggleAddWaypoint}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isAddingWaypoint ? 'Klicken Sie auf die Karte...' : 'Wegpunkt hinzufügen'}
        </Button>

        {waypoints.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Fügen Sie Wegpunkte hinzu, um eine Route zu planen
          </p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="waypoints">
              {(provided) => (
                <ScrollArea className="h-[300px]">
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {waypoints.map((waypoint, index) => (
                      <Draggable key={waypoint.id} draggableId={waypoint.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-2 p-2 rounded-md border ${
                              snapshot.isDragging ? 'bg-accent' : 'bg-background'
                            }`}
                          >
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            </div>
                            
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                              {index + 1}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {editingId === waypoint.id ? (
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onBlur={() => handleSaveEdit(waypoint.id)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(waypoint.id)}
                                  className="h-7 text-sm"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => handleStartEdit(waypoint)}
                                  className="text-sm truncate text-left w-full hover:text-primary"
                                >
                                  {waypoint.name || `${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}`}
                                </button>
                              )}
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => handleRemove(waypoint.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </ScrollArea>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {routeInfo && waypoints.length >= 2 && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Distanz:</span>
              <span className="font-medium">{formatDistance(routeInfo.distance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fahrzeit:</span>
              <span className="font-medium">{formatDuration(routeInfo.duration)}</span>
            </div>
          </div>
        )}

        {waypoints.length >= 2 && (
          <Button variant="outline" size="sm" className="w-full">
            <Navigation className="h-4 w-4 mr-2" />
            In Google Maps öffnen
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
