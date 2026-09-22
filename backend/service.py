

import random

from backend.repository import get_cctv
from backend.schema import CCTV

def sev_rancctv():
    end = 2327
    target = random.randint(1,end)
    cctv = get_cctv(target)
    return cctv

def sev_cctv_byid(id:int):
    return get_cctv(id)