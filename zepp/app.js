import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    globalData: {
      latitude: 31.7768514,
      longitude: 35.2331664
    },
    onCreate() {
      console.log('[JClock] messaging bridge ready')
    },
    onDestroy() {}
  })
)
