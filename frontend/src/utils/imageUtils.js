/**
 * Comprime una imagen antes de guardarla
 * Reduce fotos de ~2MB a ~100-150KB manteniendo buena calidad
 */
export const compressImage = (
  file,
  { maxWidth = 1200, quality = 0.75 } = {},
) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Escalar si es muy grande
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG comprimido
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Formatea bytes a texto legible
 */
export const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

/**
 * Obtiene el tamaño aproximado de un base64
 */
export const base64Size = (base64) => {
  const str = base64.split(",")[1] || base64;
  return Math.round((str.length * 3) / 4);
};
