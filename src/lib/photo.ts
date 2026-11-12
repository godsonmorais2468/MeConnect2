const MAX_BYTES = 2 * 1024 * 1024
const EDGE = 320

/** Reads a chosen image (max 2 MB) and shrinks it so it is cheap to keep. `edge` is the longest side, in pixels. */
export function readPhoto(file: File, edge = EDGE): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'))
    if (file.size > MAX_BYTES) return reject(new Error('Photo must be 2 MB or smaller.'))

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, edge / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That image could not be read.'))
    }
    img.src = url
  })
}
