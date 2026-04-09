import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Camera, Loader2, SwitchCamera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCamera } from "../camera/useCamera";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function CameraCapture({
  onCapture,
  onCancel,
}: CameraCaptureProps) {
  const {
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retry,
    videoRef,
    canvasRef,
  } = useCamera({
    facingMode: "environment",
    width: 1920,
    height: 1080,
    quality: 0.92,
    format: "image/jpeg",
  });

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detect if device is desktop (no camera switching on desktop)
    const checkDevice = () => {
      setIsDesktop(
        !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ),
      );
    };
    checkDevice();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only when isSupported changes to avoid infinite loop
  useEffect(() => {
    // Auto-start camera when component mounts
    if (isSupported && !isActive && !error) {
      startCamera();
    }

    // Cleanup: stop camera when component unmounts
    return () => {
      if (isActive) {
        stopCamera();
      }
    };
  }, [isSupported]);

  const handleCapture = async () => {
    const photo = await capturePhoto();
    if (photo) {
      const imageUrl = URL.createObjectURL(photo);
      setCapturedImage(imageUrl);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      // Convert captured image back to File
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          URL.revokeObjectURL(capturedImage);
        });
    }
  };

  const handleRetake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
  };

  const handleSwitchCamera = async () => {
    if (!isDesktop) {
      await switchCamera();
    }
  };

  const handleRetry = async () => {
    await retry();
  };

  if (isSupported === false) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Camera is not supported in your browser. Please use a modern
              browser like Chrome, Edge, or Safari.
            </AlertDescription>
          </Alert>
          <Button onClick={onCancel} variant="outline" className="w-full mt-4">
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.type === "permission" &&
                "Camera permission denied. Please allow camera access in your browser settings."}
              {error.type === "not-found" && "No camera found on this device."}
              {error.type === "not-supported" &&
                "Camera is not supported in your browser."}
              {error.type === "unknown" && `Camera error: ${error.message}`}
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                "Retry"
              )}
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <div className="relative bg-black rounded-t-lg overflow-hidden">
          {/* Camera Preview or Captured Image */}
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Initializing camera...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Camera Controls */}
        <div className="p-4 space-y-3">
          {capturedImage ? (
            // Confirmation Controls
            <div className="flex gap-2">
              <Button
                onClick={handleRetake}
                variant="outline"
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                Confirm & Upload
              </Button>
            </div>
          ) : (
            // Capture Controls
            <>
              <div className="flex items-center justify-center gap-4">
                {/* Switch Camera Button (only on mobile) */}
                {!isDesktop && (
                  <Button
                    onClick={handleSwitchCamera}
                    variant="outline"
                    size="icon"
                    disabled={isLoading || !isActive}
                    className="rounded-full h-12 w-12"
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </Button>
                )}

                {/* Capture Button */}
                <Button
                  onClick={handleCapture}
                  disabled={isLoading || !isActive}
                  size="lg"
                  className="rounded-full h-16 w-16 p-0"
                >
                  <Camera className="h-6 w-6" />
                </Button>

                {/* Spacer for symmetry on mobile */}
                {!isDesktop && <div className="h-12 w-12" />}
              </div>

              {/* Camera Info */}
              <div className="text-center text-xs text-muted-foreground">
                {isActive && (
                  <p>
                    Using {currentFacingMode === "user" ? "front" : "rear"}{" "}
                    camera
                    {!isDesktop && " • Tap switch to change"}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Cancel Button */}
          <Button onClick={onCancel} variant="ghost" className="w-full">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
