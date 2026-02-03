// Max dimensions for uploaded images (keeps base64 size reasonable)
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.6;
const MAX_BASE64_SIZE = 500_000; // ~500KB per image

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // Scale down to max dimension
        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          if (w > h) {
            h = Math.round((h * MAX_DIMENSION) / w);
            w = MAX_DIMENSION;
          } else {
            w = Math.round((w * MAX_DIMENSION) / h);
            h = MAX_DIMENSION;
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
        let quality = JPEG_QUALITY;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > MAX_BASE64_SIZE && quality > 0.2) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        // If still too large, scale down further
        if (result.length > MAX_BASE64_SIZE) {
          const scale = 0.7;
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL("image/jpeg", 0.5);
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

export async function processImageFiles(
  files: FileList | File[],
  onUpload: (base64: string) => void,
  onError?: (message: string) => void,
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
      const compressed = await compressImage(dataUrl);
      onUpload(compressed);
      count++;
    } catch (err) {
      console.error("Failed to process image:", err);
      onError?.(`Failed to process ${file.name}`);
    }
  }
}
