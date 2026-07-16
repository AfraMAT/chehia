/**
 * Downscale + re-encode an image before upload, so menu/cover photos don't ship
 * multi-megabyte originals to customers on metered Tunisian data plans. Caps the
 * longest edge at `maxEdge` and re-encodes JPEG at `quality`. Falls back to the
 * original File if the browser can't decode it (e.g. exotic format).
 */
export async function resizeImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    // Already small enough and already a JPEG → leave it alone.
    if (scale === 1 && file.type === "image/jpeg") {
      bitmap.close();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
