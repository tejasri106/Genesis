// Security policy enforcement for HIPAA/PII and content scope

export const SECURITY_PREFIX = '[GENESIS-SECURITY]';
export const OFF_TOPIC_PREFIX = '[GENESIS-OFF-TOPIC]';

const PII_TRIGGERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(ssn|social\s?security\s?number?|tax\s?id)\b/i, label: 'SSN or Tax ID' },
  { pattern: /\b(home\s?address|mailing\s?address|street\s?address|zip\s?code|postal\s?code|physical\s?address)\b/i, label: 'Home Address' },
  { pattern: /\b(personal\s?phone|home\s?phone|cell\s?(phone|number)|mobile\s?number)\b/i, label: 'Personal Phone Number' },
  { pattern: /\b(personal\s?email|email\s?address|email\s?id)\b/i, label: 'Email Address' },
  { pattern: /\b(insurance\s?id|member\s?id|policy\s?number|subscriber\s?id|insurance\s?number)\b/i, label: 'Insurance Identifier' },
  { pattern: /\b(date\s?of\s?birth|dob|birth\s?date|birthday)\b/i, label: 'Date of Birth' },
  { pattern: /\bpassword\b/i, label: 'Password' },
  { pattern: /\b(credit\s?card|debit\s?card|card\s?number|cvv|billing)\b/i, label: 'Payment Information' },
  { pattern: /\b(export|download|dump|extract|share)\s+(patient|phi|pii|records?|data)\b/i, label: 'PHI Export Request' },
  { pattern: /\b(give|show|list|get)\s+(me\s+)?(all\s+)?(patient|user|personal)\s+(record|data|info)/i, label: 'Bulk Patient Data' },
  { pattern: /\b(medical\s?record\s?number|mrn|patient\s?id\s?number)\b/i, label: 'Medical Record Number' },
  { pattern: /\bsocial\s?security\b/i, label: 'Social Security Information' },
];

/**
 * Returns the PII label if found in text, null otherwise.
 */
export function detectPII(text: string): string | null {
  for (const { pattern, label } of PII_TRIGGERS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function buildSecurityWarning(piiLabel: string): string {
  return `${SECURITY_PREFIX} **HIPAA / PHI Policy Violation Blocked**

Your request appears to ask for **${piiLabel}**, which is classified as Protected Health Information (PHI) under HIPAA regulations.

**This system is not authorized to share, expose, or transmit:**
- Social Security Numbers or Tax IDs
- Home addresses, phone numbers, or personal emails
- Insurance or member IDs
- Dates of birth or medical record numbers
- Any other patient-identifiable information

**Genesis is authorized for:** clinical simulation, treatment outcome analysis, and oncology research only. Patient data visible in this session is scoped to simulation purposes under a signed data use agreement.

For data access requests, contact your **Compliance Officer** or submit a formal **HIPAA data request** through your institution's privacy office.`;
}

export function buildOffTopicWarning(patientName: string): string {
  return `${OFF_TOPIC_PREFIX} I'm focused on TNBC oncology for **${patientName}**. Please ask me about treatment options, biomarker trajectories, intervention scenarios, or simulation outcomes. I can't help with unrelated topics.`;
}
