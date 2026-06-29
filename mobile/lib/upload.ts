/**
 * Uploads a picked image (as base64) to a storage bucket via the web API.
 * React Native cannot reliably upload Blobs or multipart FormData, so we send the
 * base64 the picker already gives us and let the server (service-role) store it.
 * Pass `asset.base64` from expo-image-picker (launch with { base64: true }).
 * Returns the public URL, or throws on failure.
 *
 * Before sending, the image is resized + recompressed (see compressForUpload) so
 * uploads stay well under Vercel's 4.5 MB serverless body limit and cut storage cost.
 */
export async function uploadBase64(base64: string, uri: string, bucket: string, folder = ''): Promise<string> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  // Shrink the photo first (falls back to the original if the native module
  // isn't in the current build — it activates after the next EAS rebuild).
  const prepared = await compressForUpload(uri, base64)
  const ext = prepared.ext

  const res = await fetch(`${apiUrl}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, folder, base64: prepared.base64, ext }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Upload failed')

  // The server returns a URL on its own Supabase host (often 127.0.0.1) which the
  // phone can't reach. Rewrite the origin to the Supabase host the device uses so the
  // stored/displayed URL works on both the device and the web dashboard.
  let url = json.url as string
  const sb = process.env.EXPO_PUBLIC_SUPABASE_URL
  if (sb) url = url.replace(/^https?:\/\/[^/]+/, sb.replace(/\/$/, ''))
  return url
}

/**
 * Resize a photo to a max width and recompress it as JPEG, returning fresh base64.
 * Uses expo-image-manipulator when present; if the native module isn't available in
 * the running build (e.g. before the production rebuild), it returns the original
 * base64 unchanged so nothing breaks.
 */
async function compressForUpload(
  uri: string,
  fallbackBase64: string,
): Promise<{ base64: string; ext: string }> {
  const rawExt = (uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase()
  try {
    // Guarded require: if the native module is missing this throws and we fall back.
    const ImageManipulator = require('expo-image-manipulator')
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    )
    if (result?.base64) return { base64: result.base64, ext: 'jpg' }
  } catch {
    // module not linked yet — use the original photo
  }
  return { base64: fallbackBase64, ext: rawExt }
}
