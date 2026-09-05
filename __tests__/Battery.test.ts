import { NativeModules } from 'react-native'
import { getBatteryLevel } from '../src/battery/battery'

describe('Battery wrapper', () => {
  beforeEach(() => {
    ;(NativeModules as any).BatteryModule = {
      getBatteryLevel: jest.fn().mockResolvedValue(85),
    }
  })

  it('returns battery level from native module', async () => {
    const level = await getBatteryLevel()
    expect(level).toBe(85)
    expect((NativeModules as any).BatteryModule.getBatteryLevel).toHaveBeenCalled()
  })
})
