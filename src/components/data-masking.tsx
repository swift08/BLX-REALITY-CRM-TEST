import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface MaskedFieldProps {
  value: string;
  type: "phone" | "email" | "budget";
}

export function MaskedField({ value, type }: MaskedFieldProps) {
  const { role, user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  // Checks: Sales Executives are restricted (masked) unless they reveal it.
  const isSalesExec = role === "sales_executive";

  const getMaskedValue = () => {
    if (!value) return "—";
    if (type === "phone") {
      const cleaned = value.replace(/\D/g, "");
      if (cleaned.length >= 10) {
        return `+91 XXXXX${cleaned.slice(-5)}`;
      }
      return "XXXXX XXXXX";
    }
    if (type === "email") {
      const parts = value.split("@");
      if (parts.length === 2) {
        const [username, domain] = parts;
        return `${username.substring(0, 2)}****@${domain}`;
      }
      return "****@****";
    }
    return "••••••••";
  };

  const handleToggle = () => {
    if (revealed) {
      setRevealed(false);
      return;
    }

    // Trigger reveal validation
    if (isSalesExec) {
      const confirmReveal = window.confirm(
        "Security Notice: Revealing confidential data will write an audit log entry. Proceed?",
      );
      if (!confirmReveal) return;

      toast.info("Access logged. Revealing field values.");
      logRevealEvent();
    } else {
      logRevealEvent();
    }

    setRevealed(true);
  };

  const logRevealEvent = () => {
    if (window.electronSecurity?.logSecurityEvent) {
      window.electronSecurity.logSecurityEvent({
        action: "CONFIDENTIAL_DATA_REVEALED",
        user: user?.email,
        fieldType: type,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn(
        `[Security Audit]: Confidential data revealed - Type: ${type}, User: ${user?.email}`,
      );
    }
  };

  if (!isSalesExec) {
    return <span>{value || "—"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span>{revealed ? value : getMaskedValue()}</span>
      <button
        onClick={handleToggle}
        type="button"
        className="text-primary hover:text-primary/80 transition-colors p-0.5 rounded focus:outline-none"
        title={revealed ? "Mask field data" : "Reveal confidential field data"}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
