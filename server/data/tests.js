// Diagnostic tests a doctor commonly orders for each condition (educational, not exhaustive).
module.exports = {
  'common-cold': ['Usually clinical diagnosis — no tests needed', 'Throat swab only if strep throat is suspected'],
  influenza: ['Rapid influenza antigen test', 'RT-PCR for influenza'],
  'covid-19': ['RT-PCR or rapid antigen test', 'Pulse oximetry (SpO₂)', 'Chest X-ray if breathless'],
  dengue: ['NS1 antigen (days 1–5)', 'Dengue IgM/IgG antibodies', 'Complete blood count with platelet count'],
  malaria: ['Peripheral blood smear', 'Rapid diagnostic test (RDT)', 'Complete blood count'],
  typhoid: ['Blood culture (best in first week)', 'Typhidot / Widal test', 'Complete blood count'],
  gastroenteritis: ['Stool examination and culture if severe', 'Serum electrolytes if dehydrated'],
  migraine: ['Clinical diagnosis', 'MRI/CT only if red-flag features are present'],
  hypertension: ['Repeated blood pressure readings / 24-hour monitoring', 'ECG', 'Kidney function, lipid profile, blood sugar'],
  'type-2-diabetes': ['Fasting blood glucose', 'HbA1c', 'Post-meal (OGTT) glucose', 'Urine ketones if unwell'],
  asthma: ['Spirometry / peak flow', 'Chest X-ray', 'Allergy testing'],
  pneumonia: ['Chest X-ray', 'Complete blood count and CRP', 'Sputum culture', 'Pulse oximetry'],
  uti: ['Urine routine and microscopy', 'Urine culture and sensitivity'],
  'allergic-rhinitis': ['Skin-prick allergy test', 'Serum IgE'],
  anemia: ['Complete blood count', 'Serum ferritin and iron studies', 'Vitamin B12 and folate levels'],
  hepatitis: ['Liver function tests (bilirubin, ALT, AST)', 'Hepatitis A/B/C serology', 'Abdominal ultrasound'],
};
