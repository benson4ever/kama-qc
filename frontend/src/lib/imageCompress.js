// Compress an image File/Blob client-side using a canvas. Caps the largest
// dimension and re-encodes as JPEG to keep factory-connection uploads small.
// 2560/0.75 keeps small print (labels, measurement charts) readable.
export async function compressImage(file, { maxDim = 2560, quality = 0.75 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) { height = Math.round((height * maxDim) / width); width = maxDim; }
    else { width = Math.round((width * maxDim) / height); height = maxDim; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob || file;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
