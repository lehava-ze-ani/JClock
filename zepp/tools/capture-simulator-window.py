import ctypes
import sys
import time
from ctypes import wintypes

from PIL import Image


if len(sys.argv) != 3:
    raise SystemExit('usage: capture-simulator-window.py <window-handle> <output.png>')

window_handle = wintypes.HWND(int(sys.argv[1]))
output_path = sys.argv[2]
user32 = ctypes.WinDLL('user32', use_last_error=True)
gdi32 = ctypes.WinDLL('gdi32', use_last_error=True)


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wintypes.DWORD),
        ('biWidth', wintypes.LONG),
        ('biHeight', wintypes.LONG),
        ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD),
        ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD),
        ('biXPelsPerMeter', wintypes.LONG),
        ('biYPelsPerMeter', wintypes.LONG),
        ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD),
    ]


class RGBQUAD(ctypes.Structure):
    _fields_ = [
        ('rgbBlue', ctypes.c_ubyte),
        ('rgbGreen', ctypes.c_ubyte),
        ('rgbRed', ctypes.c_ubyte),
        ('rgbReserved', ctypes.c_ubyte),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [('bmiHeader', BITMAPINFOHEADER), ('bmiColors', RGBQUAD * 1)]

user32.GetWindowDC.restype = wintypes.HDC
user32.GetWindowDC.argtypes = [wintypes.HWND]
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.GetDIBits.argtypes = [
    wintypes.HDC,
    wintypes.HBITMAP,
    wintypes.UINT,
    wintypes.UINT,
    wintypes.LPVOID,
    ctypes.POINTER(BITMAPINFO),
    wintypes.UINT,
]
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.DeleteDC.argtypes = [wintypes.HDC]

rect = wintypes.RECT()
user32.ShowWindow(window_handle, 9)
user32.SetForegroundWindow(window_handle)
time.sleep(0.35)
if not user32.GetWindowRect(window_handle, ctypes.byref(rect)):
    raise ctypes.WinError(ctypes.get_last_error())
width = rect.right - rect.left
height = rect.bottom - rect.top

window_dc = user32.GetWindowDC(window_handle)
memory_dc = gdi32.CreateCompatibleDC(window_dc)
bitmap = gdi32.CreateCompatibleBitmap(window_dc, width, height)
previous_object = gdi32.SelectObject(memory_dc, bitmap)

try:
    if not user32.PrintWindow(window_handle, memory_dc, 2):
        raise ctypes.WinError(ctypes.get_last_error())

    bitmap_info = BITMAPINFO()
    bitmap_info.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bitmap_info.bmiHeader.biWidth = width
    bitmap_info.bmiHeader.biHeight = -height
    bitmap_info.bmiHeader.biPlanes = 1
    bitmap_info.bmiHeader.biBitCount = 32
    bitmap_info.bmiHeader.biCompression = 0
    pixels = ctypes.create_string_buffer(width * height * 4)
    lines = gdi32.GetDIBits(
        memory_dc,
        bitmap,
        0,
        height,
        pixels,
        ctypes.byref(bitmap_info),
        0,
    )
    if lines != height:
        raise ctypes.WinError(ctypes.get_last_error())

    image = Image.frombuffer('RGB', (width, height), pixels, 'raw', 'BGRX', 0, 1)
    image.save(output_path)
    print(output_path)
finally:
    gdi32.SelectObject(memory_dc, previous_object)
    gdi32.DeleteObject(bitmap)
    gdi32.DeleteDC(memory_dc)
    user32.ReleaseDC(window_handle, window_dc)
