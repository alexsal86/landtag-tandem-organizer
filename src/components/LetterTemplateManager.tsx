import React from 'react';
import { Plus, Save, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { LetterTemplateSettings } from '@/components/letters/LetterTemplateSettings';
import { useLetterTemplateData } from './letter-templates/hooks/useLetterTemplateData';
import { useTemplateFormTabs } from './letter-templates/TemplateFormTabs';
import { TemplateGrid } from './letter-templates/TemplateGrid';

const LetterTemplateManager: React.FC = () => {
  const data = useLetterTemplateData();
  const {
    templates, loading, editingTemplate, showCreateDialog, setShowCreateDialog,
    activeTab, setActiveTab, showPreview, setShowPreview, showSettings, setShowSettings,
    formData, senderInfos, infoBlocks, currentTenant, toast,
    handleCreateTemplate, handleUpdateTemplate, handleDeleteTemplate,
    resetForm, startEditing, cancelEditing, getBlockItems, setBlockItems, setFormData,
  } = data;

  const { renderTabsNavigation, renderCommonTabsContent } = useTemplateFormTabs({
    activeTab, setActiveTab, formData, setFormData,
    editingTemplate, senderInfos, infoBlocks,
    handleCreateTemplate, resetForm, setShowCreateDialog,
    getBlockItems, setBlockItems, currentTenant, toast,
  });

  return (
    <div className="space-y-6">
      {!editingTemplate && !showSettings && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />Einstellungen
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => { if (showCreateDialog) { setShowCreateDialog(false); resetForm(); } else { setShowCreateDialog(true); resetForm(); setActiveTab('canvas-designer'); } }}>
            <Plus className="h-4 w-4 mr-2" />{showCreateDialog ? 'Erstellung schließen' : 'Neues Template'}
          </Button>
        </div>
      )}

      {showSettings && <LetterTemplateSettings onBack={() => setShowSettings(false)} />}

      {showCreateDialog && !editingTemplate && (
        <Card>
          <CardHeader><CardTitle>Neues Brief-Template erstellen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {renderTabsNavigation()}
              {renderCommonTabsContent()}
            </Tabs>
            {activeTab !== 'canvas-designer' && activeTab !== 'header-designer' && (
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>Abbrechen</Button>
                <Button className="w-full sm:w-auto" onClick={handleCreateTemplate}>Template erstellen</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!showCreateDialog && !editingTemplate && !showSettings && (loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Templates werden geladen...</p>
        </div>
      ) : (
        <TemplateGrid templates={templates} showPreview={showPreview} setShowPreview={setShowPreview} startEditing={startEditing} handleDeleteTemplate={handleDeleteTemplate} />
      ))}

      {editingTemplate && !showCreateDialog && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl break-words">Template bearbeiten: {editingTemplate.name}</h2>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button className="w-full sm:w-auto" variant="outline" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
              <Button className="w-full sm:w-auto" onClick={handleUpdateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {renderTabsNavigation()}
            {renderCommonTabsContent()}
          </Tabs>
        </div>
      )}

      {templates.length === 0 && !loading && !showCreateDialog && !editingTemplate && (
        <div className="text-center py-8 text-muted-foreground">
          <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine Templates vorhanden.</p>
          <p className="text-sm">Erstellen Sie Ihr erstes Template.</p>
        </div>
      )}
    </div>
  );
};

export default LetterTemplateManager;
