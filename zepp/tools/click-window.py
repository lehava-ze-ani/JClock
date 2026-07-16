import ctypes
import sys
import time
from ctypes import wintypes


if len(sys.argv) not in (2, 4):
    raise SystemExit('usage: click-window.py <window-handle> [relative-x relative-y]')

user32 = ctypes.WinDLL('user32', use_last_error=True)
user32.SetProcessDPIAware()
window_handle = wintypes.HWND(int(sys.argv[1]))
rect = wintypes.RECT()
if not user32.GetWindowRect(window_handle, ctypes.byref(rect)):
    raise ctypes.WinError(ctypes.get_last_error())

user32.ShowWindow(window_handle, 9)
user32.SetForegroundWindow(window_handle)
time.sleep(0.25)
if len(sys.argv) == 4:
    cursor_x = rect.left + int(sys.argv[2])
    cursor_y = rect.top + int(sys.argv[3])
else:
    cursor_x = (rect.left + rect.right) // 2
    cursor_y = (rect.top + rect.bottom) // 2
user32.SetCursorPos(cursor_x, cursor_y)
user32.mouse_event(0x0002, 0, 0, 0, 0)
user32.mouse_event(0x0004, 0, 0, 0, 0)
print(f'clicked {cursor_x},{cursor_y} in {rect.left},{rect.top},{rect.right},{rect.bottom}')
