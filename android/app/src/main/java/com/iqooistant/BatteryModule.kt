package com.iqooistant

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BatteryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
    return "BatteryModule"
  }

  @ReactMethod
  fun getBatteryLevel(promise: Promise) {
    try {
      val context: Context = reactApplicationContext
      val level: Int = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager?
        bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
      } else {
        val intent = Context.BATTERY_SERVICE
        val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus = context.registerReceiver(null, ifilter)
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        if (level >= 0 && scale > 0) (level * 100) / scale else -1
      }

      if (level >= 0) {
        promise.resolve(level)
      } else {
        promise.reject("E_BATTERY", "Could not get battery level")
      }
    } catch (e: Exception) {
      promise.reject("E_BATTERY", e)
    }
  }
}
