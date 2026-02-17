#!/usr/bin/env python3
"""
Internal Matrix Kernel — Benchmark Chart Generator
===================================================
Professional conference-quality figure (EuroPar 2026).

Layout: 16:9 — full-width grouped bar chart on top, slim summary table below.
Designed for projection readability with clean academic typography.

Usage:
    python3 generate_benchmark_chart.py          # 600 DPI PNG + PDF
    python3 generate_benchmark_chart.py --dpi 300
"""
import argparse
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# ── Data ─────────────────────────────────────────────────────────────────────

VERSIONS = ['Compact', 'v1', 'v2', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10']

COMPILED   = [255,  86,  78,  66,  65,  66,  57,  55,  51,  49]
SIMULATED  = [255, 403, 352, 234, 233, 240, 231, 232, 240, 238]
CLOCK_CYC  = [289, 529, 446, 247, 246, 253, 240, 245, 253, 251]
STARTUP    = [779, 272, 248, 212, 209, 212, 185, 179, 167, 161]
MEM_OPS    = [ 81, 173, 141,  48,  48,  48,  32,  48,  48,  48]

DESCRIPTIONS = [
    'Fully unrolled, no control-flow reuse',
    'JUMP + Barrett subroutine at PE(3,0)',
    'Link PE @(3,3), R0-based return addr.',
    'Ring reduction via ROUT bypass',
    'Direct R2 propagation (no relay)',
    'Merged Barrett shared subroutine',
    'DP 0-collision + unified goto R0',
    'Inverted sub, entry-point alias, R3=P',
    'Entry-point aliasing × 4 reductions',
    'Torus folding: relay+sum via RCL/RCR/RCT/RCB',
]

# 1-based row indices to highlight (Pareto-optimal)
PARETO_ROWS = [7, 10]

# ── Palette — muted, accessible, professional ────────────────────────────────

COLORS = {
    'comp':  '#3A76AF',  # steel blue
    'sim':   '#C44E52',  # muted red
    'cc':    '#DD8452',  # warm orange
    'start': '#55A868',  # sage green
    'mem':   '#8172B3',  # soft purple
    'grid':  '#E0E0E0',
    'hdr':   '#2C3E50',  # dark slate header
    'hl':    '#D6EAF8',  # light blue highlight
    'row0':  '#F8F9FA',  # zebra even
    'row1':  '#FFFFFF',  # zebra odd
    'label': '#EEEEEE',  # row label bg
}

BAR_LABELS = [r'$N_{comp}$', r'$N_{sim}$', r'$N_{CC}$', r'$N_{start}$', r'$N_{mem}$']
COL_LABELS = [r'$N_c$', r'$N_s$', r'$N_{CC}$', r'$N_{st}$', r'$N_m$', 'Key Innovation']


def generate(dpi: int = 600):
    plt.rcParams.update({
        'font.family': 'serif',
        'font.serif': ['CMU Serif', 'Times New Roman', 'DejaVu Serif'],
        'mathtext.fontset': 'cm',
        'axes.linewidth': 0.6,
    })

    all_data  = [COMPILED, SIMULATED, CLOCK_CYC, STARTUP, MEM_OPS]
    pal       = [COLORS['comp'], COLORS['sim'], COLORS['cc'],
                 COLORS['start'], COLORS['mem']]
    nv, nm    = len(VERSIONS), len(all_data)
    x         = np.arange(nv)
    w         = 0.155

    # ── Figure: 16:9 ─────────────────────────────────────────────────────
    fig = plt.figure(figsize=(16, 9), facecolor='white')
    gs  = fig.add_gridspec(
        2, 1, height_ratios=[2.2, 1], hspace=0.06,
        left=0.06, right=0.97, top=0.93, bottom=0.04,
    )

    # ═══════════════════════ BAR CHART (top) ═════════════════════════════
    ax = fig.add_subplot(gs[0])

    for i in range(nm):
        off  = (i - (nm - 1) / 2) * w
        best_idx = int(np.argmin(all_data[i]))
        bars = ax.bar(
            x + off, all_data[i], w,
            color=pal[i], edgecolor='white', lw=0.4,
            label=BAR_LABELS[i], zorder=3,
        )
        # Highlight best (minimum) bar: darker-toned border + same-family hatch
        import matplotlib.colors as mcolors
        dark = tuple(c * 0.55 for c in mcolors.to_rgb(pal[i]))  # 55% brightness
        best_bar = bars[best_idx]
        best_bar.set_edgecolor(dark)
        best_bar.set_linewidth(1.2)
        best_bar.set_zorder(5)
        # Hatch overlay — slightly darker than bar color
        ax.bar(
            x[best_idx] + off, all_data[i][best_idx], w,
            color='none', edgecolor=dark, lw=0,
            hatch='////', alpha=0.5, zorder=6,
        )
        # Value labels on top of each bar
        for j, (b, val) in enumerate(zip(bars, all_data[i])):
            fw = 'black' if j == best_idx else '#222'
            fs = 10.5 if j == best_idx else 9.5
            ax.text(
                b.get_x() + b.get_width() / 2,
                val * 1.07,
                str(val),
                ha='center', va='bottom',
                fontsize=fs, fontweight='bold', color=fw,
                rotation=90,
            )

    # Axes styling
    ax.set_yscale('log', base=2)
    ax.set_ylim(20, 1500)
    ax.set_yticks([32, 64, 128, 256, 512, 1024])
    ax.yaxis.set_major_formatter(mticker.ScalarFormatter())
    ax.yaxis.set_minor_formatter(mticker.NullFormatter())
    ax.set_xticks(x)
    ax.set_xticklabels(VERSIONS, fontsize=13, fontweight='bold')
    ax.set_ylabel(r'Cycles  ($\log_2$ scale)', fontsize=13, labelpad=8)
    ax.tick_params(axis='y', labelsize=11, length=3, width=0.5)
    ax.tick_params(axis='x', length=0)

    # Title
    ax.set_title(
        r'Internal Matrix Kernel — Optimization Progression on $4\!\times\!4$ Torus CGRA',
        fontsize=16, fontweight='bold', pad=12,
    )

    # Legend — horizontal, above the bars
    ax.legend(
        fontsize=11, ncol=5,
        loc='upper right',
        frameon=True, framealpha=0.92, edgecolor='#ccc',
        fancybox=False, handlelength=1.2, columnspacing=0.8,
        handletextpad=0.4,
    )

    # Grid: subtle horizontal only
    ax.grid(axis='y', color=COLORS['grid'], ls='-', lw=0.5, zorder=0)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#888')
    ax.spines['bottom'].set_color('#888')

    # ═══════════════════════ TABLE (bottom) ═══════════════════════════════
    ax2 = fig.add_subplot(gs[1])
    ax2.axis('off')

    cell_data = [
        [str(COMPILED[i]), str(SIMULATED[i]), str(CLOCK_CYC[i]),
         str(STARTUP[i]), str(MEM_OPS[i]), DESCRIPTIONS[i]]
        for i in range(nv)
    ]

    tab = ax2.table(
        cellText=cell_data,
        rowLabels=VERSIONS,
        colLabels=COL_LABELS,
        loc='upper center',
        bbox=[0.02, 0.10, 0.96, 0.88],
    )
    tab.auto_set_font_size(False)
    tab.set_fontsize(10)

    # Column widths: numeric cols narrow, description wide
    col_w = [0.055, 0.055, 0.055, 0.055, 0.055, 0.58]
    for (row, col), cell in tab.get_celld().items():
        cell.set_edgecolor('#D0D0D0')
        cell.set_linewidth(0.4)
        cell.set_height(0.08)
        cell.PAD = 0.04

        if 0 <= col < len(col_w):
            cell.set_width(col_w[col])
        if col == -1:                       # row label col
            cell.set_width(0.065)

        # ── Row styling ──
        if row == 0:                        # header
            cell.set_facecolor(COLORS['hdr'])
            cell.set_text_props(
                color='white', fontweight='bold', fontsize=10,
            )
        elif row in PARETO_ROWS:            # Pareto highlight
            cell.set_facecolor(COLORS['hl'])
        else:                               # zebra stripe
            cell.set_facecolor(COLORS['row0'] if row % 2 == 0 else COLORS['row1'])

        if col == -1 and row > 0:           # row label
            cell.set_facecolor(COLORS['label'])
            cell.set_text_props(fontweight='bold', fontsize=10)

        if col == 5:                        # left-align description
            cell._loc = 'left'

    # Footnote
    ax2.text(
        0.02, 0.04,
        r'$N_c$: compiled instruction slots  ·  '
        r'$N_s$: simulation cycles  ·  '
        r'$N_{CC}$: clock cycles incl. DMA stalls  ·  '
        r'$N_{st}$: kernel boot latency  ·  '
        r'$N_m$: memory load/store ops  ·  '
        r'Highlighted rows: Pareto-optimal configurations',
        fontsize=8, color='#666', style='italic', va='top',
        transform=ax2.transAxes,
    )

    # ── Save ─────────────────────────────────────────────────────────────
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base = os.path.join(script_dir, 'benchmark_all_versions')
    save_kw = dict(facecolor='white', bbox_inches='tight', pad_inches=0.15)
    fig.savefig(f'{base}.png', dpi=dpi, **save_kw)
    fig.savefig(f'{base}.pdf', **save_kw)
    fig.savefig(f'{base}.svg', **save_kw)   # vector — perfect for Slides
    plt.close(fig)
    print(f'✓ {base}.png ({dpi} DPI) + .pdf + .svg')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--dpi', type=int, default=300)
    generate(dpi=p.parse_args().dpi)
