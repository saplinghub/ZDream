export {
  isTauri,
  getRuntime,
  applyDesktopChrome,
  saveTextFile,
  openTextFile,
  notify,
  hydrateKeys,
  platformGetItemSync,
  platformSetItemSync,
  platformRemoveItemSync,
} from '@/platform/desktop'

export {
  LIVE_WINDOW,
  LIVE_DOCK_WINDOW,
  openLiveMonitor,
  closeLiveMonitor,
  collapseLiveMonitor,
  expandLiveMonitor,
  toggleLiveMonitor,
  focusMainWindow,
  isLiveWindow,
} from '@/platform/windows'
