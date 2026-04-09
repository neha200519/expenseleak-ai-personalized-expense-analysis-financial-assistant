import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Eye,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// ExternalBlob import removed — using direct metadata upload
import CameraCapture from "../components/CameraCapture";
import PageTransition from "../components/PageTransition";
import {
  useDeleteDocument,
  useListDocuments,
  useUploadDocument,
} from "../hooks/useQueries";

export default function DocumentsPage() {
  const { data: documents = [], isLoading } = useListDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const [isDragging, setIsDragging] = useState(false);

  // Cap loading state at 2 seconds — never hang forever
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setLoadingTimedOut(true), 2000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const showLoading = isLoading && !loadingTimedOut;
  const [previewDocument, setPreviewDocument] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(
          `${file.name} is not a supported file type. Only images and PDFs are allowed.`,
        );
        continue;
      }

      try {
        setUploadProgress(0);

        await uploadMutation.mutateAsync({
          name: file.name,
          fileType: file.type,
          size: BigInt(file.size),
        });

        toast.success(`${file.name} uploaded successfully!`);
        setUploadProgress(null);
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}`);
        setUploadProgress(null);
      }
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowCamera(false);
    await handleFiles([file]);
  };

  const handleDelete = async (documentId: bigint, filename: string) => {
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
      try {
        await deleteMutation.mutateAsync(documentId);
        toast.success("Document deleted successfully");
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete document");
      }
    }
  };

  const handlePreview = (
    blobHash: string,
    contentType: string,
    filename: string,
  ) => {
    setPreviewDocument({ url: blobHash, type: contentType, name: filename });
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isImage = (contentType: string) => contentType.startsWith("image/");

  return (
    <PageTransition>
      <style>{`
        @keyframes docFadeUp {
          from { opacity:0; transform:translateY(16px); }
          to { opacity:1; transform:translateY(0); }
        }
        .doc-header { animation: docFadeUp 0.4s ease-out both; }
        .doc-upload { animation: docFadeUp 0.4s ease-out 60ms both; }
        .doc-list   { animation: docFadeUp 0.4s ease-out 120ms both; }
        .doc-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .doc-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-hover); }
        @media (prefers-reduced-motion:reduce) {
          .doc-header,.doc-upload,.doc-list,.doc-card { animation:none!important; transition:none!important; }
        }
      `}</style>
      <div
        style={{
          background: "var(--bg-page)",
          minHeight: "100vh",
          padding: "2rem 1rem",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="doc-header" style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                color: "var(--text-h)",
                fontSize: "clamp(1.5rem,4vw,2rem)",
                fontWeight: 800,
                margin: "0 0 0.375rem",
              }}
              data-ocid="documents.page"
            >
              Document Storage
            </h1>
            <p
              style={{
                color: "var(--text-muted)",
                margin: 0,
                fontSize: "0.95rem",
              }}
            >
              Upload and manage your receipts and bills securely
            </p>
          </div>

          {/* Upload Area */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents
              </CardTitle>
              <CardDescription>
                Drag and drop files, click to browse, or capture with camera.
                Supports images (JPEG, PNG) and PDFs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload/Drag-Drop Option */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: drag-and-drop zone, keyboard accessible via the hidden file input */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <img
                    src="/assets/generated/upload-icon-transparent.dim_48x48.png"
                    alt="Upload"
                    className="h-12 w-12 mx-auto mb-3 opacity-50"
                  />
                  <p className="text-base font-medium mb-1">
                    {isDragging ? "Drop files here" : "Upload from device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Drag & drop or click to browse
                  </p>
                </div>

                {/* Camera Capture Option */}
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                >
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-base font-medium mb-1">
                    Capture with camera
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Take a photo directly
                  </p>
                </button>
              </div>

              {uploadProgress !== null && (
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Uploading... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img
                  src="/assets/generated/documents-icon-transparent.dim_64x64.png"
                  alt="Documents"
                  className="h-6 w-6"
                />
                Your Documents
              </CardTitle>
              <CardDescription>
                {documents.length}{" "}
                {documents.length === 1 ? "document" : "documents"} stored
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText
                    className="h-12 w-12 mx-auto mb-4"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <p
                    className="font-semibold text-lg mb-2"
                    style={{ color: "var(--text-h)" }}
                  >
                    No documents yet
                  </p>
                  <p
                    className="text-sm mb-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Upload receipts and bills to keep them organized
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--text-on-primary)",
                    }}
                    data-ocid="documents.empty_state.upload_button"
                  >
                    Upload Document
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <Card
                      key={doc.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="aspect-video bg-muted flex items-center justify-center relative">
                        {isImage(doc.fileType) ? (
                          <img
                            src={`/api/documents/${doc.id}`}
                            alt={doc.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src="/assets/generated/pdf-icon-transparent.dim_32x32.png"
                            alt="PDF"
                            className="h-16 w-16 opacity-50"
                          />
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3
                          className="font-medium truncate mb-1"
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          {formatDate(doc.uploadedAt)}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                              handlePreview(
                                `/api/documents/${doc.id}`,
                                doc.fileType,
                                doc.name,
                              )
                            }
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(doc.id, doc.name)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Dialog */}
          <Dialog
            open={!!previewDocument}
            onOpenChange={() => setPreviewDocument(null)}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="truncate pr-8">{previewDocument?.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewDocument(null)}
                    className="absolute right-4 top-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {previewDocument &&
                  (isImage(previewDocument.type) ? (
                    <img
                      src={previewDocument.url}
                      alt={previewDocument.name}
                      className="w-full h-auto rounded-lg"
                    />
                  ) : (
                    <iframe
                      src={previewDocument.url}
                      className="w-full h-[70vh] rounded-lg border"
                      title={previewDocument.name}
                    />
                  ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Camera Dialog */}
          <Dialog open={showCamera} onOpenChange={setShowCamera}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Capture Document</DialogTitle>
              </DialogHeader>
              <CameraCapture
                onCapture={handleCameraCapture}
                onCancel={() => setShowCamera(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </PageTransition>
  );
}
