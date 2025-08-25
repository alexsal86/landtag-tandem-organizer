import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DialogClose } from '@/components/ui/dialog';
import { Loader2, Copy, Eye, EyeOff } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: "praktikant", label: "Praktikant" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "abgeordneter", label: "Abgeordneter" }
];

interface NewUserFormProps {
  onSuccess: () => void;
}

export const NewUserForm: React.FC<NewUserFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('praktikant');
  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    email: string;
    password: string;
    display_name: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !displayName) {
      toast({
        title: 'Fehler',
        description: 'E-Mail und Anzeigename sind erforderlich.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email,
          displayName,
          role: role === 'none' ? null : role
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Unbekannter Fehler');
      }

      setCreatedUser(data.user);
      
      toast({
        title: 'Benutzer erfolgreich erstellt',
        description: `${displayName} wurde erfolgreich erstellt.`,
      });

    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Fehler beim Erstellen des Benutzers',
        description: error.message || 'Ein unbekannter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Kopiert',
      description: 'In die Zwischenablage kopiert.',
    });
  };

  const handleClose = () => {
    if (createdUser) {
      onSuccess();
      setCreatedUser(null);
      setEmail('');
      setDisplayName('');
      setRole('praktikant');
    }
  };

  if (createdUser) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="font-medium text-green-800 mb-2">Benutzer erfolgreich erstellt!</h3>
          <p className="text-sm text-green-700 mb-4">
            Bitte teilen Sie die folgenden Login-Daten mit dem neuen Benutzer:
          </p>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-green-700">E-Mail-Adresse</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={createdUser.email} 
                  readOnly 
                  className="bg-white text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdUser.email)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs font-medium text-green-700">Temporäres Passwort</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  value={createdUser.password} 
                  readOnly 
                  className="bg-white text-sm font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdUser.password)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-green-600 mt-3">
            Der Benutzer sollte das Passwort nach der ersten Anmeldung ändern.
          </p>
        </div>
        
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button onClick={handleClose}>
              Schließen
            </Button>
          </DialogClose>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">E-Mail-Adresse *</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="benutzer@example.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="displayName">Anzeigename *</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Max Mustermann"
          required
        />
      </div>

      <div>
        <Label htmlFor="role">Rolle</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Abbrechen
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Benutzer erstellen
        </Button>
      </div>
    </form>
  );
};