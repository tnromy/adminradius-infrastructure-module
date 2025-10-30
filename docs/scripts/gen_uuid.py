#!/usr/bin/env python3
import sys
import time
import os
import uuid
import struct

def uuid7():
    # Waktu sekarang dalam milidetik sejak Unix epoch
    unix_ts_ms = int(time.time() * 1000)

    # 48-bit timestamp
    time_high = (unix_ts_ms >> 16) & 0xFFFFFFFFFFFF
    time_low = unix_ts_ms & 0xFFFF

    # Random 74 bits (10 untuk var+versi, 64 sisanya random)
    rand_bytes = os.urandom(10)
    rand_int = int.from_bytes(rand_bytes, "big")

    # Gabungkan timestamp dan random bits jadi UUIDv7
    # (sesuai draft RFC 4122bis)
    # UUID layout: time_hi (48 bits) + version(4 bits=0111) + time_low(12 bits)
    # + variant bits (2 bits=10) + random bits (62 bits)
    uuid_int = (
        (unix_ts_ms << 80) |  # timestamp (48 bits)
        (0x7 << 76) |         # version (4 bits, '7')
        (rand_int & ((1 << 76) - 1))  # remaining random bits
    )

    return uuid.UUID(int=uuid_int)

# Generate UUIDv7 dan print tanpa newline
u = uuid7()
sys.stdout.write(str(u))
sys.stdout.flush()
