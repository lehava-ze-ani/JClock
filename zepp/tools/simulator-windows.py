import ctypes
import json
import sys
from ctypes import wintypes


user32 = ctypes.WinDLL('user32', use_last_error=True)
process_ids = {int(value) for value in sys.argv[1:]}
windows = []


@ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
def visit_window(hwnd, _lparam):
    process_id = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
    if process_id.value not in process_ids:
        return True

    title_length = user32.GetWindowTextLengthW(hwnd)
    title_buffer = ctypes.create_unicode_buffer(title_length + 1)
    user32.GetWindowTextW(hwnd, title_buffer, len(title_buffer))

    class_buffer = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, class_buffer, len(class_buffer))
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    windows.append({
        'handle': int(hwnd),
        'processId': process_id.value,
        'visible': bool(user32.IsWindowVisible(hwnd)),
        'title': title_buffer.value,
        'className': class_buffer.value,
        'rect': [rect.left, rect.top, rect.right, rect.bottom],
    })
    return True


user32.EnumWindows(visit_window, 0)
print(json.dumps(windows, ensure_ascii=True, indent=2))
