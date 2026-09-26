package expo.modules.saferouteblemesh

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.ParcelUuid
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.util.UUID

class SafeRouteBleMeshModule : Module() {
  private var serviceUuid: UUID? = null
  private val fragmentCharacteristics = mutableListOf<BluetoothGattCharacteristic>()
  private val receivedFragments = mutableListOf<ByteArray>()
  private var clientFragments = emptyList<BluetoothGattCharacteristic>()
  private var nextClientFragment = 0
  private var gattServer: BluetoothGattServer? = null
  private var connectedGatt: BluetoothGatt? = null
  private var scanning = false
  private var advertising = false
  private var activeEnvelope = ""

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val bluetoothManager: BluetoothManager
    get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

  private val adapter: BluetoothAdapter?
    get() = bluetoothManager.adapter

  private val advertiserCallback = object : AdvertiseCallback() {}

  private val scannerCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      if (connectedGatt != null) return
      connectedGatt = result.device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE)
    }
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onServiceAdded(status: Int, service: BluetoothGattService) {
      if (status == BluetoothGatt.GATT_SUCCESS && activeEnvelope.isNotEmpty()) startAdvertising()
    }

    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic,
    ) {
      val fragmentIndex = fragmentIndex(characteristic.uuid)
      if (fragmentIndex == null) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        return
      }

      val payload = activeEnvelope.toByteArray(StandardCharsets.UTF_8)
      if (offset > FRAGMENT_BYTES) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
        return
      }
      val start = minOf(fragmentIndex * FRAGMENT_BYTES + offset, payload.size)
      val end = minOf((fragmentIndex + 1) * FRAGMENT_BYTES, payload.size)
      if (start > end) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
        return
      }
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, payload.copyOfRange(start, end))
    }
  }

  private val clientCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        if (!gatt.requestMtu(517)) gatt.discoverServices()
      } else {
        gatt.close()
        if (connectedGatt === gatt) connectedGatt = null
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) return
      clientFragments = serviceUuid?.let { gatt.getService(it) }?.characteristics
        ?.filter { it.uuid.toString().startsWith(ENVELOPE_CHARACTERISTIC_PREFIX) }
        ?.sortedBy { fragmentIndex(it.uuid) ?: MAX_FRAGMENTS }
        ?: emptyList()
      nextClientFragment = 0
      receivedFragments.clear()
      readNextFragment(gatt)
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      gatt.discoverServices()
    }

    @Suppress("DEPRECATION")
    override fun onCharacteristicRead(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      status: Int,
    ) {
      handleFragmentRead(gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
    }

    override fun onCharacteristicRead(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      value: ByteArray,
      status: Int,
    ) {
      handleFragmentRead(gatt, characteristic, value, status)
    }

    private fun handleFragmentRead(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      value: ByteArray,
      status: Int,
    ) {
      if (status == BluetoothGatt.GATT_SUCCESS && characteristic.uuid.toString().startsWith(ENVELOPE_CHARACTERISTIC_PREFIX)) {
        receivedFragments.add(value)
        nextClientFragment += 1
        if (value.size >= FRAGMENT_BYTES && nextClientFragment < clientFragments.size) {
          readNextFragment(gatt)
          return
        }
        val envelope = receivedFragments.flatten().toByteArray().toString(StandardCharsets.UTF_8)
        if (envelope.isNotBlank()) sendEvent("onEnvelopeReceived", mapOf("envelope" to envelope))
      }
      closeClient(gatt)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SafeRouteBleMesh")
    Events("onEnvelopeReceived")

    AsyncFunction("isSupported") {
      context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && adapter?.isEnabled == true
    }

    AsyncFunction("startRelay") { uuidText: String ->
      requireBluetoothPermission()
      val parsedUuid = UUID.fromString(uuidText)
      val bluetoothAdapter = adapter ?: throw IllegalStateException("Bluetooth is unavailable on this device")
      if (!bluetoothAdapter.isEnabled) throw IllegalStateException("Bluetooth is disabled")
      serviceUuid = parsedUuid

      if (gattServer == null) {
        val service = BluetoothGattService(parsedUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        for (fragmentIndex in 0 until MAX_FRAGMENTS) {
          val characteristic = BluetoothGattCharacteristic(
            fragmentUuid(fragmentIndex),
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ,
          )
          fragmentCharacteristics.add(characteristic)
          service.addCharacteristic(characteristic)
        }
        gattServer = bluetoothManager.openGattServer(context, serverCallback)
          ?: throw IllegalStateException("Unable to open the BLE GATT server")
        gattServer?.addService(service)
      }
      startScanning()
    }

    AsyncFunction("scanAndForward") {
      requireBluetoothPermission()
      startScanning()
    }

    AsyncFunction("advertise") { envelope: String ->
      requireBluetoothPermission()
      require(envelope.toByteArray(StandardCharsets.UTF_8).size <= MAX_ENVELOPE_BYTES) {
        "SOS envelope exceeds the BLE transfer limit"
      }
      activeEnvelope = envelope
      fragmentCharacteristics.forEachIndexed { index, characteristic ->
        val bytes = activeEnvelope.toByteArray(StandardCharsets.UTF_8)
        val start = index * FRAGMENT_BYTES
        val end = minOf(start + FRAGMENT_BYTES, bytes.size)
        characteristic.value = if (start < end) bytes.copyOfRange(start, end) else byteArrayOf()
      }
      startAdvertising()
    }

    AsyncFunction("stopRelay") {
      stopRelayInternal()
    }

    OnDestroy {
      stopRelayInternal()
    }
  }

  private fun requireBluetoothPermission() {
    if (android.os.Build.VERSION.SDK_INT >= 31 &&
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
    ) {
      throw SecurityException("Nearby Devices permission is required")
    }
    if (android.os.Build.VERSION.SDK_INT >= 31 &&
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED
    ) {
      throw SecurityException("Nearby Devices scan permission is required")
    }
    if (android.os.Build.VERSION.SDK_INT >= 31 &&
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED
    ) {
      throw SecurityException("Nearby Devices advertise permission is required")
    }
  }

  private fun startAdvertising() {
    val bluetoothAdapter = adapter ?: return
    val currentServiceUuid = serviceUuid ?: return
    val bleAdvertiser = bluetoothAdapter.bluetoothLeAdvertiser ?: return
    if (gattServer?.getService(currentServiceUuid) == null) return
    if (advertising) bleAdvertiser.stopAdvertising(advertiserCallback)
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)
      .setConnectable(true)
      .setTimeout(0)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_LOW)
      .build()
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(currentServiceUuid))
      .build()
    bleAdvertiser.startAdvertising(settings, data, advertiserCallback)
    advertising = true
  }

  private fun startScanning() {
    if (scanning) return
    val currentServiceUuid = serviceUuid ?: return
    val bleScanner = adapter?.bluetoothLeScanner ?: return
    val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(currentServiceUuid)).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    bleScanner.startScan(listOf(filter), settings, scannerCallback)
    scanning = true
  }

  private fun closeClient(gatt: BluetoothGatt) {
    gatt.disconnect()
    gatt.close()
    if (connectedGatt === gatt) connectedGatt = null
  }

  private fun readNextFragment(gatt: BluetoothGatt) {
    val characteristic = clientFragments.getOrNull(nextClientFragment)
    if (characteristic == null || !gatt.readCharacteristic(characteristic)) closeClient(gatt)
  }

  private fun fragmentIndex(uuid: UUID): Int? {
    val oneBasedIndex = uuid.toString().takeLast(4).toIntOrNull(16) ?: return null
    return (oneBasedIndex - 1).takeIf { it in 0 until MAX_FRAGMENTS }
  }

  private fun stopRelayInternal() {
    adapter?.bluetoothLeScanner?.let { if (scanning) it.stopScan(scannerCallback) }
    adapter?.bluetoothLeAdvertiser?.let { if (advertising) it.stopAdvertising(advertiserCallback) }
    scanning = false
    advertising = false
    connectedGatt?.let(::closeClient)
    connectedGatt = null
    gattServer?.close()
    gattServer = null
    fragmentCharacteristics.clear()
    clientFragments = emptyList()
    receivedFragments.clear()
    activeEnvelope = ""
  }

  private companion object {
    const val ENVELOPE_CHARACTERISTIC_PREFIX = "6f7a7c43-1e24-4cf8-9c6e-5f6e7f6f"
    fun fragmentUuid(index: Int): UUID = UUID.fromString("${ENVELOPE_CHARACTERISTIC_PREFIX}${(index + 1).toString(16).padStart(4, '0')}")
    const val FRAGMENT_BYTES = 20
    const val MAX_FRAGMENTS = 48
    const val MAX_ENVELOPE_BYTES = FRAGMENT_BYTES * MAX_FRAGMENTS
  }
}