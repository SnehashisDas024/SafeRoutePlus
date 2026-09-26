import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\mobile\src\screens\ActiveTrip.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

imports = """
import { checkBlePermissions, isBleMeshNativeModuleAvailable } from '../services/bleMesh';
import { getRelayQueueSize, isRelayActive } from '../services/sosDelivery';
"""
content = content.replace("import { sendVoiceEvent } from '../services/api';", "import { sendVoiceEvent } from '../services/api';\n" + imports)

state_vars = """
  const [bleStatus, setBleStatus] = useState<{ available: boolean; permissions: boolean; queue: number; active: boolean }>({ available: false, permissions: false, queue: 0, active: false });

  useEffect(() => {
    const timer = setInterval(async () => {
      setBleStatus({
        available: isBleMeshNativeModuleAvailable(),
        permissions: await checkBlePermissions(),
        queue: getRelayQueueSize(),
        active: isRelayActive
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);
"""
content = content.replace("const [showCheckinModal, setShowCheckinModal] = useState(false);", "const [showCheckinModal, setShowCheckinModal] = useState(false);\n" + state_vars)

ui = """
        <View style={styles.bleStatusContainer}>
          <Text style={styles.bleStatusTitle}>BLE Mesh Network</Text>
          <Text style={styles.bleStatusText}>
            {!bleStatus.available ? 'Module unavailable (needs native build)' :
             !bleStatus.permissions ? 'Permission denied (check Bluetooth settings)' :
             !bleStatus.active ? 'Relay inactive' :
             `Relay Active • Queued Packets: ${bleStatus.queue}`}
          </Text>
          <Text style={styles.bleStatusSub}>Best effort delivery without internet.</Text>
        </View>
"""
content = content.replace("        {sosDeliveryStatus && (", ui + "\n        {sosDeliveryStatus && (")

style = """
  bleStatusContainer: { backgroundColor: '#f0f4f8', padding: 12, borderRadius: 8, marginBottom: 12 },
  bleStatusTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E4E6E', marginBottom: 2 },
  bleStatusText: { fontSize: 13, color: '#333' },
  bleStatusSub: { fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 4 },
"""
content = content.replace("  sosBtn: { backgroundColor: '#d32f2f', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },", style + "  sosBtn: { backgroundColor: '#d32f2f', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated ActiveTrip.tsx")
