import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SenderInformationManager } from './SenderInformationManager';
import { InformationBlockManager } from './InformationBlockManager';
import LetterTemplateManager from '../LetterTemplateManager';
import { EmployeesView } from '../EmployeesView';
import { NotificationSettings } from '../NotificationSettings';
import { StatusAdminSettings } from '../StatusAdminSettings';
import { ExternalCalendarSettings } from '../ExternalCalendarSettings';
import { EventPlanningView } from '../EventPlanningView';
import { useAuth } from '@/hooks/useAuth';
import { Users, Settings, FileText, Calendar, Bell, Mail, Info, MapPin } from 'lucide-react';

export const AdministrationTabs: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Bitte melden Sie sich an, um auf die Administration zuzugreifen.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Benutzer, Templates und Einstellungen Ihrer Organisation
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Mitarbeiter</span>
          </TabsTrigger>
          <TabsTrigger value="letter-templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Brief-Templates</span>
          </TabsTrigger>
          <TabsTrigger value="sender-info" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Absender</span>
          </TabsTrigger>
          <TabsTrigger value="info-blocks" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Info-Blöcke</span>
          </TabsTrigger>
          <TabsTrigger value="event-planning" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Benachrichtigung</span>
          </TabsTrigger>
          <TabsTrigger value="status-settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Status</span>
          </TabsTrigger>
          <TabsTrigger value="external-calendar" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Kalender</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeesView />
        </TabsContent>

        <TabsContent value="letter-templates">
          <LetterTemplateManager />
        </TabsContent>

        <TabsContent value="sender-info">
          <SenderInformationManager />
        </TabsContent>

        <TabsContent value="info-blocks">
          <InformationBlockManager />
        </TabsContent>

        <TabsContent value="event-planning">
          <EventPlanningView />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="status-settings">
          <StatusAdminSettings />
        </TabsContent>

        <TabsContent value="external-calendar">
          <ExternalCalendarSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};