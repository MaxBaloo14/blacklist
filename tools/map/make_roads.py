"""Extrait le réseau routier de la carte (public/img/map-base.webp) -> public/img/map-roads.png (lignes d'1 pixel, 1 = route).
L'éditeur de circuit s'en sert pour suivre les routes automatiquement (plus court chemin entre deux points cliqués)."""
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, disk

m = np.array(Image.open("public/img/map-base.webp").convert("L")).astype(int)
bright = m > 95
wide = ndi.binary_opening(bright, structure=disk(4))                 # mer et relief : grandes zones claires
roads = bright & ~ndi.binary_dilation(wide, structure=disk(2))      # il reste les routes (traits fins)
roads = ndi.binary_closing(roads, structure=disk(3))                 # recolle les carrefours percés
sk = skeletonize(roads)
lab, n = ndi.label(sk, structure=np.ones((3, 3)))
size = ndi.sum(sk, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(size) if s >= 40])  # retire les débris
print("pixels de route :", int(keep.sum()), "composantes :", int((size >= 40).sum()))
Image.fromarray((keep * 255).astype(np.uint8)).convert("1").save("public/img/map-roads.png", optimize=True)
