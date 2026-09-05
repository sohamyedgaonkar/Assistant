import { NativeModules } from 'react-native'

const { BatteryModule } = NativeModules as any

export async function getBatteryLevel(): Promise<number> {
  if (!BatteryModule || typeof BatteryModule.getBatteryLevel !== 'function') {
    throw new Error('BatteryModule native module is not available')
  }
  return await BatteryModule.getBatteryLevel()
}

export default { getBatteryLevel }
