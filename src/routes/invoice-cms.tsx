import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import {
  useInvoiceSettings,
  useUpdateInvoiceSettings,
  useInvoicePermissions,
  useUpdateInvoicePermissions,
  useCRMUsers,
  useUserInvoicePermissions,
  useUpdateUserInvoicePermissions,
  useAuditLogs,
  type InvoiceSettings,
  type InvoiceRolePermission,
  type UserInvoicePermission,
} from "@/lib/queries";
import { generateInvoiceHtmlContent, downloadPdfInvoice } from "@/lib/pdf-generator";
import {
  Building,
  Landmark,
  Receipt,
  FileText,
  Palette,
  Layout,
  ShieldCheck,
  History,
  Save,
  CheckCircle2,
  Sparkles,
  Download,
  AlertTriangle,
  QrCode,
  DollarSign,
  FileSpreadsheet,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/invoice-cms")({
  head: () => ({ meta: [{ title: "Invoice CMS · BLX Realty CRM" }] }),
  component: InvoiceCMSPage,
});

function InvoiceCMSPage() {
  const { role, user } = useAuth();
  const userCan = can(role);

  // Queries & Mutations
  const { data: settingsData, isLoading: isSettingsLoading } = useInvoiceSettings();
  const updateSettingsMutation = useUpdateInvoiceSettings();

  const { data: permissionsData, isLoading: isPermissionsLoading } = useInvoicePermissions();
  const updatePermissionsMutation = useUpdateInvoicePermissions();

  const { data: crmUsers = [] } = useCRMUsers();
  const { data: userPermissionsData } = useUserInvoicePermissions();
  const updateUserPermissionsMutation = useUpdateUserInvoicePermissions();

  const { data: auditLogs = [] } = useAuditLogs();

  // Local Form States
  const [formData, setFormData] = useState<InvoiceSettings | null>(null);
  const [permissionMatrix, setPermissionMatrix] = useState<InvoiceRolePermission[]>([]);
  const [userPermissionList, setUserPermissionList] = useState<UserInvoicePermission[]>([]);
  const [userFilterRole, setUserFilterRole] = useState<string>("all");
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("modern_executive");
  const [previewTab, setPreviewTab] = useState<"desktop" | "sample">("desktop");
  const [savingSection, setSavingSection] = useState<string | null>(null);

const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  id: "inv_settings_default",
  company_info: {
    company_name: "BLX REALITY PRIVATE LIMITED",
    logo_url: "",
    registered_address:
      "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
    branch_address:
      "#301D, 3rd Floor, Tower B, Brigade Twin Towers, Pipeline Road HMT, Yeswanthpur, Bengaluru, Karnataka 560022",
    phone: "+91-9743264328 / +44-7944450039 / +91-8197773166",
    email: "discoverblr@theblxrealty.com",
    website: "www.theblxrealty.com",
    gst_number: "29AAOCB0144P1Z7",
    pan_number: "AAOCB0144P",
    cin: "U68100KA2025PTC209397",
    rera_number: "PRM/KA/RERA/1251/310/PR/251006",
  },
  banking_details: {
    bank_name: "HDFC Bank Ltd",
    account_holder: "BLX REALTY PRIVATE LIMITED - CLIENT ESCROW A/C",
    account_number: "50200089123456",
    ifsc_code: "HDFC0000240",
    branch_name: "Yeswanthpur Industrial Area Branch, Bengaluru",
    upi_id: "blxrealty@hdfcbank",
    qr_code_url: "",
  },
  tax_statutory: {
    gst_enabled: true,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 18,
    tds_enabled: false,
    tds_rate: 1,
    pf_enabled: true,
    pf_code: "KAR/BLR/1098234/000",
    esi_enabled: true,
    esi_code: "53000981720000101",
    statutory_notes:
      "GST is applicable as per Ministry of Finance notification for Real Estate Services.",
  },
  invoice_notes: {
    payment_instructions:
      "Please make all payments via Bank Transfer / RTGS / NEFT or UPI strictly using official company accounts.",
    terms_and_conditions:
      "1. All booking advances are subject to final agreement terms.\n2. Holding deposits are valid for 15 days from issuance.\n3. This document is a computer-generated tax invoice.",
    cancellation_policy:
      "Cancellations within 7 days receive 90% refund. Post 7 days, cancellation is governed by RERA rules.",
    refund_policy:
      "Refunds are processed within 10 business days directly to the original bank account.",
    late_payment_policy:
      "1.5% monthly interest penalty applied on overdue installments beyond 15 days.",
    legal_disclaimer: "BLX Realty Pvt Ltd is a licensed RERA real estate agency.",
    thank_you_message:
      "Thank you for choosing BLX Realty as your trusted property partner!",
    customer_support: "Desk: +91 81977 73166 | support@theblxrealty.com",
  },
  branding: {
    logo_url: "",
    header_style: "modern",
    footer_info:
      "BLX Realty Pvt Ltd · Corporate Real Estate Advisory & Luxury Property Marketing",
    signature_title: "Authorized Signatory",
    signatory_name: "Nischith L. (Director)",
    signature_image_url: "",
    seal_image_url: "",
    primary_color: "#4f46e5",
    secondary_color: "#1e1b4b",
    text_color: "#0f172a",
  },
  numbering: {
    prefix: "INV-2026-",
    suffix: "/BLX",
    start_sequence: 1001,
    padding: 4,
    auto_increment: true,
  },
  payment_info: {
    accepted_methods: [
      "Bank Transfer (NEFT/RTGS)",
      "UPI Payment",
      "Cheque",
      "Demand Draft",
    ],
    payment_due_instructions: "Payment due within 15 days of invoice date.",
    offline_instructions:
      "Deliver cheques favoring 'BLX REALTY PRIVATE LIMITED' at Corporate Office.",
    qr_instructions:
      "Scan UPI QR code using any UPI Banking App to complete instant token transfer.",
  },
  default_template_id: "modern_executive",
};

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
      if (settingsData.default_template_id) {
        setSelectedTemplate(settingsData.default_template_id);
      }
    } else if (!isSettingsLoading && !formData) {
      setFormData(DEFAULT_INVOICE_SETTINGS);
    }
  }, [settingsData, isSettingsLoading, formData]);

  useEffect(() => {
    if (permissionsData) {
      setPermissionMatrix(permissionsData);
    }
  }, [permissionsData]);

  useEffect(() => {
    if (crmUsers.length > 0) {
      const initialUserPerms: UserInvoicePermission[] = crmUsers.map((u) => {
        const existing = userPermissionsData?.find((up) => up.user_id === u.id);
        if (existing) return existing;

        const roleDefault = permissionMatrix.find((p) => p.role === u.role);
        return {
          user_id: u.id,
          user_name: u.name,
          role: u.role,
          can_view_cms:
            roleDefault?.can_view_cms ?? (u.role === "super_admin" || u.role === "admin"),
          can_edit_company_info: roleDefault?.can_edit_company_info ?? u.role === "super_admin",
          can_update_banking: roleDefault?.can_update_banking ?? u.role === "super_admin",
          can_modify_tax: roleDefault?.can_modify_tax ?? u.role === "super_admin",
          can_edit_terms:
            roleDefault?.can_edit_terms ?? (u.role === "super_admin" || u.role === "admin"),
          can_change_branding: roleDefault?.can_change_branding ?? u.role === "super_admin",
          can_manage_templates: roleDefault?.can_manage_templates ?? u.role === "super_admin",
          can_generate_invoices: roleDefault?.can_generate_invoices ?? u.role !== "marketing",
          can_regenerate_invoices:
            roleDefault?.can_regenerate_invoices ??
            (u.role === "super_admin" || u.role === "admin" || u.role === "manager"),
        };
      });
      setUserPermissionList(initialUserPerms);
    }
  }, [crmUsers, userPermissionsData, permissionMatrix]);

  if (isSettingsLoading || !formData) {
    return (
      <AppShell title="Invoice CMS" subtitle="Loading invoice configuration...">
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">
              Loading Invoice CMS engine...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Permission Check for CMS viewing
  if (!userCan.viewInvoiceCMS()) {
    return (
      <AppShell title="Invoice CMS" subtitle="Access Restricted">
        <Card className="border-destructive/30 bg-destructive/5 max-w-xl mx-auto my-12">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-lg">Permission Denied</CardTitle>
            <CardDescription>
              Your role ({userCan.roleLabel()}) is not authorized to access the Invoice CMS settings
              module. Please contact your Super Admin to request access.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  const handleSaveSettings = async (sectionName: string) => {
    if (!formData) return;
    setSavingSection(sectionName);
    try {
      await updateSettingsMutation.mutateAsync({
        settings: { ...formData, default_template_id: selectedTemplate },
        sectionName,
      });
      toast.success(`${sectionName} updated successfully and applied to future invoices!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update invoice settings.");
    } finally {
      setSavingSection(null);
    }
  };

  const handleSavePermissions = async () => {
    try {
      await updatePermissionsMutation.mutateAsync(permissionMatrix);
      toast.success("Role permission matrix saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role permissions.");
    }
  };

  const togglePermission = (roleName: string, permKey: keyof InvoiceRolePermission) => {
    setPermissionMatrix((prev) =>
      prev.map((item) => {
        if (item.role === roleName) {
          return { ...item, [permKey]: !item[permKey] };
        }
        return item;
      }),
    );
  };

  const toggleUserPermission = (userId: string, permKey: keyof UserInvoicePermission) => {
    setUserPermissionList((prev) =>
      prev.map((item) => {
        if (item.user_id === userId) {
          return { ...item, [permKey]: !item[permKey] };
        }
        return item;
      }),
    );
  };

  const handleSaveUserPermissions = async () => {
    try {
      toast.loading("Saving granular team member invoice permissions...", { id: "u-perm" });
      await updateUserPermissionsMutation.mutateAsync(userPermissionList);
      toast.success("Granular team member invoice permissions updated successfully!", {
        id: "u-perm",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update team member permissions.", { id: "u-perm" });
    }
  };

  // Sample data for live preview
  const sampleInvoiceData = {
    bookingId: "book-9941",
    customerName: "Ananya Sharma",
    customerPhone: "+91 98450 12345",
    customerEmail: "ananya.sharma@example.com",
    projectName: "BLX Platinum Heights, Indiranagar",
    unitNumber: "A-1402 (3BHK Luxury)",
    amount: 500000,
    bookingDate: new Date().toISOString(),
  };

  const sampleHtml = generateInvoiceHtmlContent(sampleInvoiceData, formData, selectedTemplate);

  return (
    <AppShell
      title="Invoice CMS & Settings"
      subtitle="Single source of truth for invoice templates, company branding, bank details & role permissions"
    >
      <div className="space-y-6 pb-12">
        {/* Header Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-brand font-bold text-base text-foreground">
                  Invoice Management Center
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Configurable CMS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                All changes saved here will immediately populate newly generated customer invoices.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => downloadPdfInvoice(sampleInvoiceData, formData, selectedTemplate)}
            >
              <Download className="h-3.5 w-3.5" /> Test PDF Export
            </Button>
            {userCan.editInvoiceCompanyInfo() && (
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                disabled={savingSection !== null}
                onClick={() => handleSaveSettings("All Settings")}
              >
                <Save className="h-3.5 w-3.5" />{" "}
                {savingSection === "All Settings" ? "Saving..." : "Save All Changes"}
              </Button>
            )}
          </div>
        </div>

        {/* Tabbed Navigation Modules */}
        <Tabs defaultValue="company" className="w-full space-y-6">
          <TabsList className="w-full flex flex-wrap justify-start h-auto p-1.5 bg-card border rounded-xl gap-1 overflow-x-auto">
            <TabsTrigger value="company" className="text-xs gap-1.5 py-2 px-3">
              <Building className="h-3.5 w-3.5" /> Company Info
            </TabsTrigger>
            <TabsTrigger value="banking" className="text-xs gap-1.5 py-2 px-3">
              <Landmark className="h-3.5 w-3.5" /> Banking Details
            </TabsTrigger>
            <TabsTrigger value="tax" className="text-xs gap-1.5 py-2 px-3">
              <Receipt className="h-3.5 w-3.5" /> Tax & Statutory
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1.5 py-2 px-3">
              <FileText className="h-3.5 w-3.5" /> Notes & Policies
            </TabsTrigger>
            <TabsTrigger value="branding" className="text-xs gap-1.5 py-2 px-3">
              <Palette className="h-3.5 w-3.5" /> Branding & Seal
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs gap-1.5 py-2 px-3">
              <Layout className="h-3.5 w-3.5" /> Templates & Preview
            </TabsTrigger>
            <TabsTrigger value="numbering" className="text-xs gap-1.5 py-2 px-3">
              <DollarSign className="h-3.5 w-3.5" /> Numbering & Methods
            </TabsTrigger>
            {role === "super_admin" && (
              <TabsTrigger
                value="permissions"
                className="text-xs gap-1.5 py-2 px-3 text-amber-600 font-bold"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Role Permissions
              </TabsTrigger>
            )}
            <TabsTrigger value="audit" className="text-xs gap-1.5 py-2 px-3">
              <History className="h-3.5 w-3.5" /> Audit History
            </TabsTrigger>
          </TabsList>

          {/* 1. COMPANY INFORMATION */}
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" /> Corporate Business Information
                </CardTitle>
                <CardDescription className="text-xs">
                  This official information will appear on the top header of all tax receipts and
                  invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="company-name">Company Name *</Label>
                    <Input
                      id="company-name"
                      value={formData.company_info.company_name}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, company_name: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="logo-url">Logo Image URL / Base64</Label>
                    <Input
                      id="logo-url"
                      placeholder="https://... or data:image/png;base64,..."
                      value={formData.company_info.logo_url}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, logo_url: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-addr">Registered Office Address</Label>
                    <Textarea
                      id="reg-addr"
                      rows={2}
                      value={formData.company_info.registered_address}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: {
                            ...formData.company_info,
                            registered_address: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-addr">Branch Office Address</Label>
                    <Textarea
                      id="branch-addr"
                      rows={2}
                      value={formData.company_info.branch_address}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: {
                            ...formData.company_info,
                            branch_address: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.company_info.phone}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, phone: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.company_info.email}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, email: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      value={formData.company_info.website}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, website: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gst-num">GST Number (GSTIN)</Label>
                    <Input
                      id="gst-num"
                      value={formData.company_info.gst_number}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, gst_number: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pan-num">PAN Number</Label>
                    <Input
                      id="pan-num"
                      value={formData.company_info.pan_number}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, pan_number: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cin-num">CIN Number</Label>
                    <Input
                      id="cin-num"
                      value={formData.company_info.cin}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, cin: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rera-num">RERA Registration Number</Label>
                    <Input
                      id="rera-num"
                      value={formData.company_info.rera_number}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          company_info: { ...formData.company_info, rera_number: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                {userCan.editInvoiceCompanyInfo() && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Company Info")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Company Details
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. BANKING DETAILS */}
          <TabsContent value="banking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" /> Banking & Escrow Account Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Official bank account and payment gateway details for receiving client token
                  transfers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-name">Bank Name *</Label>
                    <Input
                      id="bank-name"
                      value={formData.banking_details.bank_name}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            bank_name: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-holder">Account Holder Name *</Label>
                    <Input
                      id="acc-holder"
                      value={formData.banking_details.account_holder}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            account_holder: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="acc-num">Account Number *</Label>
                    <Input
                      id="acc-num"
                      className="font-mono"
                      value={formData.banking_details.account_number}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            account_number: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ifsc">IFSC Code *</Label>
                    <Input
                      id="ifsc"
                      className="font-mono uppercase"
                      value={formData.banking_details.ifsc_code}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            ifsc_code: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch">Branch Name</Label>
                    <Input
                      id="branch"
                      value={formData.banking_details.branch_name}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            branch_name: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="upi-id">UPI ID / VPA</Label>
                    <Input
                      id="upi-id"
                      placeholder="e.g. blxrealty@hdfcbank"
                      value={formData.banking_details.upi_id}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: { ...formData.banking_details, upi_id: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-url">Payment QR Code Image URL</Label>
                    <Input
                      id="qr-url"
                      placeholder="https://... or data:image/png;base64,..."
                      value={formData.banking_details.qr_code_url}
                      disabled={!userCan.updateInvoiceBankingDetails()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          banking_details: {
                            ...formData.banking_details,
                            qr_code_url: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                {userCan.updateInvoiceBankingDetails() ? (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Banking Details")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Banking Details
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Updating Bank Details requires Super Admin authority.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. TAX & STATUTORY */}
          <TabsContent value="tax" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" /> Statutory Tax & Regulatory
                  Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure active tax levies (GST, CGST, SGST, IGST), TDS withholding rules, and
                  statutory PF/ESI codes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">Goods and Services Tax (GST)</div>
                      <p className="text-xs text-muted-foreground">
                        Automatically compute CGST + SGST on invoice line items
                      </p>
                    </div>
                    <Switch
                      checked={formData.tax_statutory.gst_enabled}
                      disabled={!userCan.modifyInvoiceTaxInfo()}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          tax_statutory: { ...formData.tax_statutory, gst_enabled: checked },
                        })
                      }
                    />
                  </div>

                  {formData.tax_statutory.gst_enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="cgst">CGST Rate (%)</Label>
                        <Input
                          id="cgst"
                          type="number"
                          value={formData.tax_statutory.cgst_rate}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: {
                                ...formData.tax_statutory,
                                cgst_rate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sgst">SGST Rate (%)</Label>
                        <Input
                          id="sgst"
                          type="number"
                          value={formData.tax_statutory.sgst_rate}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: {
                                ...formData.tax_statutory,
                                sgst_rate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="igst">Integrated IGST Rate (%)</Label>
                        <Input
                          id="igst"
                          type="number"
                          value={formData.tax_statutory.igst_rate}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: {
                                ...formData.tax_statutory,
                                igst_rate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs">TDS Deduction Rule</div>
                        <p className="text-[11px] text-muted-foreground">
                          Section 194IA Property Transfer TDS
                        </p>
                      </div>
                      <Switch
                        checked={formData.tax_statutory.tds_enabled}
                        disabled={!userCan.modifyInvoiceTaxInfo()}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            tax_statutory: { ...formData.tax_statutory, tds_enabled: checked },
                          })
                        }
                      />
                    </div>
                    {formData.tax_statutory.tds_enabled && (
                      <div className="space-y-1">
                        <Label htmlFor="tds-rate" className="text-xs">
                          TDS Rate (%)
                        </Label>
                        <Input
                          id="tds-rate"
                          type="number"
                          value={formData.tax_statutory.tds_rate}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: {
                                ...formData.tax_statutory,
                                tds_rate: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <div className="font-semibold text-xs">PF & ESI Statutory Registrations</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="pf-code" className="text-[11px]">
                          PF Code
                        </Label>
                        <Input
                          id="pf-code"
                          className="h-8 text-xs"
                          value={formData.tax_statutory.pf_code}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: { ...formData.tax_statutory, pf_code: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="esi-code" className="text-[11px]">
                          ESI Code
                        </Label>
                        <Input
                          id="esi-code"
                          className="h-8 text-xs"
                          value={formData.tax_statutory.esi_code}
                          disabled={!userCan.modifyInvoiceTaxInfo()}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tax_statutory: {
                                ...formData.tax_statutory,
                                esi_code: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stat-notes">Statutory Disclaimer & Compliance Notes</Label>
                  <Textarea
                    id="stat-notes"
                    rows={2}
                    value={formData.tax_statutory.statutory_notes}
                    disabled={!userCan.modifyInvoiceTaxInfo()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tax_statutory: {
                          ...formData.tax_statutory,
                          statutory_notes: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                {userCan.modifyInvoiceTaxInfo() && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Tax & Statutory")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Tax Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. NOTES & POLICIES */}
          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Invoice Notes & Policy Terms
                </CardTitle>
                <CardDescription className="text-xs">
                  Default instructions, cancellation rules, late fee clauses, and thank-you messages
                  printed on invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="terms">Master Terms & Conditions *</Label>
                    <Textarea
                      id="terms"
                      rows={4}
                      value={formData.invoice_notes.terms_and_conditions}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            terms_and_conditions: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-instr">Payment Instructions</Label>
                    <Textarea
                      id="pay-instr"
                      rows={4}
                      value={formData.invoice_notes.payment_instructions}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            payment_instructions: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cancellation">Cancellation Policy</Label>
                    <Textarea
                      id="cancellation"
                      rows={2}
                      value={formData.invoice_notes.cancellation_policy}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            cancellation_policy: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="refund">Refund Policy</Label>
                    <Textarea
                      id="refund"
                      rows={2}
                      value={formData.invoice_notes.refund_policy}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            refund_policy: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="late-policy">Late Payment Penalty Clause</Label>
                    <Input
                      id="late-policy"
                      value={formData.invoice_notes.late_payment_policy}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            late_payment_policy: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="thank-you">Thank You Message</Label>
                    <Input
                      id="thank-you"
                      value={formData.invoice_notes.thank_you_message}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            thank_you_message: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="support-info">Customer Support Info</Label>
                    <Input
                      id="support-info"
                      value={formData.invoice_notes.customer_support}
                      disabled={!userCan.editInvoiceTerms()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_notes: {
                            ...formData.invoice_notes,
                            customer_support: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                {userCan.editInvoiceTerms() && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Notes & Terms")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Terms & Notes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5. BRANDING & SIGNATURES */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Invoice Branding & Authorized
                  Signatures
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize corporate color palette, signatory designation, digital stamp seal, and
                  footer text.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="primary-color">Primary Brand Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primary-color"
                        className="h-9 w-12 rounded cursor-pointer border p-1"
                        value={formData.branding.primary_color}
                        disabled={!userCan.changeInvoiceBranding()}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branding: { ...formData.branding, primary_color: e.target.value },
                          })
                        }
                      />
                      <Input
                        value={formData.branding.primary_color}
                        className="font-mono text-xs"
                        disabled={!userCan.changeInvoiceBranding()}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branding: { ...formData.branding, primary_color: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="secondary-color">Secondary Header Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="secondary-color"
                        className="h-9 w-12 rounded cursor-pointer border p-1"
                        value={formData.branding.secondary_color}
                        disabled={!userCan.changeInvoiceBranding()}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branding: { ...formData.branding, secondary_color: e.target.value },
                          })
                        }
                      />
                      <Input
                        value={formData.branding.secondary_color}
                        className="font-mono text-xs"
                        disabled={!userCan.changeInvoiceBranding()}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branding: { ...formData.branding, secondary_color: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="header-style">Header Style Theme</Label>
                    <select
                      id="header-style"
                      className="w-full h-9 rounded border bg-card px-3 text-xs font-semibold"
                      value={formData.branding.header_style}
                      disabled={!userCan.changeInvoiceBranding()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...formData.branding, header_style: e.target.value as any },
                        })
                      }
                    >
                      <option value="modern">Modern Executive</option>
                      <option value="classic">Classic Corporate</option>
                      <option value="minimalist">Minimalist Clean</option>
                      <option value="luxury">Luxury Gold Accent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signatory-name">Authorized Signatory Name</Label>
                    <Input
                      id="signatory-name"
                      value={formData.branding.signatory_name}
                      disabled={!userCan.changeInvoiceBranding()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...formData.branding, signatory_name: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signatory-title">Signatory Official Title</Label>
                    <Input
                      id="signatory-title"
                      value={formData.branding.signature_title}
                      disabled={!userCan.changeInvoiceBranding()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          branding: { ...formData.branding, signature_title: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footer-info">Corporate Footer Info Banner</Label>
                  <Input
                    id="footer-info"
                    value={formData.branding.footer_info}
                    disabled={!userCan.changeInvoiceBranding()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        branding: { ...formData.branding, footer_info: e.target.value },
                      })
                    }
                  />
                </div>

                {userCan.changeInvoiceBranding() && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Branding & Signatures")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Branding Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 6. TEMPLATES & LIVE PREVIEW */}
          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layout className="h-4 w-4 text-primary" /> Invoice Template Selector & Live
                      Interactive Preview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Pick the default invoice layout template and see a live high-fidelity preview
                      with current CMS settings.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selectedTemplate === "modern_executive" ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedTemplate("modern_executive")}
                    >
                      Modern Executive
                    </Button>
                    <Button
                      variant={selectedTemplate === "classic_corporate" ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedTemplate("classic_corporate")}
                    >
                      Classic Corporate
                    </Button>
                    <Button
                      variant={selectedTemplate === "minimalist_clean" ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedTemplate("minimalist_clean")}
                    >
                      Minimalist
                    </Button>
                    <Button
                      variant={selectedTemplate === "luxury_gold" ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedTemplate("luxury_gold")}
                    >
                      Luxury Gold
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="uppercase font-mono text-[10px]">
                      Selected Template: {selectedTemplate.replace("_", " ")}
                    </Badge>
                    {formData.default_template_id === selectedTemplate && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active Default
                      </span>
                    )}
                  </div>
                  {userCan.manageInvoiceTemplates() &&
                    formData.default_template_id !== selectedTemplate && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => handleSaveSettings("Default Template Choice")}
                      >
                        Set as Default Template
                      </Button>
                    )}
                </div>

                {/* Live Interactive Preview Rendering Container */}
                <div className="rounded-xl border bg-slate-900/5 p-4 flex justify-center overflow-x-auto min-h-[500px]">
                  <div
                    className="shadow-2xl rounded-lg overflow-hidden bg-white scale-[0.85] origin-top transform transition-transform"
                    dangerouslySetInnerHTML={{ __html: sampleHtml }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 7. NUMBERING & PAYMENT METHODS */}
          <TabsContent value="numbering" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Invoice Numbering & Payment
                  Instructions
                </CardTitle>
                <CardDescription className="text-xs">
                  Define sequence prefix/suffix rules and accepted client payment options.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="num-prefix">Invoice Prefix</Label>
                    <Input
                      id="num-prefix"
                      value={formData.numbering.prefix}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numbering: { ...formData.numbering, prefix: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="num-suffix">Invoice Suffix</Label>
                    <Input
                      id="num-suffix"
                      value={formData.numbering.suffix}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numbering: { ...formData.numbering, suffix: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seq-start">Sequence Start #</Label>
                    <Input
                      id="seq-start"
                      type="number"
                      value={formData.numbering.start_sequence}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numbering: {
                            ...formData.numbering,
                            start_sequence: parseInt(e.target.value) || 1001,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="num-padding">Padding Length</Label>
                    <Input
                      id="num-padding"
                      type="number"
                      value={formData.numbering.padding}
                      disabled={!userCan.editInvoiceCompanyInfo()}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numbering: {
                            ...formData.numbering,
                            padding: parseInt(e.target.value) || 4,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Generated Sample Invoice ID:{" "}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {formData.numbering.prefix}
                      {String(formData.numbering.start_sequence).padStart(
                        formData.numbering.padding,
                        "0",
                      )}
                      {formData.numbering.suffix}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Auto Increment On
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="due-instructions">Payment Due Instructions</Label>
                  <Input
                    id="due-instructions"
                    value={formData.payment_info.payment_due_instructions}
                    disabled={!userCan.editInvoiceTerms()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payment_info: {
                          ...formData.payment_info,
                          payment_due_instructions: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offline-instructions">Offline Payment Instructions</Label>
                  <Textarea
                    id="offline-instructions"
                    rows={2}
                    value={formData.payment_info.offline_instructions}
                    disabled={!userCan.editInvoiceTerms()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payment_info: {
                          ...formData.payment_info,
                          offline_instructions: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                {userCan.editInvoiceCompanyInfo() && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveSettings("Numbering & Payments")}
                      disabled={savingSection !== null}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Numbering & Methods
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 8. SUPER ADMIN ROLE PERMISSIONS GOVERNANCE */}
          {role === "super_admin" && (
            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-amber-500" /> Invoice Permission
                        Management Matrix
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Super Admin control panel to configure granular Invoice CMS rights for every
                        organizational role.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSavePermissions}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save Role Matrix
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Role</th>
                          <th className="p-3 text-center">View CMS</th>
                          <th className="p-3 text-center">Company Info</th>
                          <th className="p-3 text-center">Banking Details</th>
                          <th className="p-3 text-center">Tax & Statutory</th>
                          <th className="p-3 text-center">Terms & Notes</th>
                          <th className="p-3 text-center">Branding & Seal</th>
                          <th className="p-3 text-center">Templates</th>
                          <th className="p-3 text-center">Generate Invoice</th>
                          <th className="p-3 text-center">Regenerate Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {permissionMatrix.map((item) => (
                          <tr key={item.role} className="hover:bg-muted/20">
                            <td className="p-3 font-bold capitalize text-foreground flex items-center gap-1.5">
                              {item.role === "super_admin" && "👑 "}
                              {item.role === "admin" && "🛠️ "}
                              {item.role === "manager" && "👨‍💼 "}
                              {item.role === "sales_executive" && "💼 "}
                              {item.role === "marketing" && "📢 "}
                              {item.role.replace("_", " ")}
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_view_cms}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() => togglePermission(item.role, "can_view_cms")}
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_edit_company_info}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_edit_company_info")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_update_banking}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_update_banking")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_modify_tax}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_modify_tax")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_edit_terms}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_edit_terms")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_change_branding}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_change_branding")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_manage_templates}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_manage_templates")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_generate_invoices}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_generate_invoices")
                                }
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Switch
                                checked={item.can_regenerate_invoices}
                                disabled={item.role === "super_admin"}
                                onCheckedChange={() =>
                                  togglePermission(item.role, "can_regenerate_invoices")
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* GRANULAR TEAM MEMBER PERMISSION OVERRIDES */}
              <Card className="border-amber-500/20 bg-card">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" /> Granular Team Member Permission
                        Overrides
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Select individual Sales Executives, Managers, or Admins to grant or restrict
                        specific Invoice CMS capabilities.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveUserPermissions}
                        disabled={updateUserPermissionsMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" /> Save User Overrides
                      </Button>
                    </div>
                  </div>

                  {/* Filter & Search Controls */}
                  <div className="flex flex-wrap items-center gap-3 pt-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Filter Role:</Label>
                      <select
                        className="h-8 rounded border bg-card text-xs px-2"
                        value={userFilterRole}
                        onChange={(e) => setUserFilterRole(e.target.value)}
                      >
                        <option value="all">All Roles</option>
                        <option value="sales_executive">Sales Executive</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="marketing">Marketing</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                      <Label className="text-xs text-muted-foreground">Search Member:</Label>
                      <Input
                        placeholder="Search team member..."
                        className="h-8 text-xs"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Team Member</th>
                          <th className="p-3 text-center">View CMS</th>
                          <th className="p-3 text-center">Company Info</th>
                          <th className="p-3 text-center">Banking Details</th>
                          <th className="p-3 text-center">Tax & Statutory</th>
                          <th className="p-3 text-center">Terms & Notes</th>
                          <th className="p-3 text-center">Branding & Seal</th>
                          <th className="p-3 text-center">Templates</th>
                          <th className="p-3 text-center">Generate Invoice</th>
                          <th className="p-3 text-center">Regenerate Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {userPermissionList
                          .filter((u) => userFilterRole === "all" || u.role === userFilterRole)
                          .filter(
                            (u) =>
                              !userSearchTerm ||
                              u.user_name.toLowerCase().includes(userSearchTerm.toLowerCase()),
                          )
                          .map((uPerm) => (
                            <tr key={uPerm.user_id} className="hover:bg-muted/20">
                              <td className="p-3">
                                <div className="font-bold text-foreground">{uPerm.user_name}</div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 capitalize">
                                  <Badge variant="outline" className="text-[9px] py-0 px-1">
                                    {uPerm.role.replace("_", " ")}
                                  </Badge>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_view_cms}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_view_cms")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_edit_company_info}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_edit_company_info")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_update_banking}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_update_banking")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_modify_tax}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_modify_tax")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_edit_terms}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_edit_terms")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_change_branding}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_change_branding")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_manage_templates}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_manage_templates")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_generate_invoices}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_generate_invoices")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={uPerm.can_regenerate_invoices}
                                  disabled={uPerm.role === "super_admin"}
                                  onCheckedChange={() =>
                                    toggleUserPermission(uPerm.user_id, "can_regenerate_invoices")
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* 9. AUDIT HISTORY */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Invoice CMS Audit Trail & Governance
                  Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Historical log tracking every modification made to company details, banking
                  information, statutory rules, branding, and role permissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User / Actor</th>
                        <th className="p-3">Action Type</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {auditLogs
                        .filter((log) => log.action.includes("INVOICE"))
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-muted/20">
                            <td className="p-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                              {new Date(log.timestamp).toLocaleString("en-IN")}
                            </td>
                            <td className="p-3 font-semibold text-foreground">{log.user}</td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono uppercase bg-primary/5"
                              >
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {log.new_value || log.old_value}
                            </td>
                          </tr>
                        ))}
                      {auditLogs.filter((log) => log.action.includes("INVOICE")).length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">
                            No Invoice CMS modifications recorded in audit history yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
