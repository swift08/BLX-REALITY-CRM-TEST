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

  const pdfViewerSrc = file.url.startsWith("data:")
    ? file.url
    : googleDocsViewerUrl(displayUrl);

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
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) { onClose(); setPdfLoading(true); } }}>
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
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={openUploadedFile}>
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
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClose(); setPdfLoading(true); }}>
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
            {file.url.startsWith("data:")
              ? `Uploaded file — ${file.name}`
              : displayUrl}
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
                    <p className="text-xs font-semibold text-muted-foreground">Loading PDF viewer…</p>
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
  const [editForm, setEditForm] = useState({
    name: "",
    developer_id: "",
    location: "",
    total_units: 100,
    available_units: 100,
    price_range: "",
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
      });
      setDevInputMode("select");
      setCustomDevName("");
      setPriceNumVal("");
      setPriceMoneyUnit("Crores (Cr)");
    } catch (err: any) {
      toast.error(err.message || "Failed to add project listing");
    } finally {
      setBusy(false);
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
    });
    setEditDevInputMode("select");
    setEditCustomDevName("");
    setEditPriceNumVal(proj.price_range || "");
    setEditPriceMoneyUnit("Crores (Cr)");
    setEditOpen(true);
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
                      {devInputMode === "select" ? "✏️ Type New Builder Name" : "🔗 Select Existing Builder"}
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
                        <SelectItem value="__type_new__" className="text-primary font-bold border-t">
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
          projects.map((p) => (
            <Card
              key={p.id}
              className="border-border/60 hover:shadow-md transition-shadow relative group rounded-2xl overflow-hidden"
            >
              <CardHeader className="pb-3 bg-muted/10 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <FolderGit2 className="h-4.5 w-4.5" />
                  </div>
                  <CardTitle className="text-sm font-bold font-display text-foreground">
                    {p.name}
                  </CardTitle>
                </div>
                {can(role).editProject() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => handleEditOpen(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-xs text-left">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">
                    {p.developers?.name || "Partner Builder"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{p.location || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <span className="font-semibold text-primary">{p.price_range || "—"}</span>
                </div>

                {(() => {
                  const projectUnits = inventory.filter((u) => u.project_id === p.id);
                  const activeAvailableUnits = projectUnits.filter((u) => u.status === "available").length;
                  const nonAvailableUnits = projectUnits.filter((u) => u.status !== "available").length;
                  
                  const displayAvailableUnits = Math.max(
                    activeAvailableUnits,
                    Math.max(0, (p.available_units ?? 0) - nonAvailableUnits)
                  );
                  const displayTotalUnits = Math.max(projectUnits.length, p.total_units ?? 0);

                  return (
                    <div className="flex items-center justify-between border-t border-dashed pt-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          Available Units
                        </span>
                        <span className="text-lg font-bold text-foreground mt-0.5">
                          {displayAvailableUnits}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          Total Units
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground mt-1">
                          {displayTotalUnits}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="text-[10px] font-medium text-muted-foreground bg-muted/20 p-2 rounded-xl flex justify-between items-center">
                  <span>Files Catalog:</span>
                  <span className="font-bold text-foreground">
                    {(p.brochures?.length || 0) +
                      (p.floor_plans?.length || 0) +
                      (p.documents?.length || 0) +
                      (p.gallery_images?.length || 0)}{" "}
                    files
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold h-9 rounded-xl mt-1 gap-1.5 flex items-center justify-center border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditOpen(p);
                  }}
                >
                  <FolderGit2 className="h-3.5 w-3.5" />
                  {can(role).editProject() ? "Manage Workspace" : "View Workspace & Files"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Project Details Workspace Modal ─────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl bg-card rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-primary" /> {selectedProj?.name} Portfolio
              Workspace
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-xl">
              <TabsTrigger value="profile" className="rounded-lg text-xs font-bold">Listing Details</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg text-xs font-bold">Files & Visual Floor Plans</TabsTrigger>
            </TabsList>

            {/* ── Listing Details Tab ── */}
            <TabsContent value="profile" className="space-y-4 py-4 text-left">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
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

                {/* Developer Field in Edit Modal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Developer / Builder *</Label>
                    {can(role).editProject() && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditDevInputMode(editDevInputMode === "select" ? "custom" : "select");
                        }}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        {editDevInputMode === "select" ? "✏️ Type New Builder Name" : "🔗 Select Existing Builder"}
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
                        <SelectItem value="__type_new__" className="text-primary font-bold border-t">
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

                {/* Price Configuration Range in Edit Modal */}
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

                {can(role).editProject() && (
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={busy} className="rounded-xl font-bold h-10 px-6">
                      {busy ? "Saving..." : "Update Profile"}
                    </Button>
                  </div>
                )}
              </form>
            </TabsContent>

            {/* ── Files & Visual Floor Plans Tab ── */}
            <TabsContent value="documents" className="space-y-5 py-4 text-left">
              {can(role).editProject() && (
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
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
