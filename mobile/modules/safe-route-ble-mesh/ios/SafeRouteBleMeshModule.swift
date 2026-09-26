import CoreBluetooth
import ExpoModulesCore
import Foundation

public class SafeRouteBleMeshModule: Module, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
  private static let characteristicPrefix = "6f7a7c43-1e24-4cf8-9c6e-5f6e7f6f"
  private let fragmentBytes = 20
  private let maximumFragments = 48
  private let maximumEnvelopeBytes = 960
  private var serviceUUID: CBUUID?
  private var centralManager: CBCentralManager?
  private var peripheralManager: CBPeripheralManager?
  private var peripheralService: CBMutableService?
  private var activeEnvelope = Data()
  private var scanningRequested = false
  private var advertisingRequested = false
  private var connectedPeripheral: CBPeripheral?
  private var discoveredFragments: [CBCharacteristic] = []
  private var nextFragmentIndex = 0
  private var receivedFragments: [Data] = []

  public func definition() -> ModuleDefinition {
    Name("SafeRouteBleMesh")
    Events("onEnvelopeReceived")

    AsyncFunction("isSupported") { () -> Bool in
      CBCentralManager.authorization != .denied && CBPeripheralManager.authorization != .denied
    }

    AsyncFunction("startRelay") { (uuidText: String) in
      guard let uuid = UUID(uuidString: uuidText) else {
        throw NSError(domain: "SafeRouteBleMesh", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid BLE service UUID"])
      }
      self.serviceUUID = CBUUID(nsuuid: uuid)
      self.scanningRequested = true
      self.advertisingRequested = false
      if self.centralManager == nil {
        self.centralManager = CBCentralManager(delegate: self, queue: .main)
      }
      if self.peripheralManager == nil {
        self.peripheralManager = CBPeripheralManager(delegate: self, queue: .main)
      }
      self.startScanningIfReady()
      self.configurePeripheralIfReady()
    }.runOnQueue(.main)

    AsyncFunction("scanAndForward") {
      self.scanningRequested = true
      self.startScanningIfReady()
    }.runOnQueue(.main)

    AsyncFunction("advertise") { (envelope: String) in
      guard let data = envelope.data(using: .utf8), data.count <= self.maximumEnvelopeBytes else {
        throw NSError(domain: "SafeRouteBleMesh", code: 2, userInfo: [NSLocalizedDescriptionKey: "SOS envelope exceeds the BLE transfer limit"])
      }
      self.activeEnvelope = data
      self.advertisingRequested = true
      self.configurePeripheralIfReady()
    }.runOnQueue(.main)

    AsyncFunction("stopRelay") {
      self.scanningRequested = false
      self.advertisingRequested = false
      self.centralManager?.stopScan()
      self.peripheralManager?.stopAdvertising()
      self.peripheralManager?.removeAllServices()
      self.connectedPeripheral.map { self.centralManager?.cancelPeripheralConnection($0) }
      self.connectedPeripheral = nil
      self.peripheralService = nil
      self.activeEnvelope.removeAll()
      self.discoveredFragments.removeAll()
      self.receivedFragments.removeAll()
    }.runOnQueue(.main)

    OnDestroy {
      self.scanningRequested = false
      self.advertisingRequested = false
      self.centralManager?.stopScan()
      self.peripheralManager?.stopAdvertising()
      self.peripheralManager?.removeAllServices()
    }
  }

  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    startScanningIfReady()
  }

  public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    configurePeripheralIfReady()
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    guard error == nil, advertisingRequested, let serviceUUID else { return }
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceUUID]])
  }

  public func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    guard connectedPeripheral == nil else { return }
    connectedPeripheral = peripheral
    peripheral.delegate = self
    central.connect(peripheral)
  }

  public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    guard let serviceUUID else { return }
    peripheral.discoverServices([serviceUUID])
  }

  public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    connectedPeripheral = nil
  }

  public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    connectedPeripheral = nil
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == serviceUUID }) else {
      centralManager?.cancelPeripheralConnection(peripheral)
      return
    }
    peripheral.discoverCharacteristics(nil, for: service)
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard error == nil else {
      centralManager?.cancelPeripheralConnection(peripheral)
      return
    }
    discoveredFragments = (service.characteristics ?? [])
      .filter { $0.uuid.uuidString.lowercased().hasPrefix(Self.characteristicPrefix) }
      .sorted { $0.uuid.uuidString < $1.uuid.uuidString }
    nextFragmentIndex = 0
    receivedFragments.removeAll()
    readNextFragment(from: peripheral)
  }

  public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    guard error == nil, let data = characteristic.value else {
      centralManager?.cancelPeripheralConnection(peripheral)
      return
    }
    receivedFragments.append(data)
    nextFragmentIndex += 1
    if data.count >= fragmentBytes && nextFragmentIndex < discoveredFragments.count {
      readNextFragment(from: peripheral)
      return
    }
    let envelopeData = receivedFragments.reduce(into: Data()) { $0.append($1) }
    if let envelope = String(data: envelopeData, encoding: .utf8), !envelope.isEmpty {
      sendEvent("onEnvelopeReceived", ["envelope": envelope])
    }
    centralManager?.cancelPeripheralConnection(peripheral)
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    let fragmentIndex = fragmentIndex(for: request.characteristic.uuid)
    guard let fragmentIndex else {
      peripheral.respond(to: request, withResult: .attributeNotFound)
      return
    }
    let start = fragmentIndex * fragmentBytes + request.offset
    let end = min((fragmentIndex + 1) * fragmentBytes, activeEnvelope.count)
    guard start <= end else {
      peripheral.respond(to: request, withResult: .invalidOffset)
      return
    }
    request.value = activeEnvelope.subdata(in: start..<end)
    peripheral.respond(to: request, withResult: .success)
  }

  private func startScanningIfReady() {
    guard scanningRequested, centralManager?.state == .poweredOn, let serviceUUID else { return }
    centralManager?.scanForPeripherals(withServices: [serviceUUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
  }

  private func configurePeripheralIfReady() {
    guard advertisingRequested, peripheralManager?.state == .poweredOn, let serviceUUID else { return }
    peripheralManager?.stopAdvertising()
    peripheralManager?.removeAllServices()
    let characteristics = (0..<maximumFragments).map { fragmentIndex in
      CBMutableCharacteristic(
        type: Self.fragmentUuid(fragmentIndex),
        properties: [.read],
        value: nil,
        permissions: [.readable]
      )
    }
    let service = CBMutableService(type: serviceUUID, primary: true)
    service.characteristics = characteristics
    peripheralService = service
    peripheralManager?.add(service)
  }

  private func readNextFragment(from peripheral: CBPeripheral) {
    guard let characteristic = discoveredFragments[safe: nextFragmentIndex] else {
      centralManager?.cancelPeripheralConnection(peripheral)
      return
    }
    peripheral.readValue(for: characteristic)
  }

  private func fragmentIndex(for uuid: CBUUID) -> Int? {
    let uuidText = uuid.uuidString.lowercased()
    guard uuidText.hasPrefix(Self.characteristicPrefix),
          let index = Int(uuidText.suffix(4), radix: 16),
          (1...maximumFragments).contains(index) else { return nil }
    return index - 1
  }

  private static func fragmentUuid(_ index: Int) -> CBUUID {
    CBUUID(string: "\(characteristicPrefix)\(String(format: "%04x", index + 1))")
  }
}

private extension Array {
  subscript(safe index: Index) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}