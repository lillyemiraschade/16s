// Max dimensions for uploaded images (keeps base64 size reasonable)
const MAX_DIMENSION = 1000;
const MAX_DIMENSION_CONTENT = 600; // Smaller for content images that need to be in HTML output
const JPEG_QUALITY = 0.6;
const MAX_BASE64_SIZE = 500_000; // ~500KB for inspo images (only sent to AI)
const MAX_BASE64_SIZE_CONTENT = 100_000; // ~100KB for content images (must fit in HTML output)

// Remove background using remove.bg API
export async function removeBackground(imageData: string): Promise<string> {
  const response = await fetch("/api/remove-bg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData }),
  });

  if (!response.ok) {
    throw new Error("Background removal failed");
  }

  const data = await response.json();
  return data.imageData;
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressImage(dataUrl: string, forContent = false): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // Use smaller dimensions for content images (they need to fit in HTML output)
        const maxDim = forContent ? MAX_DIMENSION_CONTENT : MAX_DIMENSION;
        const maxSize = forContent ? MAX_BASE64_SIZE_CONTENT : MAX_BASE64_SIZE;

        // Scale down to max dimension
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // Try progressively lower quality if still too large
        let quality = forContent ? 0.7 : JPEG_QUALITY; // Higher initial quality for content
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > maxSize && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        // If still too large, scale down further
        if (result.length > maxSize) {
          const scale = forContent ? 0.5 : 0.7;
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL("image/jpeg", forContent ? 0.6 : 0.5);
        }

        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Re-compress an image for content embedding (smaller size for HTML output)
export function compressForContent(dataUrl: string): Promise<string> {
  return compressImage(dataUrl, true);
}

export async function processImageFiles(
  files: FileList | File[],
  onUpload: (base64: string) => void,
  onError?: (message: string) => void,
  forContent = false,
): Promise<void> {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB original file limit
  const MAX_IMAGES = 5;

  let count = 0;
  for (const file of Array.from(files)) {
    if (count >= MAX_IMAGES) {
      onError?.(`Maximum ${MAX_IMAGES} images allowed at once`);
      break;
    }

    if (!file.type.startsWith("image/")) {
      onError?.(`${file.name} is not an image`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      onError?.(`${file.name} is too large (max 10MB)`);
      continue;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      const compressed = await compressImage(dataUrl, forContent);
      onUpload(compressed);
      count++;
    } catch (err) {
      console.error("Failed to process image:", err);
      onError?.(`Failed to process ${file.name}`);
    }
  }
}
