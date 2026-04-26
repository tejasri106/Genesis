# TNBC Biomarkers: Clinical Reference Guide

## 1. BRCA1/2 — Homologous Recombination Deficiency

### Definition
- **BRCA1** (chromosome 17q21) and **BRCA2** (chromosome 13q12): tumor suppressor genes encoding DNA repair proteins
- Pathogenic germline variants → hereditary breast and ovarian cancer syndrome
- Somatic BRCA mutations occur in ~10–20% of TNBC without germline mutation

### Prevalence in TNBC
- Germline BRCA1 mutation: ~10–15% of TNBC
- Germline BRCA2 mutation: ~3–5% of TNBC
- Somatic BRCA1/2 mutation: additional ~10%
- HRD (homologous recombination deficiency) without BRCA mutation: ~40–50% (broader HRD testing needed)

### Clinical Significance
| BRCA Status | Implications |
|-------------|-------------|
| BRCA1 mutated | PARP inhibitor eligible (olaparib, talazoparib); platinum sensitivity; KEYNOTE-522 benefit |
| BRCA2 mutated | PARP inhibitor eligible; OlympiAD benefit; platinum sensitivity |
| BRCA wild-type | PARP inhibitors NOT indicated; no platinum hypersensitivity assumption |

### Testing
- Germline testing: blood/saliva — required for PARP inhibitor eligibility per FDA label
- Tumor somatic testing: tumor tissue — may guide platinum use, not PARP inhibitor approval
- Validated tests: BRACAnalysis CDx (Myriad), FoundationOne CDx, BRCAExchange

### Key Numbers (Helix thresholds)
- Germline BRCA mutation present → flag PARP inhibitor eligibility
- HRD score ≥42 (Myriad myChoice) → may predict platinum/PARP sensitivity even without BRCA mutation

---

## 2. PD-L1 (CPS) — Programmed Death-Ligand 1

### Definition
- PD-L1: immune checkpoint protein expressed on tumor cells and immune cells
- **CPS (Combined Positive Score):** Number of PD-L1+ cells (tumor + immune) per 100 tumor cells × 100
- CPS is the FDA-approved scoring method for pembrolizumab indication in breast cancer

### Assays
| Assay | Antibody | Companion Diagnostic For |
|-------|----------|--------------------------|
| 22C3 pharmDx | 22C3 | Pembrolizumab (Keytruda) — TNBC |
| SP142 | SP142 | Atezolizumab (Tecentriq) — withdrawn |
| 28-8 pharmDx | 28-8 | Nivolumab (investigational) |

**Note:** CPS with 22C3 is the validated test for pembrolizumab in TNBC.

### Clinical Significance by CPS Threshold
| CPS | Pembrolizumab Benefit | Notes |
|-----|----------------------|-------|
| ≥10 | Strong evidence (KEYNOTE-522 early; KEYNOTE-355 metastatic) | Clearest benefit signal |
| 1–9 | Modest benefit in KEYNOTE-522 | Benefit present but smaller |
| <1 | Weak evidence in metastatic; benefit in early TNBC still present | Use clinical judgment |

### Helix Rule
- PD-L1 CPS ≥10 → pembrolizumab signal is strongest; highlight immunotherapy benefit
- PD-L1 CPS <10 → note limited signal; pembrolizumab still approved for early TNBC regardless of PD-L1 (KEYNOTE-522)
- PD-L1 not tested → cannot determine immunotherapy eligibility for metastatic TNBC

---

## 3. Ki-67 — Proliferation Index

### Definition
- Ki-67: nuclear protein expressed in all actively cycling cells (G1, S, G2, M phases)
- Expressed as percentage of tumor cells staining positive (proliferation index)
- Assessed by IHC in tumor biopsy

### Thresholds in TNBC
| Ki-67 % | Classification | Clinical Context |
|---------|---------------|-----------------|
| <15% | Low | Uncommon in TNBC; may indicate LAR subtype |
| 15–30% | Intermediate | Moderate proliferation |
| >30% | High | Typical for TNBC; correlates with aggressive biology |
| >50% | Very high | Most TNBC at diagnosis |

### Clinical Implications
- **High Ki-67 (>30%):** More chemotherapy-sensitive; pCR more achievable
- **Low Ki-67:** May indicate LAR (luminal androgen receptor) TNBC subtype — consider AR-targeted therapy
- Ki-67 as pCR predictor: High pre-treatment Ki-67 → better pCR to neoadjuvant chemotherapy
- Post-treatment Ki-67: Residual Ki-67 after neoadjuvant therapy is prognostic

### Helix Interpretation
- Ki-67 >30%: Flag as high-proliferation TNBC; standard neoadjuvant chemo + pembrolizumab appropriate
- Ki-67 <15%: Consider whether LAR subtype workup is needed

---

## 4. CA 15-3 — Tumor Marker

### Definition
- CA 15-3: Circulating glycoprotein antigen shed by tumor cells
- Mucin-1 (MUC-1) derived; elevated in breast cancer, especially metastatic
- Reference range: <30–38 U/mL (lab-dependent; TNBC patients at diagnosis often 20–80 U/mL)

### Clinical Use in TNBC
| Setting | CA 15-3 Role |
|---------|-------------|
| Baseline | Establishes patient-specific reference point |
| During treatment | Decline indicates treatment response; rise indicates progression |
| Surveillance | Rising trend may precede imaging-detectable recurrence by weeks |
| Limitations | Not recommended for screening (low specificity); elevated in benign conditions |

### Response Interpretation
- >25% decrease from baseline: indicative of response (no standardized threshold)
- Rising CA 15-3 on treatment: flag for imaging re-evaluation
- Normalization after neoadjuvant: associated with better outcomes (exploratory)

### Helix Digital Twin Context
- CA 15-3 trajectory modeled over simulation window
- Baseline CA 15-3 used to initialize biomarker projection
- ΔCA 15-3 = intervention CA 15-3 − baseline CA 15-3 (negative = favorable)

---

## 5. Tumor Burden Score (TBS)

### Definition (Helix-specific metric)
- Composite score derived from: tumor size, lymph node status, CA 15-3, Ki-67
- Normalized 0–100 scale (higher = greater burden)
- Used in Helix simulation as aggregate endpoint

### Interpretation
- Decrease in TBS: indicates response to intervention
- ΔTumor Burden: intervention TBS − baseline TBS (negative = favorable)

---

## 6. Disease-Free Survival (DFS) Probability

### Definition
- DFS: Time from surgery (or randomization) to first relapse or death from any cause
- Expressed as probability (%) at a specified time point (e.g., 3-year, 5-year DFS)

### TNBC Context
- 5-year DFS for stage II TNBC achieving pCR: ~85–90%
- 5-year DFS for stage III TNBC with residual disease: ~50–60%
- Pembrolizumab improvement (KEYNOTE-522): +7.7% absolute 3-year EFS

### Helix Simulation
- ΔDFS Probability: projected change in DFS probability at end of simulation window
- Positive ΔDFS = intervention improves survival probability vs standard of care
