import { useState } from 'react';
import { useMapLayers, MapLayer, MapLayerInsert } from '@/hooks/useMapLayers';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Layers, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const EMPTY_FORM: Omit<MapLayerInsert, 'tenant_id'> = {
  name: '',
  description: '',
  group_name: 'Allgemein',
  source_type: 'geojson_file',
  source_path: '',
  source_table: null,
  stroke_color: '#3b82f6',
  fill_color: '#3b82f6',
  fill_opacity: 0.3,
  stroke_width: 2,
  stroke_dash_array: null,
  icon: null,
  visible_by_default: true,
  sort_order: 0,
  is_active: true,
  label_property: '',
};

export const MapLayerAdmin = () => {
  const { currentTenant } = useTenant();
  const { layers, isLoading, createLayer, updateLayer, deleteLayer } = useMapLayers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLayer, setEditingLayer] = useState<MapLayer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openCreate = () => {
    setEditingLayer(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (layer: MapLayer) => {
    setEditingLayer(layer);
    setForm({
      name: layer.name,
      description: layer.description || '',
      group_name: layer.group_name,
      source_type: layer.source_type,
      source_path: layer.source_path || '',
      source_table: layer.source_table,
      stroke_color: layer.stroke_color,
      fill_color: layer.fill_color,
      fill_opacity: layer.fill_opacity,
      stroke_width: layer.stroke_width,
      stroke_dash_array: layer.stroke_dash_array,
      icon: layer.icon,
      visible_by_default: layer.visible_by_default,
      sort_order: layer.sort_order,
      is_active: layer.is_active,
      label_property: layer.label_property || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentTenant?.id || !form.name.trim()) return;

    const payload: MapLayerInsert = {
      ...form,
      tenant_id: currentTenant.id,
      source_path: form.source_path || null,
      description: form.description || null,
      label_property: form.label_property || null,
    };

    if (editingLayer) {
      await updateLayer.mutateAsync({ id: editingLayer.id, ...payload });
    } else {
      await createLayer.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Möchten Sie diesen Layer wirklich löschen?')) {
      await deleteLayer.mutateAsync(id);
    }
  };

  const toggleActive = (layer: MapLayer) => {
    updateLayer.mutate({ id: layer.id, is_active: !layer.is_active });
  };

  if (isLoading) {
    return <Skeleton className="w-full h-64" />;
  }

  // Group layers for display
  const groups = new Set(layers.map(l => l.group_name));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Karten-Layer verwalten
              </CardTitle>
              <CardDescription>
                GeoJSON-Layer für die Karlsruhe-Karte konfigurieren
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Layer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {layers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Noch keine Layer konfiguriert. Fügen Sie einen neuen Layer hinzu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Farben</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layers.map((layer) => (
                  <TableRow key={layer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{layer.name}</div>
                        {layer.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {layer.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{layer.group_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <Badge variant="secondary" className="text-xs">
                          {layer.source_type === 'geojson_file' ? 'Datei' :
                           layer.source_type === 'geojson_url' ? 'URL' : 'DB'}
                        </Badge>
                        {layer.source_path && (
                          <div className="text-muted-foreground truncate max-w-[150px] mt-1">
                            {layer.source_path}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-5 h-5 rounded border"
                          style={{
                            backgroundColor: layer.fill_color,
                            borderColor: layer.stroke_color,
                            borderWidth: '2px',
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {Math.round(layer.fill_opacity * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(layer)}
                        className="h-7 px-2"
                      >
                        {layer.is_active ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(layer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(layer.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLayer ? 'Layer bearbeiten' : 'Neuer Layer'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Schulen"
                />
              </div>

              <div className="col-span-2">
                <Label>Beschreibung</Label>
                <Input
                  value={form.description || ''}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optionale Beschreibung"
                />
              </div>

              <div>
                <Label>Gruppe</Label>
                <Input
                  value={form.group_name}
                  onChange={(e) => setForm(f => ({ ...f, group_name: e.target.value }))}
                  placeholder="z.B. Infrastruktur"
                />
              </div>

              <div>
                <Label>Sortierung</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="col-span-2">
                <Label>Quellentyp</Label>
                <Select
                  value={form.source_type}
                  onValueChange={(v) => setForm(f => ({ ...f, source_type: v as MapLayerInsert['source_type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geojson_file">GeoJSON-Datei (public/data/)</SelectItem>
                    <SelectItem value="geojson_url">GeoJSON-URL (extern)</SelectItem>
                    <SelectItem value="database">Datenbank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.source_type !== 'database' && (
                <div className="col-span-2">
                  <Label>
                    {form.source_type === 'geojson_file' ? 'Dateipfad' : 'URL'}
                  </Label>
                  <Input
                    value={form.source_path || ''}
                    onChange={(e) => setForm(f => ({ ...f, source_path: e.target.value }))}
                    placeholder={
                      form.source_type === 'geojson_file'
                        ? '/data/schulen.geojson'
                        : 'https://...'
                    }
                  />
                </div>
              )}

              <div className="col-span-2">
                <Label>Label-Property (für Popup)</Label>
                <Input
                  value={form.label_property || ''}
                  onChange={(e) => setForm(f => ({ ...f, label_property: e.target.value }))}
                  placeholder="z.B. name, Name, GEN"
                />
              </div>
            </div>

            {/* Style settings */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Darstellung</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Randfarbe</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.stroke_color}
                      onChange={(e) => setForm(f => ({ ...f, stroke_color: e.target.value }))}
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.stroke_color}
                      onChange={(e) => setForm(f => ({ ...f, stroke_color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Füllfarbe</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.fill_color}
                      onChange={(e) => setForm(f => ({ ...f, fill_color: e.target.value }))}
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.fill_color}
                      onChange={(e) => setForm(f => ({ ...f, fill_color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Fülltransparenz: {Math.round(form.fill_opacity * 100)}%</Label>
                  <Slider
                    value={[form.fill_opacity]}
                    onValueChange={([v]) => setForm(f => ({ ...f, fill_opacity: v }))}
                    min={0}
                    max={1}
                    step={0.05}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Randstärke: {form.stroke_width}px</Label>
                  <Slider
                    value={[form.stroke_width]}
                    onValueChange={([v]) => setForm(f => ({ ...f, stroke_width: v }))}
                    min={0.5}
                    max={6}
                    step={0.5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Strichelung (optional)</Label>
                  <Input
                    value={form.stroke_dash_array || ''}
                    onChange={(e) => setForm(f => ({ ...f, stroke_dash_array: e.target.value || null }))}
                    placeholder="z.B. 8, 4"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Standardmäßig sichtbar</Label>
                <Switch
                  checked={form.visible_by_default}
                  onCheckedChange={(v) => setForm(f => ({ ...f, visible_by_default: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktiv</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="border-t pt-4">
              <Label className="text-xs text-muted-foreground">Vorschau</Label>
              <div className="mt-2 p-4 bg-muted/30 rounded-lg flex items-center justify-center">
                <svg width="120" height="80" viewBox="0 0 120 80">
                  <rect
                    x="10" y="10" width="100" height="60" rx="4"
                    fill={form.fill_color}
                    fillOpacity={form.fill_opacity}
                    stroke={form.stroke_color}
                    strokeWidth={form.stroke_width}
                    strokeDasharray={form.stroke_dash_array || undefined}
                  />
                </svg>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingLayer ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
