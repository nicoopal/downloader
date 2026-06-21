"""Genera los íconos de la PWA (Frutiger Aero: gel verde + flecha de descarga)."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "public")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(size, pad_ratio=0.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Fondo: cuadrado redondeado con gradiente vertical (gel verde)
    top, mid, bot = (180, 240, 143), (127, 216, 79), (76, 185, 30)
    bg = Image.new("RGB", (size, size))
    bd = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        c = lerp(top, mid, t * 2) if t < 0.5 else lerp(mid, bot, (t - 0.5) * 2)
        bd.line([(0, y), (size, y)], fill=c)
    radius = int(size * 0.22)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(bg, (0, 0), mask)

    # Brillo superior (vidrio)
    gloss = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.rounded_rectangle([int(size*0.06), int(size*0.05), int(size*0.94), int(size*0.5)],
                         radius=int(size*0.2), fill=(255, 255, 255, 70))
    img = Image.alpha_composite(img, gloss)
    d = ImageDraw.Draw(img)

    # Flecha de descarga blanca (dentro de zona segura para maskable)
    cx = size / 2
    s = size * (1 - pad_ratio)
    off = (size - s) / 2
    stem_w = s * 0.16
    stem_top = off + s * 0.26
    stem_bot = off + s * 0.55
    d.rounded_rectangle([cx - stem_w/2, stem_top, cx + stem_w/2, stem_bot],
                        radius=stem_w/3, fill=(255, 255, 255, 255))
    hw = s * 0.30
    d.polygon([(cx - hw, off + s * 0.50), (cx + hw, off + s * 0.50), (cx, off + s * 0.78)],
              fill=(255, 255, 255, 255))
    # Bandeja (línea base)
    bar_w = s * 0.44
    d.rounded_rectangle([cx - bar_w/2, off + s*0.82, cx + bar_w/2, off + s*0.86],
                        radius=s*0.02, fill=(255, 255, 255, 235))
    return img


make(512, pad_ratio=0.0).save(os.path.join(OUT, "icon-512.png"))
make(192, pad_ratio=0.0).save(os.path.join(OUT, "icon-192.png"))
make(512, pad_ratio=0.18).save(os.path.join(OUT, "maskable-512.png"))
make(180, pad_ratio=0.0).save(os.path.join(OUT, "apple-touch-icon.png"))
print("Iconos generados en", OUT)
