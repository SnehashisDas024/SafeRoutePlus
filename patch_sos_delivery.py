import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\mobile\src\services\sosDelivery.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

exports = """
export function getRelayQueueSize(): number {
  return relayQueue.size;
}

export let isRelayActive = false;

// Update startOfflineSosRelay
"""

content = content.replace("export async function startOfflineSosRelay(): Promise<boolean> {", "export let isRelayActive = false;\n\nexport function getRelayQueueSize(): number {\n  return relayQueue.size;\n}\n\nexport async function startOfflineSosRelay(): Promise<boolean> {\n  isRelayActive = true;")
content = content.replace("export async function stopOfflineSosRelay(): Promise<void> {", "export async function stopOfflineSosRelay(): Promise<void> {\n  isRelayActive = false;")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated sosDelivery.ts")
