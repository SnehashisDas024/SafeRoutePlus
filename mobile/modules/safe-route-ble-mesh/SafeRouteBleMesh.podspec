Pod::Spec.new do |s|
  s.name           = 'SafeRouteBleMesh'
  s.version        = '1.0.0'
  s.summary        = 'SafeRoute+ offline SOS BLE transport'
  s.description    = 'Native BLE GATT transport for offline SOS envelopes.'
  s.license        = { :type => 'MIT' }
  s.author         = 'SafeRoute+'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => 'https://github.com/expo/expo.git' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end