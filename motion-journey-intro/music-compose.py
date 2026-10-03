import numpy as np, wave
SR = 44100
BPM = 70
beat = 60 / BPM
bar = 4 * beat
rng = np.random.default_rng(7)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
# D major, gentle: Dmaj9 – Bm7 – Gmaj7 – Asus4/A  (MIDI notes)
CH = [
  [50, 57, 61, 64, 66],   # D A C# E F#
  [47, 54, 57, 61, 62],   # B F# A C# D
  [43, 50, 54, 57, 59],   # G D F# A B
  [45, 52, 57, 59, 64],   # A E A B E
]
BARS = 32  # 8 פעמים המהלך, לופ
N = int(BARS * bar * SR)
L = np.zeros(N + SR * 4); R = np.zeros(N + SR * 4)

def add(buf, start, sig):
    i = int(start * SR); buf[i:i + len(sig)] += sig[: max(0, len(buf) - i)]

def piano(m, dur, vel):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k)) * np.exp(-t * (2.2 + k * 1.3)) for k, a in [(1, 1), (2, .38), (3, .16), (4, .07)])
    att = np.minimum(1, t / 0.006)
    return s * att * vel

def pad(ms, dur, vel):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(1, t / 1.6) * np.minimum(1, (dur - t) / 1.4).clip(0)
    s = np.zeros_like(t)
    for m in ms:
        for d in (-0.12, 0.12):
            f = hz(m + d * 0.1) * (1 + d * 0.003)
            s += np.sin(2 * np.pi * f * t + rng.random() * 6) + 0.15 * np.sin(4 * np.pi * f * t)
    lfo = 1 + 0.15 * np.sin(2 * np.pi * 0.18 * t)
    return s * env * lfo * vel / len(ms)

ARP = [0, 2, 3, 4, 3, 2, 1, 2]
for b in range(BARS):
    ch = CH[b % 4]; t0 = b * bar
    sec = b // 8  # 4 חלקים: פתיחה רכה, ארפג'ו, מנגינה, חזרה רכה
    p = pad([n + 12 for n in ch[1:4]], bar + 1.6, 0.11 if sec in (0, 3) else 0.09)
    add(L, t0, p); add(R, t0, p * 0.95)
    bass = piano(ch[0] - 12, bar + 1, 0.30); add(L, t0, bass); add(R, t0, bass)
    if sec >= 1 or b % 8 >= 4:
        for k, idx in enumerate(ARP if sec in (1, 2) else ARP[::2]):
            step = beat / 2 if sec in (1, 2) else beat
            n = ch[idx] + 12
            v = 0.16 * (0.75 + 0.25 * rng.random()) * (1.0 if k % 2 == 0 else 0.8)
            tt = t0 + k * step + rng.normal(0, 0.006)
            s = piano(n, 2.4, v); pan = 0.5 + 0.25 * np.sin(n)
            add(L, tt, s * (1 - pan) * 2 * 0.8); add(R, tt, s * pan * 2 * 0.8)
    if sec == 2:  # מנגינה פשוטה ושקטה מעל
        mel = [[78, None, 76, 74], [73, None, 74, None], [74, 76, 78, None], [76, None, None, None]][b % 4]
        for k, n in enumerate(mel):
            if n is None: continue
            s = piano(n, 3.2, 0.13); add(L, t0 + k * beat, s * 0.9); add(R, t0 + k * beat, s)

# לופ חלק: הזנב חוזר להתחלה
L[:SR * 4] += L[N:N + SR * 4]; R[:SR * 4] += R[N:N + SR * 4]
L = L[:N]; R = R[:N]

def reverb(x, seed):
    g = np.random.default_rng(seed)
    n = int(2.6 * SR); t = np.arange(n) / SR
    ir = g.normal(0, 1, n) * np.exp(-t * 2.6)
    ir = np.convolve(ir, np.ones(12) / 12, 'same')  # עמום וחם
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)
    # מעגלי: הזנב של הסוף נכנס להתחלה
    out = y[:len(x)].copy(); tail = y[len(x):len(x) + n]; out[:len(tail)] += tail
    return out / np.abs(ir).sum() * 9
wetL, wetR = reverb(L, 1), reverb(R, 2)
L2 = L * 0.75 + wetL * 0.5; R2 = R * 0.75 + wetR * 0.5
mx = max(np.abs(L2).max(), np.abs(R2).max())
L2, R2 = L2 / mx * 0.8, R2 / mx * 0.8
data = (np.stack([L2, R2], 1) * 32767).astype(np.int16)
with wave.open('calm.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('seconds', N / SR)
