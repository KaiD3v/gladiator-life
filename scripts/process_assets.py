"""Converte as imagens geradas pelo Codex (PNG grandes) em assets pixel art leves para public/assets.

Uso: python scripts/process_assets.py <pasta-com-os-png>
- Sprites/ícones: fundo magenta #FF00FF vira transparente, margem é cortada, alpha fica binário (bordas duras).
- Fundos (bg-*): recorte 16:9 e redução para 480x270.
Redução por média (BOX) + exibição com `image-rendering: pixelated` mantém o visual de pixel art.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'

# nome -> maior dimensão final (px). Fundos tratados à parte.
SIZES = {
    **{k: 160 for k in ['warrior', 'mage', 'assassin', 'bandit', 'wolf', 'brute', 'sorcerer',
                        'banditLeader', 'direWolf', 'bruteWarrior', 'elderSorcerer', 'hellhound', 'executioner', 'necromancer',
                        'retiarius', 'corsair', 'crocodile', 'tideAugur', 'lion', 'bear', 'beastmaster',
                        'praetorian', 'murmillo', 'sagittarius', 'haruspex']},
    **{k: 200 for k in ['tauros', 'serpent', 'emperor', 'nerissa', 'hannibal', 'draco', 'ally-tauros']},
    **{k: 64 for k in ['chippedSword', 'bronzeShield', 'emberAmulet', 'swiftBoots', 'serratedDagger', 'titanHeart',
                       'manaCrystal', 'vampireChalice', 'thornCloak', 'venomFlask', 'ritualBandage', 'warHorn', 'rest',
                       'praetorianGladius', 'praetorianScutum', 'lionMane', 'augurEye', 'laurelCrown',
                       'retiariusNet', 'crocTooth', 'tideAnchor']},
    **{k: 128 for k in ['victory', 'defeat', 'chest']},
    **{f'st-{k}': 32 for k in ['poison', 'burn', 'stun', 'guard', 'weaken', 'regen', 'defend', 'flee']},
    **{f'npc-{k}': 160 for k in ['merchant', 'str', 'dex', 'wis', 'inn', 'general', 'mother', 'father', 'tauros', 'sabina', 'herald', 'varro']},
    **{f'fx-{k}': 160 for k in ['crowdthrow', 'braziers', 'cages', 'praetorians']},
    **{f'fx-{k}': 240 for k in ['sandstorm', 'tide']},
    **{k: 32 for k in ['attr-str', 'attr-dex', 'attr-wis', 'gold', 'day']},
}
# Sprites gerados olhando para o lado errado (jogador deve olhar à direita, inimigos à esquerda).
FLIP = {'warrior', 'mage', 'nerissa'}


def key_magenta(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # magenta puro e franjas rosadas do anti-aliasing do gerador
            if r > 140 and b > 140 and g < min(r, b) - 70:
                px[x, y] = (0, 0, 0, 0)
    return img


def sprite(src: Path, size: int) -> Image.Image:
    img = key_magenta(Image.open(src))
    # O gerador às vezes devolve fundo transparente com alpha residual (1..): zera antes de recortar a margem.
    img.putalpha(img.getchannel('A').point(lambda v: v if v > 110 else 0))
    img = img.crop(img.getbbox())
    scale = size / max(img.size)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BOX)
    r, g, b, a = img.split()
    a = a.point(lambda v: 255 if v > 110 else 0)
    img = Image.merge('RGBA', (r, g, b, a))
    return img.transpose(Image.FLIP_LEFT_RIGHT) if src.stem in FLIP else img


def background(src: Path) -> Image.Image:
    img = Image.open(src).convert('RGB')
    w, h = img.size
    th = round(w * 9 / 16)
    if th <= h:
        top = (h - th) // 2
        img = img.crop((0, top, w, top + th))
    else:
        tw = round(h * 16 / 9)
        left = (w - tw) // 2
        img = img.crop((left, 0, left + tw, h))
    return img.resize((480, 270), Image.BOX)


def main(src_dir: Path):
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for name in [*SIZES, 'bg-pit', 'bg-colosseum', 'bg-crimson', 'bg-title', 'bg-town', 'bg-village', 'bg-road',
                 'bg-corvara', 'bg-subura', 'bg-naumachia', 'bg-venatio', 'bg-coronation']:
        src = src_dir / f'{name}.png'
        if not src.exists():
            missing.append(name)
            continue
        img = background(src) if name.startswith('bg-') else sprite(src, SIZES[name])
        if name.startswith('bg-'):
            img.save(OUT / f'{name}.webp', quality=90, method=6)  # fotos grandes: perda leve, ~4x menor
        else:
            img.save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
        print(f'{name}.webp {img.size}')
    if missing:
        print('FALTANDO:', ', '.join(missing))


if __name__ == '__main__':
    main(Path(sys.argv[1]))
