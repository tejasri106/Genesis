# Genesis Medical AI Dataset

## Company Overview
Genesis is a dedicated clinical AI platform providing comprehensive decision support to oncologists treating Triple-Negative Breast Cancer (TNBC). Our mission is to ensure every clinician has access to real-time, evidence-grounded simulation tools to improve patient outcomes. We offer a suite of AI-driven services designed to meet the diagnostic, treatment planning, and research needs of oncology teams managing TNBC patients across all disease stages.

## Services Offered
1. **Digital Twin Simulation**: Real-time biomarker trajectory modeling (CA 15-3, Tumor Burden Score, DFS probability) anchored to landmark TNBC trials (KEYNOTE-522, OlympiAD, ASCENT, CREATE-X).
2. **Multi-Agent Clinical Research**: Live search across PubMed, EuropePMC, ClinicalTrials.gov, and Semantic Scholar — synthesized into actionable clinical summaries.
3. **Knowledge Base Query**: Instant access to NCCN/ESMO guidelines, biomarker definitions, staging criteria, and curated TNBC trial evidence.
4. **Intervention Stack Analysis**: Comparative simulation of treatment regimens against standard-of-care baselines for individual patient profiles.
5. **Clinical Fact-Checking**: AI-powered validation of clinical claims against retrieved evidence — returns SUPPORTED, CONTRADICTED, or UNCERTAIN verdicts.
6. **Voice-Enabled Interface**: Speech-to-text input and text-to-speech output for hands-free clinical consultation during rounds.
7. **HIPAA-Compliant Session Management**: All patient data is scoped to simulation purposes under signed data use agreements, with PII detection and blocking.

## Patients in Current System
### Active Patient Profiles
- **Aaliyah Washington**, 38 · Stage III TNBC · BRCA1+ · PD-L1 CPS 22 · Ki-67 75%
  Notes: Lymph node positive, hypertension comorbidity, highly aggressive phenotype. Strong immunotherapy signal.

- **Sarah Kim**, 45 · Stage II TNBC · BRCA2+ · PD-L1 CPS 8 · Ki-67 60%
  Notes: Node negative, no comorbidities. PARP inhibitor eligible. Moderate PD-L1 signal.

- **Emily Hartwell**, 52 · Stage II TNBC · BRCA wild-type · PD-L1 CPS 3 · Ki-67 45%
  Notes: Hypothyroidism. Limited immunotherapy signal. Capecitabine and standard chemotherapy primary options.

## Medical Staff
### Oncology Team
- **Dr. Maya Patel** — Lead Oncologist · Breast Cancer Specialist (MD, PhD, FACP)
  Affiliation: Memorial Cancer Center · TNBC Program
  Specialties: Triple-Negative Breast Cancer, Immunotherapy, BRCA Therapeutics
  NPI: 1234567890 · Email: mpatel@genesis-research.org

- **Dr. Anika Sharma** — Medical Oncologist · Genomic Medicine
  Specialties: BRCA mutation counseling, PARP inhibitor protocols, germline testing

- **Dr. James Okonkwo** — Surgical Oncologist
  Specialties: Breast-conserving surgery, sentinel node biopsy, post-neoadjuvant resection

- **Dr. Priya Nair** — Radiation Oncologist
  Specialties: Post-mastectomy radiation, regional nodal irradiation in TNBC

### Clinical Support
- **Nurse Rachel Torres** — Oncology Nurse Navigator · TNBC Program Coordinator
- **Nurse David Chen** — Chemotherapy Infusion Nurse · KEYNOTE-522 Protocol Specialist
- **Counselor Fatima Al-Rashid** — Oncology Social Worker · Psycho-oncology Support

### Administrative Staff
- **Alice Smith** — Program Office Manager
- **Tom Davis** — Patient Scheduling Coordinator
- **Lisa White** — Oncology Billing Specialist

## Leadership Team

- **Diya Kamboj** — CEO
  Profile: Diya has over 15 years of experience in healthcare technology and AI-driven clinical platforms. She is passionate about improving oncology outcomes through data-grounded simulation and has been instrumental in establishing Genesis as a trusted name in TNBC decision support. She leads the company's vision to make AI-assisted oncology accessible to every cancer center nationwide.

- **Renee Gupta** — CTO
  Profile: Renee brings deep expertise in health AI, large language model integration, and clinical data infrastructure. She leads the engineering and AI research teams at Genesis, ensuring the platform remains at the forefront of medical AI innovation — from RAG pipelines to real-time digital twin simulation engines.

