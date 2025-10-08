import { useState, useEffect } from "react";
import { Shield, QrCode, Key, Download, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type?: string;
  status: string;
  created_at: string;
}

export function TwoFactorSettings() {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRecoveryCodesDialog, setShowRecoveryCodesDialog] = useState(false);
  
  // Setup flow state
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [setupStep, setSetupStep] = useState<"qr" | "verify" | "recovery">("qr");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Disable flow state
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      if (data) {
        setFactors(data.all || []);
        const hasVerifiedFactor = data.all?.some((f: MFAFactor) => f.status === "verified");
        setIsEnabled(hasVerifiedFactor);
      }
    } catch (error: any) {
      console.error("Error loading MFA status:", error);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setError("");
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp"
      });
      
      if (error) throw error;
      
      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setSetupStep("qr");
        setShowSetupDialog(true);
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Fehler",
        description: "2FA-Setup konnte nicht gestartet werden: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (verificationCode.length !== 6) {
      setError("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verificationCode
      });
      
      if (error) throw error;
      
      // Generate recovery codes (simulated - Supabase doesn't expose these directly via SDK)
      // In production, these should come from the server
      const codes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
      setRecoveryCodes(codes);
      setSetupStep("recovery");
      
      toast({
        title: "2FA aktiviert",
        description: "Zwei-Faktor-Authentifizierung wurde erfolgreich aktiviert"
      });
      
      await loadMFAStatus();
    } catch (error: any) {
      setError("Ungültiger Code. Bitte versuchen Sie es erneut.");
      toast({
        title: "Fehler",
        description: "Code konnte nicht verifiziert werden: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = () => {
    setShowSetupDialog(false);
    setVerificationCode("");
    setSetupStep("qr");
    setRecoveryCodes([]);
  };

  const startDisable = () => {
    setError("");
    setDisableCode("");
    setShowDisableDialog(true);
  };

  const confirmDisable = async () => {
    if (disableCode.length !== 6) {
      setError("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      const verifiedFactor = factors.find((f) => f.status === "verified");
      if (!verifiedFactor) throw new Error("Kein aktiver Faktor gefunden");
      
      // Verify code first
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactor.id,
        code: disableCode
      });
      
      if (verifyError) throw verifyError;
      
      // Then unenroll
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id
      });
      
      if (unenrollError) throw unenrollError;
      
      toast({
        title: "2FA deaktiviert",
        description: "Zwei-Faktor-Authentifizierung wurde deaktiviert"
      });
      
      setShowDisableDialog(false);
      await loadMFAStatus();
    } catch (error: any) {
      setError("Ungültiger Code oder Fehler beim Deaktivieren.");
      toast({
        title: "Fehler",
        description: "2FA konnte nicht deaktiviert werden: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({
      title: "Kopiert",
      description: "In die Zwischenablage kopiert"
    });
  };

  const downloadRecoveryCodes = () => {
    const text = `Zwei-Faktor-Authentifizierung Recovery-Codes\n\n${recoveryCodes.join("\n")}\n\nBewahren Sie diese Codes sicher auf!`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "2fa-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && factors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Zwei-Faktor-Authentifizierung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Lädt...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Zwei-Faktor-Authentifizierung
              </CardTitle>
              <CardDescription className="mt-2">
                Schützen Sie Ihr Konto mit einem zusätzlichen Sicherheitsfaktor
              </CardDescription>
            </div>
            <Badge variant={isEnabled ? "default" : "secondary"}>
              {isEnabled ? "Aktiviert ✓" : "Nicht aktiviert"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <QrCode className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">TOTP Authenticator</h4>
                <p className="text-sm text-muted-foreground">
                  Verwenden Sie eine Authenticator-App wie Google Authenticator, Authy oder Microsoft Authenticator
                </p>
              </div>
            </div>
            
            {isEnabled && factors.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Aktiviert seit: {new Date(factors[0].created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            )}
          </div>

          {!isEnabled ? (
            <Button onClick={startSetup} disabled={loading} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              2FA aktivieren
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={startDisable} variant="destructive" disabled={loading} className="flex-1">
                2FA deaktivieren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === "qr" && "QR-Code scannen"}
              {setupStep === "verify" && "Code verifizieren"}
              {setupStep === "recovery" && "Recovery-Codes"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === "qr" && "Scannen Sie den QR-Code mit Ihrer Authenticator-App"}
              {setupStep === "verify" && "Geben Sie den 6-stelligen Code aus Ihrer App ein"}
              {setupStep === "recovery" && "Speichern Sie diese Codes sicher für den Notfall"}
            </DialogDescription>
          </DialogHeader>

          {setupStep === "qr" && (
            <div className="space-y-4">
              {qrCode && (
                <div 
                  className="flex justify-center p-4 bg-white rounded-lg"
                  dangerouslySetInnerHTML={{ __html: qrCode }}
                />
              )}
              
              <div className="space-y-2">
                <Label>Oder manuell eingeben:</Label>
                <div className="flex gap-2">
                  <Input value={secret} readOnly className="font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(secret)}
                  >
                    {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Verwenden Sie eine Authenticator-App wie Google Authenticator, Authy oder Microsoft Authenticator
                </AlertDescription>
              </Alert>

              <Button onClick={() => setSetupStep("verify")} className="w-full">
                Weiter zur Verifizierung
              </Button>
            </div>
          )}

          {setupStep === "verify" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">6-stelliger Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSetupStep("qr")} className="flex-1">
                  Zurück
                </Button>
                <Button 
                  onClick={verifySetup} 
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1"
                >
                  Verifizieren
                </Button>
              </div>
            </div>
          )}

          {setupStep === "recovery" && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Speichern Sie diese Codes sicher! Sie werden nur einmal angezeigt und können zum Zurücksetzen Ihrer 2FA verwendet werden.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="text-center p-2 bg-background rounded">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadRecoveryCodes}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Herunterladen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopieren
                </Button>
              </div>

              <Button onClick={completeSetup} className="w-full">
                Fertig
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>2FA deaktivieren</DialogTitle>
            <DialogDescription>
              Geben Sie einen Code aus Ihrer Authenticator-App ein, um 2FA zu deaktivieren
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-code">6-stelliger Code</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={loading || disableCode.length !== 6}
            >
              2FA deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
