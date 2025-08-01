import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Mail, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProfileData {
  display_name: string;
  bio: string;
  avatar_url: string;
}

export function EditProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<ProfileData>({
    display_name: "",
    bio: "",
    avatar_url: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          display_name: data.display_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Fehler",
        description: "Profil konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Ihr Profil zu bearbeiten.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: formData.display_name || null,
          bio: formData.bio || null,
          avatar_url: formData.avatar_url || null,
        });

      if (error) throw error;

      toast({
        title: "Profil aktualisiert",
        description: "Ihre Profilinformationen wurden erfolgreich gespeichert.",
      });
      
      navigate("/?section=settings");
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Fehler",
        description: "Profil konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Profil wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Profil bearbeiten</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre persönlichen Informationen
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profilbild */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Profilbild
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-6">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={formData.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {getInitials(formData.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Label htmlFor="avatar_url">Avatar URL</Label>
                      <Input
                        id="avatar_url"
                        placeholder="https://beispiel.com/avatar.jpg"
                        value={formData.avatar_url}
                        onChange={(e) => handleInputChange("avatar_url", e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Geben Sie eine URL zu Ihrem Profilbild ein
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Persönliche Informationen */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Persönliche Informationen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="display_name">Anzeigename</Label>
                    <Input
                      id="display_name"
                      placeholder="Max Mustermann"
                      value={formData.display_name}
                      onChange={(e) => handleInputChange("display_name", e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Dieser Name wird in der Anwendung angezeigt
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">E-Mail-Adresse</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Die E-Mail-Adresse kann nicht geändert werden
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Über mich</Label>
                    <Textarea
                      id="bio"
                      placeholder="Erzählen Sie etwas über sich..."
                      rows={4}
                      value={formData.bio}
                      onChange={(e) => handleInputChange("bio", e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Eine kurze Beschreibung über Sie
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              <Card className="bg-card shadow-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Button 
                      type="submit" 
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? "Wird gespeichert..." : "Profil speichern"}
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/")}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Hinweise */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Hinweise</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>• Ihr Anzeigename ist für andere Benutzer sichtbar</li>
                    <li>• Das Profilbild sollte eine öffentlich zugängliche URL sein</li>
                    <li>• Ihre E-Mail-Adresse bleibt privat</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfile;