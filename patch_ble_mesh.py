import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\mobile\src\services\bleMesh.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("export function isBleMeshNativeModuleAvailable(): boolean {", "export async function checkBlePermissions(): Promise<boolean> {\n  if (Platform.OS !== 'android') return true;\n  const permissions = Number(Platform.Version) >= 31\n    ? [\n      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,\n      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,\n      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,\n    ]\n    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];\n  for (const p of permissions) {\n    if (await PermissionsAndroid.check(p) === false) return false;\n  }\n  return true;\n}\n\nexport function isBleMeshNativeModuleAvailable(): boolean {")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated bleMesh.ts")
