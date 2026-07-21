import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useProjects,
  useDevelopers,
  addProject,
  updateProject,
  uploadProjectFile,
  addDeveloper,
  useInventory,
  useCustomers,
  addUnit,
  updateUnit,
  useProjectConfigurations,
  addProjectConfiguration,
  deleteProjectConfiguration,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import {
  FolderGit2,
  Plus,
  Building2,
  MapPin,
  Tag,
  Pencil,
  FileText,
  ExternalLink,
  Image,
  Link2,
  X,
  Download,
  Boxes,
  LayoutGrid,
  Check,
  Search,
  AlertTriangle,
  CircleDollarSign,
  Ruler,
  Trash2,
  User,
  Calendar,
  Home,
  Sparkles,
  Upload,
  Layers,
  ShieldCheck,
  Eye,
  Grid,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects · BLX Realty CRM" }] }),
  component: ProjectsPage,
});

// ── Helpers ────────────────────────────────────────────────────
function getFileType(url: string, name?: string): "image" | "pdf" | "external" {
  if (!url) return "external";
  if (url.startsWith("data:image/")) return "image";
  if (url.startsWith("data:application/pdf")) return "pdf";
  const lower = url.toLowerCase().split("?")[0];
  if (lower.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) return "image";
  if (lower.match(/\.pdf$/)) return "pdf";
  if (name) {
    const nameLower = name.toLowerCase();
    if (nameLower.endsWith(".pdf")) return "pdf";
    if (nameLower.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) return "image";
  }
  return "external";
}

function googleDocsViewerUrl(fileUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}

