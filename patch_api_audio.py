import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\services\api.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

new_func = """
export async function uploadAudioChunk(tripId: string, audioBlob: Blob): Promise<{ action: string, transcript: string }> {
  const token = localStorage.getItem('authToken') || AUTH_TOKEN
  const formData = new FormData()
  formData.append('file', audioBlob, 'chunk.webm')
  
  const res = await fetch(`${BASE_URL}/trips/${tripId}/audio-stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })
  if (!res.ok) throw new Error('Failed to upload audio chunk')
  return res.json()
}
"""

if "uploadAudioChunk" not in content:
    content = content + "\n" + new_func

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated api.ts with uploadAudioChunk")
