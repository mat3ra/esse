# Experimental data survey: what the NLR and UTK files contain

> **Type:** context — field inventories backing the experimental-data plans; not a plan itself.
> **Created:** 2026-09-02 · **Updated:** 2026-09-02
> **Driver:** [SOF-7988](https://mat3ra.atlassian.net/browse/SOF-7988) (AlphaFilm cross-org data exchange).
> **Surveyed by:** the coding agent, from the shared "Experimental Data" Drive folder (subfolders
> `NLR Data Examples` and `SPM Data Examples`), 2026-09-02. Binary files were inspected by parsing
> their headers; text files were read whole.

## 1. Inventory

| Folder | File | What it is |
| --- | --- | --- |
| `NLR Data Examples/depositions lmc files/deposition/` | `deposition__PDAC_COM11__26.json`, `deposition__PDAC_COM11__27.json` | one combinatorial sputter run each, `format: "lmc-1.0"`, `form: "htem:deposition"` |
| `…/depositions lmc files/staged process/` | `process_stage__PDAC_COM5__1699__{1,2,3}.json` | three stages of one process (deposition on `pdac_com5`, deposition with post-anneal, deposition), `form: "htem:process_stage"` |
| `…/depositions lmc files/subsampling/` | `deposition__PDAC_COM5__1558.json`, `process_stage__PDAC_COM5__1558__{2,3}.json` | a deposition followed by two annealing stages on `rta1` that also cut the library into sub-samples (`subsample_id` `R12`, `R34`) |
| `…/htem db files/6705/`, `…/htem db files/7969/` | `6705.csv`, `property.csv`, `property.json`, `spectra.json`, `xrd_spectra.csv`, `link.txt` | HTEM database exports for two Al-Sc-N libraries |
| `…/relevant papers/` | Zakutayev et al. 2018 (HTEM DB), Talley et al. 2021 (research data infrastructure) | background |
| root | `HTEM_Database_ReportPPT.pptx` | retrospective analysis of the HTEM archive (1,891 libraries, 82,776 samples; Al-N-Sc: 17 libraries, XRD on 100 %, XRF on 5.9 %) — no schema content |
| `SPM Data Examples/SPM_Scan/` | `PFM_DART_raw.ibw`, two PPTX reports | Asylum Research Jupiter DART-PFM image + result slides |
| `SPM Data Examples/PFM_DART_Hysteresis/` | `PLZT_0005.ibw`, `{Amp,Phase,Freq,bias,X,Y}_{on,off}.npy`, three PNG | DART switching-spectroscopy waveform + extracted on/off-field loops |

## 2. NLR lab-system records (`lmc-1.0`)

### 2.1. `htem:deposition` — all keys

```
form, format, username, instrument (pdac_com5 | pdac_com11), project_id (":0:", ":39:"), number,
date ("3/2/2026"), presputter_time (min), sputter_time (min), notes (free text),
gas: { cracker: { enabled, fwd_pwr, refl_pwr }, cryoshroud, dep_torr, base_torr,
       gasses: [ { gas: "N2" | "Ar", flow (sccm) } ] },
targets: [ { material ("AlSc", "Mg", "Mo", "Al"), position ("TL" | "BC" | "L" | "R"),
             supply ("RF"), fwd_pwr (W), refl_pwr (W), volts, gun_angle } ],
substrate: { substrates: [ { material ("d Si", "Pt Si", "Pt SiC", "SiC, nGaN", "Si/SiO2", "pSi") } ],
             config ("S4C1" | "S1C1"), bias: { enabled }, rotation: { enabled, frequency (rpm) } },
temp: { setpoint (C), ideal (C) }, heating: { enabled }, anneal: { enabled }
```

Verbatim example (`deposition__PDAC_COM11__26.json`, an AlScN combinatorial library):

```json
{"form":"htem:deposition","format":"lmc-1.0","username":"Yeageun","instrument":"pdac_com11","project_id":":0:","number":26,"date":"3/2/2026","presputter_time":10,"sputter_time":75,"notes":"AlScN combi library\nRotation: 60\n100C 30min dwell at chamber\nSubstrate all the way down","gas":{"cracker":{"enabled":false},"cryoshroud":false,"dep_torr":0.003,"base_torr":1e-7,"gasses":[{"gas":"N2","flow":7},{"gas":"Ar","flow":13}]},"targets":[{"material":"AlSc","position":"TL","supply":"RF","fwd_pwr":150,"refl_pwr":0,"gun_angle":0.3}],"substrate":{"substrates":[{"material":"d Si"},{"material":"Pt Si"},{"material":"Pt SiC"},{"material":"SiC, nGaN"}],"config":"S4C1","bias":{"enabled":false}},"temp":{"setpoint":100},"heating":{"enabled":true},"anneal":{"enabled":false}}
```

### 2.2. `htem:process_stage` — additional keys

```
stage (1..n), stage_type ("deposition" | "annealing"), stage_instrument (pdac_com5 | rta1),
ramp_time (min), anneal_time (min),
subsample: { type: "subsample", rows, columns, matrix ("V1aaaa…;bbbb…;…") }, subsample_id ("R12")
```

Observed: stage 1 of 1699 is a sputter deposition (Al target, 60 W RF, N2 5 + Ar 8 sccm, 4 mTorr);
stage 2 is a two-target deposition (La 73 W, Mo 54 W) whose `notes` describe a 30 min in-situ
anneal at 850 C set-point (747 C read) with the cracker on; stage 3 is another Al deposition.
Stages 2 and 3 of 1558 are rapid-thermal anneals (`rta1`, N2 100 sccm, 600 C and 900 C, ramp 1 min,
hold 3 min) that each define a 4 × 4 sub-sample matrix.

Every key is a set-point except `refl_pwr`, `volts` and `temp.ideal`, which are readings. Units are
implicit (min, sccm, Torr, W, V, C, rpm).

## 3. HTEM database exports

### 3.1. Library record (`6705.csv`, key/value)

`Box Number, Data Access (public), Deposition Base Pressure Mtorr, Deposition Compounds
(["Sc","Al",null]), Deposition Cycles, Deposition Energy, Deposition Gas Flow Sccm ([6,3,null]),
Deposition Gases (["Argon","Nitrogen",null]), Deposition Growth Pressure Mtorr, Deposition Initial
Temp C (400), Deposition Power ([20,50,null]), Deposition Rep Rate, Deposition Sample Time Min (120),
Deposition Substrate Material (Glass), Deposition Target Pulses, Deposition Ts Distance, Elements
(["Sc","Al","N"]), Has Ele (0), Has Opt (44), Has Xrd (44), Has Xrf (0), Id (6705), Num (53), Owner
Email, Owner Name, Pdac (5), Person Id, Quality (3), Sample Date (2015-12-18), Sample Ids [44],
Sputter Operator, Xrf Compounds, Xrf Elements, Xrf Type`.

`Deposition Target Pulses / Rep Rate / Energy / Cycles / Ts Distance` are pulsed-laser-deposition
fields (empty for these sputtered libraries). `link.txt` →
`https://htem.nlr.gov/finder/sample-libraries/<uuid>`.

### 3.2. Per-position table (`property.csv`, 44 rows)

`sample_library_id, deposition_instrument, nrel_library_number, position (1..44), x_mm (5.4, 9.4, …
45.4), y_mm (6.65, 19.15, …), thickness_um, fpm_resistivity_ohmcm, fpm_conductivity_spercm,
fpm_standard_deviation_ohmpersq, fpm_sheet_resistance_ohmpersq, absolute_temp_c (299–488.2),
xrf_compounds, xrf_concentration_percent, xrd_peak_count, opt_direct_bandgap_ev,
opt_average_vis_trans, sciround, deposition_compounds, deposition_power,
deposition_base_pressure_mtorr, deposition_growth_pressure_mtorr, deposition_target_pulses,
deposition_rep_rate, deposition_energy, deposition_cycles, deposition_ts_distance,
deposition_initial_temp_c, deposition_gases, deposition_substrate_material,
deposition_gas_flow_sccm, sample_date, owner_name, owner_email`.

The grid is 4 rows × 11 columns, 4 mm pitch in x. `absolute_temp_c` varies per position (a
temperature gradient across the library). `property.json` is the same table as one object of
44-element arrays keyed by column name (`thickness`, `fpm_resistivity`, … without unit suffixes).

### 3.3. Spectra

`spectra.json` = `{ "xrd": [ { sample_library_id, position[29084], angle[29084], measurement[29084] } ],
"optical": [] }` — one flattened array per column, 661 two-theta points (19.0–52.0°, 0.05° step) per
position. `xrd_spectra.csv` = `sample_library_id, sample_id, position, angle_twotheta,
intensity_arbu` (29,084 rows). The HTEM API also serves `oo.{uvit,uvir,nirt,nirr}.{wavelength,
response}` optical arrays (from `NatLabRockies/htem-api-examples/lib`).

## 4. UTK scanning-probe files (Asylum Research, Igor binary wave v5)

### 4.1. `PFM_DART_raw.ibw` (1,688,293 bytes)

Wave: 256 × 256 × 6 layers, float32, dimension units `m`; layer labels
`HeightRetrace, Amplitude1Retrace, Amplitude2Retrace, Phase1Retrace, Phase2Retrace, FrequencyRetrace`.
Note block (744 lines), the keys that matter:

```
ScanSize: 2e-06        FastScanSize: 2e-06   SlowScanSize: 2e-06   ScanRate: 2.0032 (Hz)
XOffset: -1.476e-06    YOffset: 8.707e-07    PointsLines: 256      ScanLines: 256
ScanAngle: 90          ScanDown: 1           ScanSpeed: 1.0016e-05 ImagingMode: PFM Mode
AmplitudeSetpointVolts: 0.8   DeflectionSetpointNewtons: 5e-09   Setpoint: 0.0008
DriveAmplitude: 0.50007       DriveFrequency: 372177.16          FrequencyRatio: 1.0403
SpringConstant: 2.1868        InvOLS: 8.2055e-08   AmpInvOLS: 8.9439e-08
DARTIGain: 750  DARTPGain: 0  TipVoltage: 0  SurfaceVoltage: 0  TipBiasOffset: 0
MicroscopeModel: Jupiter      Version: 19.34.88    Date: 2026-03-13   Time: 6:05:58 PM
TipSerialNumber: (empty)      BaseName: DART_
Amplitude: $Lockin.0.r  Phase: $Lockin.0.theta  Amplitude1: $Lockin.1.r  Phase1: $Lockin.1.theta
```

### 4.2. `PLZT_0005.ibw` (226,514 bytes)

Wave: 6431 × 8 columns, dimension units `m`, `s`; column labels `Bias, Defl, Freq, Phas2, Phase,
ZSnsr` (+ two amplitude columns). Note keys specific to switching spectroscopy:

```
ARDoIVAmp: 9 (V)  ARDoIVFrequency: 0.9058 (Hz)  ARDoIVCycles: 2  ARDoIVFunc: ARDoIVTriangleSquare
ARDoIVPointsPerSec: 2000  ARDoIVBandWidth: 1000  ARDoIVArg3: 0.005  ARDoIVDither: 0
ScanSize: 3.75e-06  DriveAmplitude: 0.5  DriveFrequency: 3.727e+05  SpringConstant: 2.4728
InvOLS: 9.1964e-08  DARTIGain: 20  MicroscopeModel: Jupiter  Version: 19.44.93  Date: 2026-07-07
```

The `.npy` files are the extracted on-field / off-field loops (`Amp`, `Phase`, `Freq`, `bias`, `X`,
`Y`), i.e. the same waveform split by the bias-waveform phase.

### 4.3. Report slides

PFM results (UTK, B. Slautin): sample `(BaCaSrPb)TiO3` sol-gel; probe `Multi75-EG`; DART PFM with an
external lock-in, `Vac_vert = Vac_lat = 1 V`, `df = ±5 kHz`, set-point `0.15 V`; vertical and lateral
channels; poling ("lithography") at ±25 V; hysteresis loops on/off-field. Topography survey (NLR):
317 tapping-mode 2 µm topography scans across an 8 cm circle on Al-Sc-N gradient films 84–265 nm
thick.

## 5. Conclusions carried into the plans

1. A process is multi-stage, each stage on its own instrument → `process → stage → step`, the
   mirror of `workflow → subworkflow → unit`.
2. A sample is hierarchical (library → 44 positions → sub-sample pieces) → `sample` with `_parent`,
   `position`, `library`.
3. SPM data is multi-channel and N-dimensional → one `array_data` reusable with named axes.
4. Most measured quantities are ordinary properties → reuse `property/holder`; only `source`
   learns about measurements.
5. Vendor files are referenced, not embedded → `core/reusable/file_reference` + `apse/` formats.
