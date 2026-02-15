import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useLoginCustomization } from "@/hooks/useLoginCustomization";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";
import { useFavicon } from "@/hooks/useFavicon";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { customization, isLoading: customLoading } = useLoginCustomization();

  useFavicon(customization.logo_url);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName
        }
      }
    });

    setLoading(false);

    if (error) {
      if (error.message.includes("User already registered")) {
        setError("Diese E-Mail-Adresse ist bereits registriert. Bitte versuchen Sie sich anzumelden.");
      } else {
        setError(error.message);
      }
    } else {
      // Log signup
      logAuditEvent({ 
        action: AuditActions.SIGNUP, 
        email,
        details: { display_name: displayName }
      });
      toast({
        title: "Registrierung erfolgreich",
        description: "Bitte überprüfen Sie Ihre E-Mail für den Bestätigungslink.",
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      // Log failed login attempt
      logAuditEvent({ 
        action: AuditActions.LOGIN_FAILED, 
        email,
        details: { error: error.message }
      });
      if (error.message.includes("Invalid login credentials")) {
        setError("Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.");
      } else {
        setError(error.message);
      }
      return;
    }

    // Check if MFA is required
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedFactor = factors?.all?.some((f: any) => f.status === "verified");
    
    if (hasVerifiedFactor && factors?.all && factors.all.length > 0) {
      setFactorId(factors.all[0].id);
      setShowMfaChallenge(true);
    } else {
      // Log successful login (no MFA)
      logAuditEvent({ 
        action: AuditActions.LOGIN_SUCCESS, 
        email,
        details: { mfa_used: false }
      });
      navigate("/");
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: mfaCode
      });

      if (error) throw error;

      // Log successful MFA verification
      logAuditEvent({ 
        action: AuditActions.MFA_VERIFIED, 
        email,
        details: { mfa_used: true }
      });
      
      // Log successful login with MFA
      logAuditEvent({ 
        action: AuditActions.LOGIN_SUCCESS, 
        email,
        details: { mfa_used: true }
      });
      
      navigate("/");
    } catch (error: any) {
      // Log failed MFA attempt
      logAuditEvent({ 
        action: AuditActions.MFA_FAILED, 
        email,
        details: { error: 'Invalid MFA code' }
      });
      setError("Ungültiger 2FA-Code. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  if (customLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding & Background */}
      <div 
        className="hidden lg:flex lg:w-2/5 relative overflow-hidden"
        style={{
          backgroundImage: customization.background_image_url 
            ? `url(${customization.background_image_url})` 
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: customization.background_position || 'center'
        }}
      >
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-transparent"
          style={{
            background: `linear-gradient(135deg, ${customization.primary_color || '#57ab27'}aa, ${customization.primary_color || '#57ab27'}66, transparent)`
          }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          {customization.logo_url && (
            <div className="mb-8 animate-fade-in">
              <img 
                src={customization.logo_url} 
                alt="Logo" 
                className="h-24 w-auto object-contain drop-shadow-lg"
              />
            </div>
          )}
          
          <h1 className="font-headline text-4xl font-bold text-center mb-4 animate-fade-in">
            {customization.welcome_text || 'Willkommen bei LandtagsOS'}
          </h1>
          
          <p className="text-lg text-center text-white/90 mb-8 animate-fade-in">
            {customization.tagline || 'Ihre politische Arbeit. Organisiert.'}
          </p>

          <div className="mt-auto text-sm text-white/70 text-center">
            {customization.footer_text || '© 2025 LandtagsOS'}
          </div>

          {/* Unsplash Attribution */}
          {customization.background_attribution && (
            <div className="absolute bottom-4 right-4 text-xs text-white/50">
              Foto von{' '}
              <a 
                href={customization.background_attribution.photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/70"
              >
                {customization.background_attribution.photographerName}
              </a>
              {' '}auf{' '}
              <a 
                href="https://unsplash.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/70"
              >
                Unsplash
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 lg:w-3/5 flex items-center justify-center p-6 bg-background">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-6 left-6">
          {customization.logo_url && (
            <img 
              src={customization.logo_url} 
              alt="Logo" 
              className="h-12 w-auto object-contain"
            />
          )}
        </div>

        <Card className="w-full max-w-md shadow-elegant animate-scale-in-bounce border-0">
          <CardContent className="pt-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Anmelden</TabsTrigger>
                {customization.registration_enabled && (
                  <TabsTrigger value="signup">Registrieren</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="signin">
                {!showMfaChallenge ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-Mail</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ihre.email@beispiel.de"
                      className="transition-all focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Passwort</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Ihr Passwort"
                      className="transition-all focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full font-semibold"
                    disabled={loading}
                    style={{
                      backgroundColor: customization.primary_color || '#57ab27'
                    }}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Anmelden
                  </Button>
                </form>
                ) : (
                  <form onSubmit={handleMfaVerify} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg mb-2">Zwei-Faktor-Authentifizierung</h3>
                      <p className="text-sm text-muted-foreground">
                        Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-code">6-stelliger Code</Label>
                      <Input
                        id="mfa-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                        required
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest font-mono transition-all focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full font-semibold"
                      disabled={loading || mfaCode.length !== 6}
                      style={{
                        backgroundColor: customization.primary_color || '#57ab27'
                      }}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verifizieren
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setShowMfaChallenge(false);
                        setMfaCode("");
                        setError("");
                      }}
                    >
                      Zurück
                    </Button>
                  </form>
                )}
              </TabsContent>
              
              {customization.registration_enabled && (
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Anzeigename</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ihr Name"
                        className="transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-Mail</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="ihre.email@beispiel.de"
                        className="transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Passwort</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Mindestens 6 Zeichen"
                        minLength={6}
                        className="transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full font-semibold" 
                      disabled={loading}
                      style={{
                        backgroundColor: customization.primary_color || '#57ab27'
                      }}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Registrieren
                    </Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>

            {/* Mobile Footer */}
            <div className="mt-6 text-center text-sm text-muted-foreground lg:hidden">
              {customization.footer_text || '© 2025 LandtagsOS'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
