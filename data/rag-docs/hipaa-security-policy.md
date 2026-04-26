# Helix Digital Twin — HIPAA & Data Security Policy

## Overview

The Helix Digital Twin platform processes Protected Health Information (PHI) under the Health Insurance Portability and Accountability Act (HIPAA) and the HITECH Act. This document defines data handling policies, access controls, and security requirements for all users, agents, and integrations.

---

## What Constitutes PHI in Helix

The following categories of patient data are classified as PHI and governed by HIPAA:

### Direct Identifiers (must never be exposed via AI or APIs without authorization)
- Full name (when combined with clinical data)
- Geographic data smaller than state (address, ZIP+4, GPS coordinates)
- Dates directly related to the individual (DOB, admission date, death date)
- Phone numbers (home, cell, work)
- Fax numbers
- Email addresses
- Social Security Numbers (SSN)
- Medical record numbers (MRN)
- Health plan beneficiary numbers
- Account numbers (financial, insurance)
- Certificate/license numbers
- VIN and serial numbers
- Device identifiers
- IP addresses
- Biometric identifiers (fingerprints, retinal scans, voiceprints)
- Full-face photographs
- Any unique identifying number or code

### Clinical Data Requiring Protection
- Diagnosis codes (ICD-10)
- Procedure codes (CPT)
- Prescription information
- Lab results beyond those authorized for simulation
- Genomic/genetic information
- Mental health records
- Substance use disorder records

---

## What Helix AI Agents Are Authorized to Process

Helix agents operate under a limited authorization scope:

### AUTHORIZED:
- Oncology staging data (stage, grade, histology)
- Biomarker values (BRCA status, PD-L1 CPS, Ki-67%, CA 15-3)
- Tumor characteristics (size, lymph node status)
- Treatment history (drug names, regimens — not specific pharmacy records)
- Simulation outputs (digital twin projections — derived, not original records)
- Published trial data (population-level, de-identified)
- Comorbidities when relevant to oncology treatment decision support

### NEVER AUTHORIZED FOR AI PROCESSING:
- SSN, DOB, home address, phone number, personal email
- Insurance IDs, member numbers
- Financial information
- Mental health or substance use records
- Raw EHR exports or unstructured full medical records
- Any bulk patient data extraction

---

## Security Policy Rules for AI Agents

### Rule 1: PHI Query Refusal
If a user query requests any Direct Identifier listed above, the AI agent must:
1. Refuse to answer
2. Return a security warning message (HIPAA/PHI Policy Blocked)
3. Log the query attempt (without storing the query text)
4. Not call external APIs with the PHI-containing query

### Rule 2: Off-Scope Query Refusal
Helix agents may only respond to queries about:
- TNBC oncology
- Treatment options for the loaded patient
- Simulation outcomes and biomarker trajectories
- Published clinical trial evidence

Any query outside this scope returns a standardized off-topic response.

### Rule 3: No PHI in Outbound API Calls
External API calls (PubMed, EuropePMC, ClinicalTrials, ElevenLabs) must never include:
- Patient name, age, or any direct identifier
- Queries that combine multiple identifiers
- Raw patient record content

Clinical queries to external APIs must use only clinical terms (disease name, drug name, biomarker — no patient identifiers).

### Rule 4: Audit Logging
All interactions must be logged with:
- Session ID (not patient name)
- Query type (oncology, off-topic, security-blocked)
- Timestamp
- Model used
- Security block triggered: yes/no

Logs must NOT contain the actual user query text if it contained PHI.

### Rule 5: Data Retention
- Chat messages: Session-scoped only (cleared on session end)
- Simulation results: Retained only with explicit user save action
- RAG ingestion: Only de-identified or publicly available documents (trial papers, guidelines)
- No patient records to be ingested into RAG without BAA and de-identification

---

## HIPAA Minimum Necessary Standard

Helix enforces the HIPAA Minimum Necessary standard:
- AI agents receive only the clinical data required for the specific simulation task
- No agent receives the full patient record
- Each API route receives only the fields required for that operation

## Business Associate Agreement (BAA)

- Helix operators must have a signed BAA with:
  - Their cloud provider (Microsoft Azure / AWS / GCP)
  - ElevenLabs (if processing voice data containing PHI)
  - Any analytics provider receiving usage data
- Twilio: BAA required if patient names or health information appear in call transcripts

---

## Incident Response

If a potential PHI exposure is detected:
1. Immediately restrict access to the affected session
2. Notify the institution's Privacy Officer within 24 hours
3. Document: what data, who accessed, when, how many patients affected
4. HIPAA Breach Notification Rule: notify affected patients within 60 days if breach is confirmed
5. HHS OCR notification: required for breaches affecting ≥500 individuals

---

## Contact

- **Compliance Officer:** [Institution-specific]
- **Data Protection Officer:** [Institution-specific]
- **HHS OCR (US):** hhs.gov/hipaa
- **Helix Security:** Submit via your institution's IT security portal