- **Saachi Ashar** — COO
  Profile: Saachi oversees the day-to-day operations of Genesis, with a background in clinical operations management and healthcare delivery systems. She focuses on improving workflow efficiency, onboarding new clinical partners, and ensuring the platform meets real-world clinical team needs.

- **Tejasri Addanki** — CFO
  Profile: Tejasri oversees the financial health of Genesis. With expertise in healthcare AI finance and SaaS business models, she ensures that resources are allocated effectively to support the company's research mission and clinical expansion goals.

## Contact Information
- **Website**: www.genesis-twin.ai
- **Phone**: (206) 555-0194
- **Email**: support@genesis-twin.ai
- **Location**: 1 Cancer Research Blvd, Seattle, WA 98101
- **LinkedIn**: [Genesis LinkedIn](https://www.linkedin.com/company/genesis-twin)

## Working Hours
- **Monday to Friday**: 8:00 AM - 6:00 PM
- **Saturday**: 9:00 AM - 1:00 PM (on-call support only)
- **Sunday**: Closed (emergency API support available)

## Holidays
- New Year's Day
- Independence Day
- Thanksgiving Day
- Christmas Day

Timezone: Pacific Standard Time (PST)

Holidays:
- Follows Holidays of United States and India

## Mission Statement
At Genesis, our mission is to arm oncologists with the most accurate, evidence-grounded AI tools available for TNBC clinical decision support. We believe that every patient with triple-negative breast cancer deserves a clinician who has instant access to the latest trial data, personalized biomarker projections, and AI-synthesized research — at the point of care.

## Long-Term Goals
1. Establish Genesis as the leading TNBC digital twin and clinical AI platform in the United States by 2030, covering all NCI-designated cancer centers.
2. Develop deep integrations with Epic, Cerner, and major EHR systems for real-time patient data ingestion.
3. Expand the digital twin engine beyond TNBC to cover HER2+, luminal B, and other aggressive breast cancer subtypes.
4. Build a federated learning network across partner cancer centers to improve simulation model accuracy over time.

## Short-Term Goals
1. Complete RAG knowledge base ingestion across all major TNBC trial papers, NCCN guidelines, and ESMO recommendations by Q3 2025.
2. Launch voice-enabled consultation mode (ElevenLabs STT/TTS) for hands-free clinical use during patient rounds.
3. Onboard 5 pilot cancer centers for clinical validation studies of the Genesis digital twin engine.
4. Publish peer-reviewed validation of CA 15-3 trajectory simulation accuracy against real-world KEYNOTE-522 patient cohorts.

## Supported Clinical Interventions
| ID | Label | Anchoring Trial |
|---|---|---|
| pembrolizumab_chemo | Pembrolizumab + Chemotherapy | KEYNOTE-522 |
| parp_inhibitor | PARP Inhibitor (Olaparib) | OlympiAD |
| sacituzumab | Sacituzumab Govitecan (Trodelvy) | ASCENT |
| neoadjuvant_act | Neoadjuvant AC-T | Standard of Care |
| adjuvant_cape | Adjuvant Capecitabine | CREATE-X |

## AI Agent Architecture
Genesis uses a multi-agent supervisor architecture:
- **Supervisor (Genesis)**: Routes clinical questions to specialist agents via tool calls. Synthesizes results into unified clinical responses.
- **Research Agent**: Live literature search across PubMed, EuropePMC, ClinicalTrials.gov, and Semantic Scholar.
- **RAG Agent**: Searches the curated local TNBC knowledge base for guidelines and landmark trial summaries.
- **Twin Agent**: Interprets digital twin simulation outputs — biomarker trajectories, DFS projections, and risk context for the current patient.
- **Review Agent**: Fact-checks clinical claims against retrieved evidence.

## HIPAA & Compliance Policy
Genesis operates under strict HIPAA compliance. The platform:
- Detects and blocks any request containing Protected Health Information (PHI) including SSN, home address, insurance IDs, DOB, or medical record numbers.
- Restricts all AI outputs to clinical simulation, treatment analysis, and oncology research scope only.
- Scopes all patient data to simulation purposes under signed data use agreements.
- Logs all API interactions for audit trail compliance.

For data access requests, contact the **Genesis Compliance Officer** at compliance@genesis-twin.ai or submit a formal HIPAA data request through your institution's privacy office.
