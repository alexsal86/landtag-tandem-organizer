import React, { useEffect, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface UserSelectorProps {
  onSelect: (user: User) => void;
  selectedUserId?: string;
  placeholder?: string;
  className?: string;
  clearAfterSelect?: boolean;
  excludeUserIds?: string[];
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  onSelect,
  selectedUserId,
  placeholder = "Teammitglied auswählen...",
  className = "",
  clearAfterSelect = false,
  excludeUserIds = []
}) => {
  const { currentTenant } = useTenant();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('UserSelector: Fetching users, tenant:', currentTenant?.id);
    fetchUsers();
  }, [currentTenant?.id]);

  useEffect(() => {
    if (selectedUserId && users.length > 0) {
      const user = users.find(u => u.id === selectedUserId);
      setSelectedUser(user || null);
    }
  }, [selectedUserId, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let usersData: User[] = [];

      // Try to get users from tenant memberships first
      if (currentTenant?.id) {
        const { data, error } = await supabase
          .from('user_tenant_memberships')
          .select(`
            user_id,
            is_active,
            profiles:user_id (
              user_id,
              display_name,
              avatar_url
            )
          `)
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          usersData = data
            .filter(membership => membership.profiles)
            .map(membership => ({
              id: (membership.profiles as any).user_id,
              display_name: (membership.profiles as any).display_name || 'Unbekannt',
              avatar_url: (membership.profiles as any).avatar_url
            }));
        }
      }

      // Fallback: if no tenant or no users found, load all profiles
      if (usersData.length === 0) {
        console.log('UserSelector: Fallback to all profiles');
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url');

        if (!profilesError && profilesData) {
          usersData = profilesData.map(p => ({
            id: p.user_id,
            display_name: p.display_name || 'Unbekannt',
            avatar_url: p.avatar_url
          }));
        }
      }

      usersData.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users
    .filter(user => !excludeUserIds.includes(user.id))
    .filter(user =>
      user.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleUserSelect = (user: User) => {
    if (clearAfterSelect) {
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
    }
    setIsOpen(false);
    setSearchTerm('');
    onSelect(user);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const UserItem: React.FC<{ user: User }> = ({ user }) => (
    <div
      className="flex items-center gap-3 p-2 hover:bg-muted rounded-sm cursor-pointer"
      onClick={() => handleUserSelect(user)}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback>
          {getInitials(user.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <span className="font-medium truncate">{user.display_name}</span>
      </div>

      {selectedUserId === user.id && (
        <Check className="h-4 w-4 text-primary" />
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        type="button"
        className="w-full justify-between text-left"
      >
        {selectedUser ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={selectedUser.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(selectedUser.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedUser.display_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <Search className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Teammitglieder durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Teammitglieder werden geladen...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'Keine Teammitglieder gefunden' : 'Keine Teammitglieder verfügbar'}
              </div>
            ) : (
              <div className="p-1">
                {filteredUsers.map((user) => (
                  <UserItem key={user.id} user={user} />
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-2 border-t bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="w-full"
            >
              Schließen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
