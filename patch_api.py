import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\services\api.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

new_funcs = """
export async function fetchUserProfile() {
  const token = localStorage.getItem('authToken')
  const res = await fetch(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

export async function fetchTripHistory() {
  const token = localStorage.getItem('authToken')
  const res = await fetch(`${BASE_URL}/trips`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}
"""

if "fetchUserProfile" not in content:
    content = content + "\n" + new_funcs

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated api.ts")
