import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { addAuditLog } from "@/lib/queries";
import { safeLogger } from "@/lib/safe-logger";

interface MaskedFieldProps {
  value: string;
  type: "phone" | "email" | "budget";
  /** Customer / lead display name for audit trail */
  entityName?: string;
  /** Customer / lead id for audit trail */
  entityId?: string;
}

const FIELD_LABELS: Record<MaskedFieldProps["type"], string> = {
  phone: "phone number",
  email: "email address",
  budget: "budget",
};

export function MaskedField({ value, type, entityName, entityId }: MaskedFieldProps) {
  const { role, user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  const isSalesExec = role === "sales_executive";
  const viewerName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Sales Executive";
  const subject = entityName?.trim() || "a customer";

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

    if (isSalesExec) {
      const confirmReveal = window.confirm(
        `Security notice: Viewing the ${FIELD_LABELS[type]} for "${subject}" will be recorded in Audit Logs. Continue?`,
      );
      if (!confirmReveal) return;
      toast.info("Access recorded in Audit Logs.");
      void logRevealEvent();
    } else {
      void logRevealEvent();
    }

    setRevealed(true);
  };

  const logRevealEvent = async () => {
    const fieldLabel = FIELD_LABELS[type];
    const detail = entityId
      ? `${viewerName} viewed the ${fieldLabel} of ${subject} (Customer ID: ${entityId})`
      : `${viewerName} viewed the ${fieldLabel} of ${subject}`;

    try {
      await addAuditLog(`REVEAL_CONFIDENTIAL_${type.toUpperCase()}`, "Hidden / Masked", detail, {
        entityName: subject,
        entityId: entityId || "",
        fieldType: type,
      });
    } catch (e) {
      safeLogger.error("Failed to write reveal audit log");
    }

    if (window.electronSecurity?.logSecurityEvent) {
      window.electronSecurity.logSecurityEvent({
        action: "CONFIDENTIAL_DATA_REVEALED",
        fieldType: type,
        entityId: entityId || null,
        timestamp: new Date().toISOString(),
      });
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
        title={revealed ? "Hide this field again" : "Reveal confidential field"}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