// ── File Preview Modal ─────────────────────────────────────────
function FilePreviewModal({
  file,
  onClose,
}: {
  file: { name: string; url: string; size: number } | null;
  onClose: () => void;
}) {
  const [pdfLoading, setPdfLoading] = useState(true);

  if (!file) return null;

  const fileType = getFileType(file.url, file.name);
  const displayUrl = file.url.startsWith("http") ? file.url : "https://" + file.url;

  const pdfViewerSrc = file.url.startsWith("data:") ? file.url : googleDocsViewerUrl(displayUrl);

  const openUploadedFile = () => {
    fetch(file.url)
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      })
      .catch(() => {
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(
            `<html><head><title>${file.name}</title></head><body style="margin:0"><iframe src="${file.url}" width="100%" height="100%" style="border:none"></iframe></body></html>`,
          );
          newTab.document.close();
        }
      });
  };

  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setPdfLoading(true);
        }
      }}
    >
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {fileType === "image" ? (
              <Image className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : fileType === "pdf" ? (
              <FileText className="h-4 w-4 text-red-400 shrink-0" />
            ) : (
              <Link2 className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="font-semibold text-sm text-foreground truncate">{file.name}</span>
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
              ({file.size} MB)
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {file.url.startsWith("data:") ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={openUploadedFile}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open File
                </Button>
                <a href={file.url} download={file.name}>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </a>
              </>
            ) : (
              <a href={displayUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Link
                </Button>
              </a>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                onClose();
                setPdfLoading(true);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-muted/20 border-b border-border/60 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            {file.url.startsWith("data:") ? "Source:" : "URL:"}
          </span>
          <span className="text-xs text-primary font-medium truncate break-all select-all">
            {file.url.startsWith("data:") ? `Uploaded file — ${file.name}` : displayUrl}
          </span>
        </div>

        <div className="relative bg-background" style={{ minHeight: "480px" }}>
          {fileType === "image" && (
            <div className="flex items-center justify-center p-4" style={{ minHeight: "480px" }}>
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[580px] object-contain rounded-lg shadow-md border border-border/40"
              />
            </div>
          )}

          {fileType === "pdf" && (
            <div className="relative" style={{ height: "580px" }}>
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/20 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      Loading PDF viewer…
                    </p>
                  </div>
                </div>
              )}
              <iframe
                key={pdfViewerSrc}
                src={pdfViewerSrc}
                title={file.name}
                className="w-full h-full border-0"
                onLoad={() => setPdfLoading(false)}
                style={{ opacity: pdfLoading ? 0 : 1, transition: "opacity 0.3s" }}
              />
            </div>
          )}

          {fileType === "external" && (
            <div className="relative" style={{ height: "580px" }}>
              <iframe
                src={displayUrl}
                title={file.name}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────

function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useProjects();
  const { data: developers = [] } = useDevelopers();
  const { data: inventory = [] } = useInventory();
  const { role } = useAuth();

  const canEdit = can(role).reserveUnit();
  const canEditDetails = can(role).editUnit();
  const canAddUnit = can(role).createUnit();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add Form state
  const [form, setForm] = useState({
    name: "",
    developer_id: "",
    location: "",
    total_units: 100,
    available_units: 100,
    price_range: "",
    status: "New Launch",
    property_type: "Apartment",
    possession_timeline: "",
    project_size: "",
    rera_number: "",
    cover_image_url: "",
  });

  // Developer mode (select vs custom typing)
  const [devInputMode, setDevInputMode] = useState<"select" | "custom">("select");
  const [customDevName, setCustomDevName] = useState("");

  // Price configuration range state (with currency/money unit dropdown)
  const [priceNumVal, setPriceNumVal] = useState("");
  const [priceMoneyUnit, setPriceMoneyUnit] = useState("Crores (Cr)");

  // Helper to format price range string dynamically
  const updatePriceRangeString = (numVal: string, unitStr: string, isEdit = false) => {
    if (!numVal.trim()) {
      if (isEdit) setEditForm((prev) => ({ ...prev, price_range: "" }));
      else setForm((prev) => ({ ...prev, price_range: "" }));
      return;
    }

    let formatted = numVal.trim();
    if (unitStr === "Crores (Cr)") {
      formatted = formatted.startsWith("₹") ? `${formatted} Cr` : `₹${formatted} Cr`;
    } else if (unitStr === "Lakhs") {
      formatted = formatted.startsWith("₹") ? `${formatted} Lakhs` : `₹${formatted} Lakhs`;
    } else if (unitStr === "Thousands (K)") {
      formatted = formatted.startsWith("₹") ? `${formatted} K` : `₹${formatted} K`;
    } else if (unitStr === "INR (₹)") {
      formatted = formatted.startsWith("₹") ? formatted : `₹${formatted}`;
    }

    if (isEdit) {
      setEditForm((prev) => ({ ...prev, price_range: formatted }));
    } else {
      setForm((prev) => ({ ...prev, price_range: formatted }));
    }
  };

  // Edit / File catalog states
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProj, setSelectedProj] = useState<any>(null);

  const { data: customers = [] } = useCustomers();
  const { data: projectUnits = [], isLoading: isInventoryLoading } = useInventory(selectedProj?.id);
  const { data: configs = [] } = useProjectConfigurations(selectedProj?.id);

  // Unit inventory states inside Project Workspace
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editUnitOpen, setEditUnitOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [inventoryFilter, setInventoryFilter] = useState<string>("all");

  const [unitForm, setUnitForm] = useState({
    unit_number: "",
    configuration_id: "",
    area: 1500,
    price: 25000000,
    status: "available",
    reserved_by: "",
  });

  const [newUnitForm, setNewUnitForm] = useState({
    unit_number: "",
    configuration_id: "",
    area: 1500,
    price: 25000000,
  });

  // Project configurations management state
  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");
  const [configOriginSource, setConfigOriginSource] = useState<"add" | "edit" | "settings">("add");

  // Settings configurations management state
  const [settingsNewConfigName, setSettingsNewConfigName] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    developer_id: "",
    location: "",
    total_units: 100,
    available_units: 100,
    price_range: "",
    status: "New Launch",
    property_type: "Apartment",
    possession_timeline: "",
    project_size: "",
    rera_number: "",
    cover_image_url: "",
  });
  const [editDevInputMode, setEditDevInputMode] = useState<"select" | "custom">("select");
  const [editCustomDevName, setEditCustomDevName] = useState("");
  const [editPriceNumVal, setEditPriceNumVal] = useState("");
  const [editPriceMoneyUnit, setEditPriceMoneyUnit] = useState("Crores (Cr)");

  // File upload state
  const [newFileName, setNewFileName] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<
    "brochures" | "floor_plans" | "documents" | "gallery_images"
  >("brochures");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState<number>(0);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // File preview modal state
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    size: number;
  } | null>(null);

  // Upload file to Supabase Storage
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > 50) {
      toast.error("File size cannot exceed 50 MB.");
      return;
    }

    setFileSizeMb(Math.round(sizeInMb * 100) / 100);
    setNewFileName(file.name.split(".").slice(0, -1).join("."));
    setUploadedFileName(file.name);
    setNewFileUrl("");

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || "")) {
      setNewFileCategory("gallery_images");
    } else if (ext === "pdf") {
      setNewFileCategory("brochures");
    } else {
      setNewFileCategory("documents");
    }

    setIsUploadingFile(true);
    toast.loading(`Uploading "${file.name}"…`, { id: "file-upload" });

    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadProjectFile(
        base64,
        file.name,
        file.type || "application/octet-stream",
        selectedProj?.id || "general",
      );

      setNewFileUrl(result.url);
      toast.success(`"${file.name}" uploaded! Click Attach to save.`, { id: "file-upload" });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: "file-upload" });
      setUploadedFileName("");
      setNewFileUrl("");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Submit Handler for Add Project Listing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      let resolvedDevId = form.developer_id;

      // If user typed a custom developer name
      if (devInputMode === "custom" && customDevName.trim()) {
        const typedName = customDevName.trim();
        const existingDev = developers.find(
          (d) => d.name.toLowerCase() === typedName.toLowerCase(),
        );

        if (existingDev) {
          resolvedDevId = existingDev.id;
        } else {
          // Create new developer account on the fly
          const newDev = await addDeveloper({ name: typedName });
          qc.invalidateQueries({ queryKey: ["developers"] });
          resolvedDevId = newDev.id;
        }
      }

      if (!resolvedDevId) {
        toast.error("Please select or type a developer / builder name.");
        setBusy(false);
        return;
      }

      await addProject({
        ...form,
        developer_id: resolvedDevId,
        total_units: Number(form.total_units),
        available_units: Number(form.available_units),
      });

      toast.success("Project listing added successfully!");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);

      // Reset form
      setForm({
        name: "",
        developer_id: "",
        location: "",
        total_units: 100,
        available_units: 100,
        price_range: "",
        status: "New Launch",
        property_type: "Apartment",
        possession_timeline: "",
        project_size: "",
        rera_number: "",
        cover_image_url: "",
      });
      setDevInputMode("select");
      setCustomDevName("");
      setPriceNumVal("");
      setPriceMoneyUnit("Crores (Cr)");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  // ── Inventory & Configurations Handlers ───────────────────────
  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitForm.unit_number || !newUnitForm.unit_number.trim()) {
      toast.error("Please enter a unit number.");
      return;
    }
    if (!newUnitForm.configuration_id) {
      toast.error("Please select a unit configuration.");
      return;
    }

    const trimmedNum = newUnitForm.unit_number.trim();
    // Validate uniqueness on frontend
    const isDuplicate = projectUnits.some(
      (u: any) =>
        (u.unit_number || "").toString().trim().toLowerCase() === trimmedNum.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(`Unit number '${trimmedNum}' already exists in this project.`);
      return;
    }

    setBusy(true);
    try {
      const selectedConfigObj = configs.find((c) => c.id === newUnitForm.configuration_id);
      await addUnit({
        project_id: selectedProj.id,
        unit_number: trimmedNum,
        configuration: selectedConfigObj ? selectedConfigObj.name : "",
        configuration_id: newUnitForm.configuration_id,
        area: Number(newUnitForm.area),
        price: Number(newUnitForm.price),
        status: "available",
      });
      toast.success("Unit added successfully!");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setAddUnitOpen(false);
      setNewUnitForm({
        unit_number: "",
        configuration_id: configs[0]?.id || "",
        area: 1500,
        price: 25000000,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add unit");
    } finally {
      setBusy(false);
    }
  };

  const handleUnitCardClick = (u: any) => {
    setSelectedUnit(u);
    setUnitForm({
      unit_number: u.unit_number,
      configuration_id: u.configuration_id || "",
      area: u.area || 1500,
      price: u.price || 20000000,
      status: u.status || "available",
      reserved_by: u.reserved_by || "",
    });
    setEditUnitOpen(true);
  };

  const handleUpdateUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    if (!unitForm.unit_number || !unitForm.unit_number.trim()) {
      toast.error("Please enter a unit number.");
      return;
    }

    const trimmedNum = unitForm.unit_number.trim();
    // Validate uniqueness on frontend (excluding current unit)
    const isDuplicate = projectUnits.some(
      (u: any) =>
        u.id !== selectedUnit.id &&
        (u.unit_number || "").toString().trim().toLowerCase() === trimmedNum.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(`Unit number '${trimmedNum}' already exists in this project.`);
      return;
    }

    setBusy(true);
    try {
      const selectedConfigObj = configs.find((c) => c.id === unitForm.configuration_id);
      await updateUnit(selectedUnit.id, {
        unit_number: trimmedNum,
        configuration: selectedConfigObj ? selectedConfigObj.name : "",
        configuration_id: unitForm.configuration_id || null,
        area: Number(unitForm.area),
        price: Number(unitForm.price),
        status: unitForm.status,
        reserved_by: unitForm.status !== "available" ? unitForm.reserved_by || null : null,
      });
      toast.success("Unit updated successfully!");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditUnitOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update unit");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfigName.trim()) return;
    setBusy(true);
    try {
      const res = await addProjectConfiguration(selectedProj.id, newConfigName.trim());
      toast.success(`Configuration "${newConfigName.trim()}" added!`);
      qc.invalidateQueries({ queryKey: ["project-configurations", selectedProj.id] });

      const newId = res.id;
      if (configOriginSource === "add") {
        setNewUnitForm((prev) => ({ ...prev, configuration_id: newId }));
      } else if (configOriginSource === "edit") {
        setUnitForm((prev) => ({ ...prev, configuration_id: newId }));
      }

      setNewConfigName("");
      setNewConfigOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add configuration");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateConfigFromSettings = async () => {
    if (!settingsNewConfigName.trim()) return;
    setBusy(true);
    try {
      await addProjectConfiguration(selectedProj.id, settingsNewConfigName.trim());
      toast.success(`Configuration "${settingsNewConfigName.trim()}" added!`);
      qc.invalidateQueries({ queryKey: ["project-configurations", selectedProj.id] });
      setSettingsNewConfigName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add configuration");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfig = async (id: string, isUsed: boolean) => {
    if (isUsed) {
      if (
        !window.confirm(
          "WARNING: This configuration is currently in use by some units. Deleting it will unlink these units. Are you sure you want to proceed?",
        )
      ) {
        return;
      }
    } else {
      if (!window.confirm("Are you sure you want to delete this configuration?")) {
        return;
      }
    }
    setBusy(true);
    try {
      await deleteProjectConfiguration(id, true);
      toast.success("Configuration deleted successfully!");
      qc.invalidateQueries({ queryKey: ["project-configurations", selectedProj.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete configuration");
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10";
      case "pending_reserve":
        return "bg-amber-400 hover:bg-amber-500 text-white shadow-amber-400/10 animate-pulse";
      case "reserved":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10";
      case "sold":
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleEditOpen = (proj: any) => {
    setSelectedProj(proj);
    setEditForm({
      name: proj.name,
      developer_id: proj.developer_id || "",
      location: proj.location || "",
      total_units: proj.total_units || 100,
      available_units: proj.available_units || 100,
      price_range: proj.price_range || "",
      status: proj.status || "New Launch",
      property_type: proj.property_type || "Apartment",
      possession_timeline: proj.possession_timeline || "",
      project_size: proj.project_size || "",
      rera_number: proj.rera_number || "",
      cover_image_url: proj.cover_image_url || "",
    });
    setEditDevInputMode("select");
    setEditCustomDevName("");
    setEditPriceNumVal(proj.price_range || "");
    setEditPriceMoneyUnit("Crores (Cr)");
    setEditOpen(true);
  };

  // Photo management handlers
  const handleUploadProjectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProj) return;

    const existingGallery = selectedProj.gallery_images || [];
    if (existingGallery.length >= 5) {
      toast.error("You can upload a maximum of 5 project photos.");
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > 10) {
      toast.error("Photo size cannot exceed 10 MB.");
      return;
    }

    setBusy(true);
    toast.loading("Uploading photo...", { id: "photo-upload" });

    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadProjectFile(
        base64,
        file.name,
        file.type || "image/jpeg",
        selectedProj.id,
      );

      const newPhoto = {
        name: file.name,
        url: result.url,
        size: Math.round(sizeInMb * 100) / 100,
      };

      const updatedGallery = [...existingGallery, newPhoto];

      // Default cover if none exists
      let updatedCoverUrl = selectedProj.cover_image_url || editForm.cover_image_url;
      if (!updatedCoverUrl) {
        updatedCoverUrl = result.url;
      }

      await updateProject(selectedProj.id, {
        gallery_images: updatedGallery,
        cover_image_url: updatedCoverUrl,
      });

      toast.success("Photo uploaded successfully!", { id: "photo-upload" });
      qc.invalidateQueries({ queryKey: ["projects"] });

      setEditForm((prev) => ({
        ...prev,
        cover_image_url: updatedCoverUrl,
      }));
      setSelectedProj({
        ...selectedProj,
        gallery_images: updatedGallery,
        cover_image_url: updatedCoverUrl,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo", { id: "photo-upload" });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProjectPhoto = async (photoUrl: string) => {
    if (!selectedProj || !window.confirm("Are you sure you want to delete this project photo?"))
      return;

    setBusy(true);
    try {
      const existingGallery = selectedProj.gallery_images || [];
      const updatedGallery = existingGallery.filter((img: any) => img.url !== photoUrl);

      let updatedCoverUrl = selectedProj.cover_image_url || editForm.cover_image_url;
      if (updatedCoverUrl === photoUrl) {
        updatedCoverUrl = updatedGallery[0]?.url || "";
      }

      await updateProject(selectedProj.id, {
        gallery_images: updatedGallery,
        cover_image_url: updatedCoverUrl,
      });

      toast.success("Photo deleted.");
      qc.invalidateQueries({ queryKey: ["projects"] });

      setEditForm((prev) => ({
        ...prev,
        cover_image_url: updatedCoverUrl,
      }));
      setSelectedProj({
        ...selectedProj,
        gallery_images: updatedGallery,
        cover_image_url: updatedCoverUrl,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete photo");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCoverPhoto = async (photoUrl: string) => {
    if (!selectedProj) return;
    setBusy(true);
    try {
      await updateProject(selectedProj.id, {
        cover_image_url: photoUrl,
      });

      toast.success("Cover photo updated!");
      qc.invalidateQueries({ queryKey: ["projects"] });

      setEditForm((prev) => ({
        ...prev,
        cover_image_url: photoUrl,
      }));
      setSelectedProj({
        ...selectedProj,
        cover_image_url: photoUrl,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to update cover photo");
    } finally {
      setBusy(false);
    }
  };

  // Submit Handler for Update Project Listing Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj) return;
    setBusy(true);

    try {
      let resolvedDevId = editForm.developer_id;

      if (editDevInputMode === "custom" && editCustomDevName.trim()) {
        const typedName = editCustomDevName.trim();
        const existingDev = developers.find(
          (d) => d.name.toLowerCase() === typedName.toLowerCase(),
        );

        if (existingDev) {
          resolvedDevId = existingDev.id;
        } else {
          const newDev = await addDeveloper({ name: typedName });
          qc.invalidateQueries({ queryKey: ["developers"] });
          resolvedDevId = newDev.id;
        }
      }

      await updateProject(selectedProj.id, {
        ...editForm,
        developer_id: resolvedDevId || null,
        total_units: Number(editForm.total_units),
        available_units: Number(editForm.available_units),
      });

      toast.success("Project listing updated!");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update project listing");
    } finally {
      setBusy(false);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !newFileName.trim() || !newFileUrl.trim()) {
      toast.error("Please fill in file name and URL.");
      return;
    }

    setBusy(true);
    try {
      let formattedUrl = newFileUrl.trim();
      if (!formattedUrl.startsWith("data:") && !/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = "https://" + formattedUrl;
      }

      const existingArray: any[] = selectedProj[newFileCategory] || [];
      const updatedArray = [
        ...existingArray,
        {
          name: newFileName.trim(),
          url: formattedUrl,
          size: fileSizeMb || 1.5,
        },
      ];

      await updateProject(selectedProj.id, {
        [newFileCategory]: updatedArray,
      });

      toast.success(`Attached to ${newFileCategory.replace("_", " ")}!`);
      qc.invalidateQueries({ queryKey: ["projects"] });

      setSelectedProj({
        ...selectedProj,
        [newFileCategory]: updatedArray,
      });

      setNewFileName("");
      setNewFileUrl("");
      setUploadedFileName("");
      setFileSizeMb(0);
    } catch (err: any) {
      toast.error(err.message || "Failed to attach file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Projects Portfolio"
      subtitle="Catalog of active property listings, locations and pricing configurations."
    >
      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-base font-bold font-display text-foreground">PROPERTY LISTINGS</h2>
        </div>
        {can(role).createProject() && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 font-bold">
                <Plus className="h-4 w-4" /> Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-card border border-border shadow-2xl rounded-2xl p-6">
              <DialogHeader>
                <DialogTitle className="font-display font-bold text-lg">
                  Add Project Listing
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                {/* Listing Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Project Listing Name *</Label>
                  <Input
                    id="pname"
                    required
                    placeholder="e.g. ORION MALL or Aurelia Farms"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>

                {/* Developer / Builder (With Select OR Type Custom Option) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pdev">Developer / Builder *</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setDevInputMode(devInputMode === "select" ? "custom" : "select");
                      }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      {devInputMode === "select"
                        ? "✏️ Type New Builder Name"
                        : "🔗 Select Existing Builder"}
                    </button>
                  </div>

                  {devInputMode === "select" ? (
                    <Select
                      value={form.developer_id}
                      onValueChange={(v) => {
                        if (v === "__type_new__") {
                          setDevInputMode("custom");
                          setCustomDevName("");
                        } else {
                          setForm({ ...form, developer_id: v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Select builder or type new" />
                      </SelectTrigger>
                      <SelectContent>
                        {developers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                        <SelectItem
                          value="__type_new__"
                          className="text-primary font-bold border-t"
                        >
                          + Type New Developer Name…
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        id="pdev"
                        required
                        placeholder="e.g. SANKALP or Sobha Developers"
                        value={customDevName}
                        onChange={(e) => setCustomDevName(e.target.value)}
                        className="h-10 rounded-xl pr-24 font-medium"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        New Developer
                      </span>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <Label htmlFor="ploc">Project Location</Label>
                  <Input
                    id="ploc"
                    placeholder="e.g. BANGALORE or Koramangala"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>

                {/* Total & Available Units */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ptot">Total Units</Label>
                    <Input
                      id="ptot"
                      type="number"
                      value={form.total_units}
                      onChange={(e) => setForm({ ...form, total_units: Number(e.target.value) })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pavail">Available Units</Label>
                    <Input
                      id="pavail"
                      type="number"
                      value={form.available_units}
                      onChange={(e) =>
                        setForm({ ...form, available_units: Number(e.target.value) })
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                {/* Price Configuration Range with Money / Unit Dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="pprice">Price Configuration Range</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pprice"
                      placeholder="e.g. 2.1 - 4.5"
                      value={priceNumVal}
                      onChange={(e) => {
                        setPriceNumVal(e.target.value);
                        updatePriceRangeString(e.target.value, priceMoneyUnit, false);
                      }}
                      className="flex-1 h-10 rounded-xl font-medium"
                    />
                    <Select
                      value={priceMoneyUnit}
                      onValueChange={(u) => {
                        setPriceMoneyUnit(u);
                        updatePriceRangeString(priceNumVal, u, false);
                      }}
                    >
                      <SelectTrigger className="w-[150px] shrink-0 h-10 rounded-xl font-semibold">
                        <SelectValue placeholder="Currency Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Crores (Cr)">Crores (Cr)</SelectItem>
                        <SelectItem value="Lakhs">Lakhs</SelectItem>
                        <SelectItem value="Thousands (K)">Thousands (K)</SelectItem>
                        <SelectItem value="INR (₹)">INR (₹)</SelectItem>
                        <SelectItem value="Custom">Custom / Raw</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.price_range && (
                    <div className="text-[11px] font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
                      <span>Formatted Preview:</span>
                      <span className="text-primary font-bold px-2 py-0.5 rounded-md bg-primary/10">
                        {form.price_range}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional parameters */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pstatus">Project Status *</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-left">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Upcoming">Upcoming</SelectItem>
                        <SelectItem value="New Launch">New Launch</SelectItem>
                        <SelectItem value="Under Construction">Under Construction</SelectItem>
                        <SelectItem value="Ready to Move">Ready to Move</SelectItem>
                        <SelectItem value="Sold Out">Sold Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ptype">Property Type *</Label>
                    <Select
                      value={form.property_type}
                      onValueChange={(v) => setForm({ ...form, property_type: v })}
                    >
                      <SelectTrigger className="h-10 rounded-xl text-left">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="Villa">Villa</SelectItem>
                        <SelectItem value="Plot">Plot</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Mixed Development">Mixed Development</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ppossession">Possession Timeline</Label>
                    <Input
                      id="ppossession"
                      placeholder="e.g. Dec 2027 or Ready"
                      value={form.possession_timeline}
                      onChange={(e) => setForm({ ...form, possession_timeline: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="psize">Project Size / Scale</Label>
                    <Input
                      id="psize"
                      placeholder="e.g. 8 Acres or 6 Towers"
                      value={form.project_size}
                      onChange={(e) => setForm({ ...form, project_size: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prera">RERA Number</Label>
                  <Input
                    id="prera"
                    placeholder="e.g. PRM/KA/RERA/..."
                    value={form.rera_number}
                    onChange={(e) => setForm({ ...form, rera_number: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>

                <DialogFooter className="pt-3">
                  <Button type="submit" disabled={busy} className="rounded-xl font-bold h-10 px-6">
                    {busy ? "Saving..." : "Save Listing"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Projects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full text-center py-12">
            No project listings registered in portfolio yet.
          </p>
        ) : (
          projects.map((p) => {
            const projectUnits = inventory.filter((u) => u.project_id === p.id);
            const activeAvailableUnits = projectUnits.filter(
              (u) => u.status === "available",
            ).length;
            const nonAvailableUnits = projectUnits.filter((u) => u.status !== "available").length;

            const displayAvailableUnits = Math.max(
              activeAvailableUnits,
              Math.max(0, (p.available_units ?? 0) - nonAvailableUnits),
            );
            const displayTotalUnits = Math.max(projectUnits.length, p.total_units ?? 0);

            const totalFiles =
              (p.brochures?.length || 0) +
              (p.floor_plans?.length || 0) +
              (p.documents?.length || 0) +
              (p.gallery_images?.length || 0);

            return (
              <Card
                key={p.id}
                className="relative w-full h-[225px] overflow-hidden rounded-2xl border border-border/50 group cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                onClick={() => handleEditOpen(p)}
              >
                {/* Background Cover Photo / Placeholder */}
                <div className="absolute inset-0 w-full h-full bg-muted">
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted/50 via-muted/30 to-muted/80 flex flex-col items-center justify-center">
                      <Building2 className="h-9 w-9 text-muted-foreground/30 mb-2 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        No cover image uploaded
                      </span>
                    </div>
                  )}
                </div>

                {/* Theme-responsive gradient overlay for readability of text */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-black/95 dark:via-black/75 dark:to-transparent" />

                {/* Top Overlay: Status & Type Badges */}
                <div className="absolute top-2.5 left-2.5 flex gap-1 z-10">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xs">
                    {p.status || "New Launch"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-primary/40 backdrop-blur-md border border-primary/20 text-white shadow-xs">
                    {p.property_type || "Apartment"}
                  </span>
                </div>

                {/* Top Overlay: Pencil (Edit) icon button */}
                {role !== "marketing" && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-background/80 backdrop-blur-md border border-border/40 hover:bg-background shadow-xs text-foreground transition-all duration-300 z-10 hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditOpen(p);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}

                {/* Bottom Overlay Info Layer */}
                <div className="absolute bottom-0 inset-x-0 p-3.5 flex flex-col justify-end space-y-2 text-left">
                  {/* Name and Builder */}
                  <div>
                    <h4 className="text-sm font-extrabold font-display text-zinc-900 dark:text-white tracking-wide truncate">
                      {p.name}
                    </h4>
                    <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                      <Building2 className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                      <span>{p.developers?.name || "Partner Builder"}</span>
                    </p>
                  </div>

                  {/* Location & Price Range */}
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-zinc-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5 min-w-0 text-zinc-600 dark:text-zinc-300">
                      <MapPin className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      <span className="truncate font-medium">{p.location || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-zinc-900 dark:text-white font-bold font-display">
                      <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{p.price_range || "—"}</span>
                    </div>
                  </div>

                  {/* Available vs Total Units */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                        Available Units
                      </span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">
                        {displayAvailableUnits}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                        Total Units
                      </span>
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                        {displayTotalUnits}
                      </span>
                    </div>
                  </div>

                  {/* Files Catalog Count */}
                  <div className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/10 backdrop-blur-md px-2 py-1 rounded flex justify-between items-center border border-zinc-200/50 dark:border-white/5">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-zinc-500 dark:text-zinc-400" /> Files
                      Catalog:
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {totalFiles} files
                    </span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Project Details Workspace Modal ─────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl bg-card rounded-2xl border border-border shadow-2xl p-6 h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-primary" /> {selectedProj?.name} Portfolio
              Workspace
            </DialogTitle>
          </DialogHeader>

          <Tabs
            defaultValue={role === "marketing" ? "documents" : "profile"}
            className="w-full mt-4 flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="flex w-full bg-muted p-1 rounded-xl shrink-0 gap-1 overflow-x-auto">
              {role !== "marketing" && (
                <TabsTrigger value="profile" className="flex-1 rounded-lg text-[10px] font-bold">
                  Overview
                </TabsTrigger>
              )}
              {role !== "marketing" && (
                <TabsTrigger value="inventory" className="flex-1 rounded-lg text-[10px] font-bold">
                  Inventory
                </TabsTrigger>
              )}
              <TabsTrigger value="documents" className="flex-1 rounded-lg text-[10px] font-bold">
                Documents
              </TabsTrigger>
              {role !== "marketing" && (
                <TabsTrigger value="analytics" className="flex-1 rounded-lg text-[10px] font-bold">
                  Analytics
                </TabsTrigger>
              )}
              {can(role).editProject() && role !== "marketing" && (
                <TabsTrigger value="settings" className="flex-1 rounded-lg text-[10px] font-bold">
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── Listing Details Tab ── */}
            <TabsContent value="profile" className="flex-1 overflow-y-auto py-4 pr-1 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Form & Photo Manager */}
                <form onSubmit={handleUpdateProfile} className="lg:col-span-7 space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="epname">Project Listing Name *</Label>
                    <Input
                      id="epname"
                      required
                      disabled={!can(role).editProject()}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  {/* Developer Field */}
                  {role !== "sales_executive" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Developer / Builder *</Label>
                        {can(role).editProject() && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditDevInputMode(
                                editDevInputMode === "select" ? "custom" : "select",
                              );
                            }}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            {editDevInputMode === "select"
                              ? "✏️ Type New Builder Name"
                              : "🔗 Select Existing Builder"}
                          </button>
                        )}
                      </div>

                      {editDevInputMode === "select" ? (
                        <Select
                          value={editForm.developer_id}
                          disabled={!can(role).editProject()}
                          onValueChange={(v) => {
                            if (v === "__type_new__") {
                              setEditDevInputMode("custom");
                              setEditCustomDevName("");
                            } else {
                              setEditForm({ ...editForm, developer_id: v });
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue placeholder="Associate Builder" />
                          </SelectTrigger>
                          <SelectContent>
                            {developers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value="__type_new__"
                              className="text-primary font-bold border-t"
                            >
                              + Type New Developer Name…
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input
                            required
                            disabled={!can(role).editProject()}
                            placeholder="e.g. SANKALP or Sobha"
                            value={editCustomDevName}
                            onChange={(e) => setEditCustomDevName(e.target.value)}
                            className="h-10 rounded-xl pr-24 font-medium"
                          />
                          <span className="absolute right-2.5 top-2.5 text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            New Developer
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location */}
                  <div className="space-y-1.5">
                    <Label htmlFor="eploc">Project Location</Label>
                    <Input
                      id="eploc"
                      disabled={!can(role).editProject()}
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  {/* Total & Available Units */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="eptot">Total Units</Label>
                      <Input
                        id="eptot"
                        type="number"
                        disabled={!can(role).editProject()}
                        value={editForm.total_units}
                        onChange={(e) =>
                          setEditForm({ ...editForm, total_units: Number(e.target.value) })
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="epavail">Available Units</Label>
                      <Input
                        id="epavail"
                        type="number"
                        disabled={!can(role).editProject()}
                        value={editForm.available_units}
                        onChange={(e) =>
                          setEditForm({ ...editForm, available_units: Number(e.target.value) })
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Price Configuration */}
                  <div className="space-y-1.5">
                    <Label htmlFor="epprice">Price Configuration Range</Label>
                    <div className="flex gap-2">
                      <Input
                        id="epprice"
                        disabled={!can(role).editProject()}
                        placeholder="e.g. 2.1 - 4.5"
                        value={editPriceNumVal}
                        onChange={(e) => {
                          setEditPriceNumVal(e.target.value);
                          updatePriceRangeString(e.target.value, editPriceMoneyUnit, true);
                        }}
                        className="flex-1 h-10 rounded-xl font-medium"
                      />
                      <Select
                        value={editPriceMoneyUnit}
                        disabled={!can(role).editProject()}
                        onValueChange={(u) => {
                          setEditPriceMoneyUnit(u);
                          updatePriceRangeString(editPriceNumVal, u, true);
                        }}
                      >
                        <SelectTrigger className="w-[150px] shrink-0 h-10 rounded-xl font-semibold">
                          <SelectValue placeholder="Currency Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Crores (Cr)">Crores (Cr)</SelectItem>
                          <SelectItem value="Lakhs">Lakhs</SelectItem>
                          <SelectItem value="Thousands (K)">Thousands (K)</SelectItem>
                          <SelectItem value="INR (₹)">INR (₹)</SelectItem>
                          <SelectItem value="Custom">Custom / Raw</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editForm.price_range && (
                      <div className="text-[11px] font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span>Formatted Preview:</span>
                        <span className="text-primary font-bold px-2 py-0.5 rounded-md bg-primary/10">
                          {editForm.price_range}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status & Property Type dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="estatus">Project Status *</Label>
                      <Select
                        value={editForm.status}
                        disabled={!can(role).editProject()}
                        onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                      >
                        <SelectTrigger className="h-10 rounded-xl text-left">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Upcoming">Upcoming</SelectItem>
                          <SelectItem value="New Launch">New Launch</SelectItem>
                          <SelectItem value="Under Construction">Under Construction</SelectItem>
                          <SelectItem value="Ready to Move">Ready to Move</SelectItem>
                          <SelectItem value="Sold Out">Sold Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="etype">Property Type *</Label>
                      <Select
                        value={editForm.property_type}
                        disabled={!can(role).editProject()}
                        onValueChange={(v) => setEditForm({ ...editForm, property_type: v })}
                      >
                        <SelectTrigger className="h-10 rounded-xl text-left">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Apartment">Apartment</SelectItem>
                          <SelectItem value="Villa">Villa</SelectItem>
                          <SelectItem value="Plot">Plot</SelectItem>
                          <SelectItem value="Commercial">Commercial</SelectItem>
                          <SelectItem value="Mixed Development">Mixed Development</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Possession & Size */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="eposs">Possession Timeline</Label>
                      <Input
                        id="eposs"
                        disabled={!can(role).editProject()}
                        placeholder="e.g. Dec 2027 or Ready"
                        value={editForm.possession_timeline}
                        onChange={(e) =>
                          setEditForm({ ...editForm, possession_timeline: e.target.value })
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="esize">Project Size</Label>
                      <Input
                        id="esize"
                        disabled={!can(role).editProject()}
                        placeholder="e.g. 8 Acres or 6 Towers"
                        value={editForm.project_size}
                        onChange={(e) => setEditForm({ ...editForm, project_size: e.target.value })}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* RERA Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="erera">RERA Number</Label>
                    <Input
                      id="erera"
                      disabled={!can(role).editProject()}
                      placeholder="e.g. PRM/KA/RERA/..."
                      value={editForm.rera_number}
                      onChange={(e) => setEditForm({ ...editForm, rera_number: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  {/* Project Photos Upload & Management Section */}
                  <div className="p-4 border rounded-2xl bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Project Photos (Max 5 images)
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {(selectedProj?.gallery_images || []).length} / 5 uploaded
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5 items-center">
                      {(selectedProj?.gallery_images || []).map((img: any, idx: number) => {
                        const isCover = editForm.cover_image_url === img.url;
                        return (
                          <div
                            key={idx}
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group/img bg-muted shadow-xs"
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />

                            {/* Cover Star indicator / Click to set cover */}
                            <button
                              type="button"
                              onClick={() => handleSetCoverPhoto(img.url)}
                              title={isCover ? "Current Cover Photo" : "Set as Cover Image"}
                              className={`absolute top-1 left-1 rounded-md px-1 py-0.5 text-[8px] font-black ${
                                isCover
                                  ? "bg-primary text-primary-foreground shadow-xs scale-105"
                                  : "bg-black/70 text-white/90 opacity-0 group-hover/img:opacity-100 hover:scale-105"
                              } transition-all`}
                            >
                              {isCover ? "★ Cover" : "☆ Cover"}
                            </button>

                            {/* Delete photo button */}
                            {can(role).editProject() && (
                              <button
                                type="button"
                                onClick={() => handleDeleteProjectPhoto(img.url)}
                                title="Delete Photo"
                                className="absolute bottom-1 right-1 p-1 bg-rose-600/90 text-white rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-rose-600 shadow-xs"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* File upload zone button */}
                      {can(role).editProject() &&
                        (selectedProj?.gallery_images || []).length < 5 && (
                          <div className="relative">
                            <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-dashed border-border/70 hover:border-primary cursor-pointer hover:bg-muted/40 transition-colors">
                              <Upload className="h-4.5 w-4.5 text-muted-foreground" />
                              <span className="text-[8px] text-muted-foreground font-semibold mt-1">
                                Upload
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUploadProjectPhoto}
                                disabled={busy}
                              />
                            </label>
                          </div>
                        )}
                    </div>

                    <div className="text-[10px] text-muted-foreground leading-tight">
                      ℹ️ Image Guidelines: Supported formats are JPG, PNG, and WebP. Recommend
                      sizing around 1200x800px.
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {can(role).editProject() && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl font-bold h-10 px-6"
                      >
                        {busy ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </form>

                {/* Right Column: Live Premium Card Preview */}
                <div className="lg:col-span-5 sticky top-0 space-y-3">
                  <div className="flex items-center gap-1.5 border-b pb-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Photo Preview
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-medium italic">
                      (Real-time card preview)
                    </span>
                  </div>

                  <div className="relative w-full h-[200px] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg max-w-sm mx-auto">
                    {/* Background Cover Photo / Placeholder */}
                    <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
                      {editForm.cover_image_url ? (
                        <img
                          src={editForm.cover_image_url}
                          alt="Cover Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted/50 via-muted/30 to-muted/80 flex flex-col items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            No cover image uploaded
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Theme-responsive gradient overlay - properly styled */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-black/95 dark:via-black/75 dark:to-transparent" />

                    {/* Status & Type badges preview */}
                    <div className="absolute top-2.5 left-2.5 flex gap-1 z-10">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xs">
                        {editForm.status || "New Launch"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-primary/40 backdrop-blur-md border border-primary/20 text-white shadow-xs">
                        {editForm.property_type || "Apartment"}
                      </span>
                    </div>

                    {/* Bottom Overlay Info Layer */}
                    <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col justify-end space-y-1.5 text-left">
                      {/* Name and Builder */}
                      <div>
                        <h4 className="text-xs font-extrabold font-display text-zinc-900 dark:text-white tracking-wide truncate">
                          {editForm.name || "Project Name"}
                        </h4>
                        <p className="text-[9px] font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                          <span>
                            {developers.find((d) => d.id === editForm.developer_id)?.name ||
                              editCustomDevName ||
                              "Partner Builder"}
                          </span>
                        </p>
                      </div>

                      {/* Location & Price Range */}
                      <div className="flex items-center justify-between text-[10px] pb-1 border-b border-zinc-200 dark:border-white/10">
                        <div className="flex items-center gap-1 min-w-0 text-zinc-600 dark:text-zinc-300">
                          <MapPin className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                          <span className="truncate font-medium">
                            {editForm.location || "Location"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-zinc-900 dark:text-white font-bold font-display">
                          <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{editForm.price_range || "Price Range"}</span>
                        </div>
                      </div>

                      {/* Key Stats Units */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                            Available Units
                          </span>
                          <span className="text-xs font-black text-zinc-900 dark:text-white mt-0.5">
                            {editForm.available_units || 0}
                          </span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                            Total Units
                          </span>
                          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                            {editForm.total_units || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Files & Visual Floor Plans Tab ── */}
            <TabsContent
              value="documents"
              className="flex-1 overflow-y-auto py-4 pr-1 text-left space-y-5"
            >
              {(can(role).editProject() || can(role).uploadProjectDocuments()) && (
                <form
                  onSubmit={handleAddFile}
                  className="p-4 border rounded-2xl bg-muted/20 space-y-3"
                >
                  <div className="font-bold text-xs text-foreground flex items-center justify-between">
                    <span>Attach Asset File</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      Max file size: 50 MB
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Asset Display Name *</Label>
                      <Input
                        placeholder="e.g. Master Plan Brochure"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Category Target</Label>
                      <Select
                        value={newFileCategory}
                        onValueChange={(v: any) => setNewFileCategory(v)}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brochures">Brochures & Collateral</SelectItem>
                          <SelectItem value="floor_plans">Floor Plans</SelectItem>
                          <SelectItem value="documents">Official Documents</SelectItem>
                          <SelectItem value="gallery_images">Gallery Images</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Choose Local File</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="file"
                        onChange={handleLocalFileUpload}
                        disabled={isUploadingFile}
                        className="text-xs h-9 rounded-xl flex-1 cursor-pointer bg-card"
                      />
                    </div>

                    {uploadedFileName && (
                      <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1.5 mt-1">
                        <span>✓ Uploaded: {uploadedFileName}</span>
                        <span className="text-[10px] text-muted-foreground">({fileSizeMb} MB)</span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || isUploadingFile || !newFileUrl}
                    size="sm"
                    className="w-full text-xs font-bold h-9 rounded-xl mt-1"
                  >
                    {isUploadingFile
                      ? "Uploading to Storage…"
                      : busy
                        ? "Saving…"
                        : "Attach Asset File to Listing"}
                  </Button>
                </form>
              )}

              {/* Display existing files */}
              {["brochures", "floor_plans", "documents", "gallery_images"].map((cat) => {
                const list: any[] = selectedProj?.[cat] || [];
                const catLabels: Record<string, string> = {
                  brochures: "Brochures & Master Collateral",
                  floor_plans: "Visual Floor Plans",
                  documents: "Legal & RERA Documents",
                  gallery_images: "High-Res Gallery Images",
                };

                return (
                  <div key={cat} className="space-y-2">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>{catLabels[cat]}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {list.length} file{list.length !== 1 ? "s" : ""}
                      </span>
                    </h5>

                    {list.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 italic pl-1">
                        No files in this category.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {list.map((f: any, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewFile(f)}
                            className="p-3 border rounded-xl bg-card flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                              <div className="truncate">
                                <p className="text-xs font-bold text-foreground truncate">
                                  {f.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {f.size || 1.2} MB · Click to preview
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>

            {/* ── Inventory Tab ── */}
            <TabsContent
              value="inventory"
              className="flex-1 overflow-y-auto py-4 pr-1 text-left flex flex-col gap-4"
            >
              <div className="flex flex-row items-center justify-between flex-wrap gap-4 pb-2 border-b">
                <div className="flex items-center gap-2 font-semibold text-xs bg-muted/40 border px-3 py-1.5 rounded-lg shadow-sm">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded bg-emerald-500" /> Available (
                    {projectUnits.filter((u) => u.status === "available").length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded bg-amber-400" /> Pending (
                    {projectUnits.filter((u) => u.status === "pending_reserve").length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded bg-amber-600" /> Reserved (
                    {projectUnits.filter((u) => u.status === "reserved").length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded bg-rose-500" /> Sold (
                    {projectUnits.filter((u) => u.status === "sold").length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={inventoryFilter} onValueChange={setInventoryFilter}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="All Units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="pending_reserve">Pending</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>

                  {canAddUnit && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setNewUnitForm({
                          unit_number: "",
                          configuration_id: configs[0]?.id || "",
                          area: 1500,
                          price: 25000000,
                        });
                        setAddUnitOpen(true);
                      }}
                      className="gap-1 h-8 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Unit
                    </Button>
                  )}
                </div>
              </div>

              {isInventoryLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading units...
                </div>
              ) : projectUnits.length === 0 ? (
                <div className="p-12 text-center border border-dashed rounded-xl space-y-2">
                  <Boxes className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <h4 className="font-bold text-xs">No Units Map Created</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Get started by mapping individual inventory units to this project listing.
                  </p>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border/60 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-primary" /> Visual Plot Layout
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Grouped layout, ordered by site / unit number — tap any plot tile to inspect & manage
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-card shrink-0">
                      {projectUnits.filter((u) => inventoryFilter === "all" || u.status === inventoryFilter).length} Plots Shown
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {projectUnits
                      .filter((u) => inventoryFilter === "all" || u.status === inventoryFilter)
                      .map((u) => {
                        let bgClass = "bg-[#00a8e8] text-white hover:bg-[#0092cc] border-[#0092cc]/40";
                        if (u.status === "pending_reserve") {
                          bgClass = "bg-[#ff9f1c] text-white hover:bg-[#e88d10] border-[#e88d10]/40";
                        } else if (u.status === "reserved") {
                          bgClass = "bg-[#f77f00] text-white hover:bg-[#d66e00] border-[#d66e00]/40";
                        } else if (u.status === "sold") {
                          bgClass = "bg-[#e63946] text-white hover:bg-[#d62839] border-[#d62839]/40";
                        }

                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleUnitCardClick(u)}
                            title={`Plot/Unit #${u.unit_number} • ${u.configuration} • ₹${(u.price / 10000000).toFixed(2)} Cr (${u.status.toUpperCase()})`}
                            className={`min-w-[48px] h-10 px-2 rounded-lg font-mono font-extrabold text-xs flex flex-col items-center justify-center transition-all duration-150 hover:scale-105 shadow-xs border ${bgClass}`}
                          >
                            <span>{u.unit_number}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Analytics Tab ── */}
            <TabsContent value="analytics" className="flex-1 overflow-y-auto py-4 pr-1 text-left">
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Project Inventory Analytics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 border rounded-xl bg-emerald-500/5 border-emerald-500/10">
                    <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                      Available
                    </div>
                    <div className="text-xl font-black text-emerald-600 mt-1">
                      {projectUnits.filter((u: any) => u.status === "available").length}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-amber-500/5 border-amber-500/10">
                    <div className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">
                      Reserved / Pending
                    </div>
                    <div className="text-xl font-black text-amber-600 mt-1">
                      {
                        projectUnits.filter(
                          (u: any) => u.status === "reserved" || u.status === "pending_reserve",
                        ).length
                      }
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-rose-500/5 border-rose-500/10">
                    <div className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">
                      Sold
                    </div>
                    <div className="text-xl font-black text-rose-600 mt-1">
                      {projectUnits.filter((u: any) => u.status === "sold").length}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-primary/5 border-primary/10">
                    <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
                      Total Units Mapped
                    </div>
                    <div className="text-xl font-black text-primary mt-1">
                      {projectUnits.length}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Settings Tab ── */}
            <TabsContent
              value="settings"
              className="flex-1 overflow-y-auto py-4 pr-1 text-left space-y-5"
            >
              {can(role).editProject() && (
                <div className="p-6 border rounded-xl bg-card space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      Manage Project Configurations
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Add custom configurations or delete unused ones. (Alphabetically sorted)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 5 BHK, Penthouse, Retail Shop"
                      value={settingsNewConfigName}
                      onChange={(e) => setSettingsNewConfigName(e.target.value)}
                      className="h-9 rounded-lg max-w-xs text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateConfigFromSettings}
                      disabled={busy}
                      className="h-9 font-bold rounded-lg text-xs"
                    >
                      Add Configuration
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {configs.map((cfg: any) => {
                      const isUsed = projectUnits.some(
                        (u: any) => u.configuration_id === cfg.id || u.configuration === cfg.name,
                      );
                      return (
                        <div
                          key={cfg.id}
                          className="p-2 border rounded-lg border bg-muted/20 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-semibold truncate pr-2">{cfg.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfig(cfg.id, isUsed)}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold hover:underline shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Add Unit Dialog Modal ─────────────────── */}
      <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card text-left p-6 border border-border shadow-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-base">
              Add Configuration Unit
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUnitSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add_unumber">Unit / Door Number *</Label>
              <Input
                id="add_unumber"
                required
                placeholder="e.g. Tower B - 402"
                value={newUnitForm.unit_number}
                onChange={(e) => setNewUnitForm({ ...newUnitForm, unit_number: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Configuration *</Label>
              <Select
                value={newUnitForm.configuration_id}
                onValueChange={(v) => {
                  if (v === "__add_new_config__") {
                    setConfigOriginSource("add");
                    setNewConfigName("");
                    setNewConfigOpen(true);
                  } else {
                    setNewUnitForm({ ...newUnitForm, configuration_id: v });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Configuration" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {can(role).editProject() && (
                    <SelectItem
                      value="__add_new_config__"
                      className="text-primary font-bold border-t"
                    >
                      ➕ Add New Configuration...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add_uarea">Super Area (Sq Ft)</Label>
                <Input
                  id="add_uarea"
                  type="number"
                  value={newUnitForm.area}
                  onChange={(e) => setNewUnitForm({ ...newUnitForm, area: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add_uprice">Price (INR)</Label>
                <Input
                  id="add_uprice"
                  type="number"
                  value={newUnitForm.price}
                  onChange={(e) =>
                    setNewUnitForm({ ...newUnitForm, price: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddUnitOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Adding Unit..." : "Save Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Unit Dialog Modal ─────────────────── */}
      <Dialog open={editUnitOpen} onOpenChange={setEditUnitOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card text-left p-6 border border-border shadow-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Unit details:{" "}
              {selectedUnit?.unit_number}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUnitSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_unumber">Unit/Door Number</Label>
              <Input
                id="edit_unumber"
                required
                disabled={!canEditDetails}
                value={unitForm.unit_number}
                onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Configuration</Label>
              <Select
                disabled={!canEditDetails}
                value={unitForm.configuration_id}
                onValueChange={(v) => {
                  if (v === "__add_new_config__") {
                    setConfigOriginSource("edit");
                    setNewConfigName("");
                    setNewConfigOpen(true);
                  } else {
                    setUnitForm({ ...unitForm, configuration_id: v });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Configuration" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {can(role).editProject() && (
                    <SelectItem
                      value="__add_new_config__"
                      className="text-primary font-bold border-t"
                    >
                      ➕ Add New Configuration...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit_uarea">Super Area (Sq Ft)</Label>
                <Input
                  id="edit_uarea"
                  type="number"
                  disabled={!canEditDetails}
                  value={unitForm.area}
                  onChange={(e) => setUnitForm({ ...unitForm, area: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_uprice">Base Pricing (INR)</Label>
                <Input
                  id="edit_uprice"
                  type="number"
                  disabled={!canEditDetails}
                  value={unitForm.price}
                  onChange={(e) => setUnitForm({ ...unitForm, price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Unit Allocation Status</Label>
              <Select
                disabled={
                  !can(role).approveReservation() &&
                  (!can(role).requestReservation() || selectedUnit?.status !== "available")
                }
                value={unitForm.status}
                onValueChange={(v: any) => setUnitForm({ ...unitForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">🟢 Available</SelectItem>
                  <SelectItem value="pending_reserve">🟡 Request Reservation (Pending)</SelectItem>
                  {can(role).approveReservation() && (
                    <SelectItem value="reserved">🟠 Reserved (Manager Confirmed)</SelectItem>
                  )}
                  {can(role).markUnitSold() && (
                    <SelectItem value="sold">🔴 Sold / Booked</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {unitForm.status !== "available" && (
              <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border border-dashed animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-primary" /> Customer Reference
                </Label>
                <Select
                  disabled={!canEdit}
                  value={unitForm.reserved_by}
                  onValueChange={(v) => setUnitForm({ ...unitForm, reserved_by: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Link Customer Profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {can(role).approveReservation() ||
            (can(role).requestReservation() && selectedUnit?.status === "available") ? (
              <DialogFooter className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditUnitOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy} className="gap-1.5">
                  <Check className="h-4 w-4" /> Save Changes
                </Button>
              </DialogFooter>
            ) : (
              <div className="text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded border text-center font-semibold">
                Read-only: Sales Executives can view unit details but cannot edit inventory records.
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Configuration Sub-Modal ─────────────────── */}
      <Dialog open={newConfigOpen} onOpenChange={setNewConfigOpen}>
        <DialogContent className="sm:max-w-[360px] bg-card text-left p-6 border border-border shadow-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-sm">
              Add Configuration Option
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateConfigSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="config_name">Configuration Name</Label>
              <Input
                id="config_name"
                required
                placeholder="e.g. 5 BHK, Luxury Villa, Studio"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewConfigOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
