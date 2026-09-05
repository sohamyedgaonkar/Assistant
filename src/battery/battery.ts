import { NativeModules } from 'react-native'

export async function getBatteryLevel(): Promise<number> {
  const { BatteryModule } = NativeModules as any
  if (!BatteryModule || typeof BatteryModule.getBatteryLevel !== 'function') {
    throw new Error('BatteryModule native module is not available')
  }
  return await BatteryModule.getBatteryLevel()
}

export default { getBatteryLevel }
