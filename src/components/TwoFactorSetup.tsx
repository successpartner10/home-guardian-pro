// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// TOTP-based Two-Factor Authentication component.
// Uses Google Authenticator / Authy compatible TOTP codes.
import { useState, useEffect } from "react";
import * as OTPAuth from "otpauth";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Smartphone, KeyRound, Copy, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TwoFactorSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [secret, setSecret] = useState<OTPAuth.TOTP | null>(null);
  const [secretUri, setSecretUri] = useState("");
  const [secretBase32, setSecretBase32] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);

  // Check if 2FA is already enabled for this user
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const snap = await getDoc(doc(db, "profiles", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setIs2FAEnabled(!!data.totp_enabled);
        }
      } catch (_) {}
      setLoading(false);
    };
    check();
  }, [user]);

  const generateSecret = () => {
    const totp = new OTPAuth.TOTP({
      issuer: "HGUARD Elite",
      label: user?.email || "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    setSecret(totp);
    setSecretUri(totp.toString());
    setSecretBase32(totp.secret.base32);
    setShowSetup(true);
    setVerifyCode("");
    setVerifyStatus("idle");
  };

  const verifyAndEnable = async () => {
    if (!secret || !user || verifyCode.length !== 6) return;
    const delta = secret.validate({ token: verifyCode, window: 1 });
    if (delta !== null) {
      // Valid — save the secret to Firestore (encrypted in prod, plain for demo)
      try {
        await updateDoc(doc(db, "profiles", user.uid), {
          totp_enabled: true,
          totp_secret: secretBase32,
          totp_enabled_at: new Date().toISOString(),
        });
        setIs2FAEnabled(true);
        setVerifyStatus("success");
        setShowSetup(false);
        toast({ title: "2FA Activated", description: "Your account is now protected with TOTP two-factor authentication." });
      } catch (e: any) {
        toast({ title: "Failed to save", description: e.message, variant: "destructive" });
      }
    } else {
      setVerifyStatus("error");
    }
  };

  const disable2FA = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), {
        totp_enabled: false,
        totp_secret: "",
      });
      setIs2FAEnabled(false);
      setSecret(null);
      setShowSetup(false);
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed." });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return null;

  return (
    <div className="bg-card border-2 border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            is2FAEnabled ? "bg-green-500/15 text-green-500" : "bg-primary/10 text-primary"
          )}>
            {is2FAEnabled ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">Two-Factor Authentication</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              {is2FAEnabled ? "Active — TOTP Verified" : "Not Enabled — Recommended"}
            </p>
          </div>
        </div>
        {is2FAEnabled ? (
          <Button variant="outline" size="sm" onClick={disable2FA} className="h-8 text-[10px] font-black rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
            Disable
          </Button>
        ) : (
          <Button size="sm" onClick={generateSecret} className="h-8 text-[10px] font-black rounded-xl bg-primary">
            <KeyRound className="h-3 w-3 mr-1.5" /> Enable 2FA
          </Button>
        )}
      </div>

      {/* Explanation */}
      <div className="p-3 bg-muted/40 border border-border/60 rounded-xl">
        <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
          <strong className="text-foreground">Why TOTP?</strong> Time-based One-Time Passwords are significantly stronger than email-only login.
          Each code expires in 30 seconds and is generated offline by your authenticator app (Google Authenticator, Authy, Microsoft Authenticator).
          Even if someone steals your password, they cannot login without the rotating code from your physical device.
        </p>
      </div>

      {/* Status badge */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl border",
        is2FAEnabled
          ? "bg-green-500/5 border-green-500/20"
          : "bg-orange-500/5 border-orange-500/20"
      )}>
        {is2FAEnabled ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-[10px] font-black uppercase text-green-400">Protected — TOTP authenticator linked to this account</span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="text-[10px] font-black uppercase text-orange-400">Vulnerable — Only email/password protects this account</span>
          </>
        )}
      </div>

      {/* Setup Flow */}
      <AnimatePresence>
        {showSetup && secret && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-2 border-t border-border/40">
              {/* Step 1: QR Code */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-foreground">Step 1: Scan QR Code</p>
                <p className="text-[10px] text-muted-foreground">Open Google Authenticator, Authy, or any TOTP app and scan this code.</p>
                <div className="flex justify-center p-6 bg-white rounded-2xl border border-border">
                  <QRCodeSVG value={secretUri} size={180} level="M" />
                </div>
              </div>

              {/* Manual entry */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Or enter this key manually:</p>
                <div className="flex items-center gap-2 p-2.5 bg-muted rounded-xl border border-border">
                  <code className="text-[11px] font-mono font-bold text-foreground flex-1 break-all select-all">{secretBase32}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(secretBase32); toast({ title: "Copied", description: "Secret key copied to clipboard." }); }}
                    className="h-7 w-7 rounded-lg bg-background flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Step 2: Verify */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-foreground">Step 2: Verify Code</p>
                <p className="text-[10px] text-muted-foreground">Enter the 6-digit code from your authenticator app to confirm setup.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, "")); setVerifyStatus("idle"); }}
                    placeholder="000000"
                    className={cn(
                      "h-14 flex-1 text-center text-2xl font-black tracking-[0.5em] rounded-xl border-2 bg-background",
                      verifyStatus === "error" ? "border-red-500 text-red-500" :
                      verifyStatus === "success" ? "border-green-500 text-green-500" :
                      "border-border"
                    )}
                  />
                  <Button
                    onClick={verifyAndEnable}
                    disabled={verifyCode.length !== 6}
                    className="h-14 px-6 rounded-xl font-black"
                  >
                    Verify
                  </Button>
                </div>
                {verifyStatus === "error" && (
                  <div className="flex items-center gap-1.5 text-red-500">
                    <XCircle className="h-3 w-3" />
                    <span className="text-[10px] font-black uppercase">Invalid code — try again</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
