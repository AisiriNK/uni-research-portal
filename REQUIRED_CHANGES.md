# REQUIRED CHANGES TO THE PAPER

## 1. REFERENCES SECTION - CRITICAL FIXES

### Duplicate References to Remove/Consolidate:

**Location: REFERENCES section at end of paper**

#### Issue 1: References [3], [6], and [9] are IDENTICAL
- **Current:** All three cite "Structuring the Output of Large Language Models D. Y. B. Wang et al., arXiv preprint arXiv:2505.04016, 2025"
- **Action:** Keep only ONE reference (e.g., [3]), remove [6] and [9], and renumber subsequent references

#### Issue 2: References [4] and [8] are DUPLICATES
- **Current:** Both cite "Elastic & Learnable Low-Rank Adaptation for Efficient Fine-Tuning H. Chang et al., arXiv preprint arXiv:2504.00254, 2025"
- **Action:** Keep only ONE reference (e.g., [4]), remove [8], and renumber subsequent references

#### Issue 3: References [1] and [10] are DUPLICATES
- **Current:** 
  - [1]: "Efficient Fine-Tuning of Large Language Models E. J. Hu et al., arXiv preprint arXiv:2106.09685, 2021"
  - [10]: "Low-Rank Adaptation for Efficient Fine-Tuning E. J. Hu et al., arXiv preprint arXiv:2106.09685, 2021"
- **Action:** These are the same paper (LoRA paper). Keep [1], remove [10], and renumber

#### Issue 4: Reference [7] has INCOMPLETE citation
- **Current:** "Generating Structured Outputs from Language Models arXiv preprint arXiv:2501.10868, 2025. DOI: 10.48550/arXiv.2501.10868."
- **Action:** Add missing author names and proper formatting

#### Issue 5: All 2025 dates are UNREALISTIC
- **Action:** Replace 2025 with realistic years (2023, 2024, or earlier). Verify actual publication dates.

---

## 2. LITERATURE REVIEW SECTION - REPETITIVE CONTENT

### Location: Section II. LITERATURE SURVEY

#### Issue 1: Duplicate Paragraph about Retrieval-Augmented Fine-Tuning
**First occurrence (around reference [5]):**
```
"When the downstream task involves strict adherence to external standards or long-range context, 
fine-tuning methods that extend the model training with recovered documents or anchors are 
beneficial. Fine-tuning with retrieval augmentation could avoid hallucination about necessary 
structure and add context for document conversion tasks, where format templates and example 
are relevant [5]."
```

**Second occurrence (around reference [6]):**
```
"When the downstream task involves strict adherence to external standards or a context that is 
remote, more recent fine-tuning systems with addition of model training over retrieved papers 
or references show benefits. Retrieval-augmented fine-tuning can eliminate hallucinations for 
required structure and bring context to document conversion tasks, where format templates and 
examples play a critical role [6]."
```

**Action:** Remove the SECOND paragraph (around [6]) completely. Keep only the first one.

---

## 3. INCONSISTENT MODEL NAMING

### Location: Multiple sections

#### Issue: "Qwen 17B" vs "Qwen 1.7B"
**Location 1:** Literature Review section (near end, before "III. PROPOSED METHODOLOGY")
- **Current text:** "While these results are promising, UniFlow uses a fine-tuned Qwen 17B model together with locally developed Typst..."
- **Action:** Change "Qwen 17B" to "Qwen 1.7B" (to match rest of paper)

**All other locations correctly use "Qwen 1.7B"** - verify consistency throughout.

---

## 4. TYPOS AND FORMATTING ERRORS

### Location: Introduction section

#### Issue 1: "formatedTypst" (missing space and typo)
**Location:** Introduction paragraph
- **Current:** "...automatically converting raw text into documents to fully formatedTypst code..."
- **Action:** Change to "fully formatted Typst code"

#### Issue 2: "Typstasizes" (typo)
**Location:** Literature Review section (around reference [8])
- **Current:** "Most of the research done on the reliability of structured outputs from LLMsTypstasizes that..."
- **Action:** Change "LLMsTypstasizes" to "LLMs emphasizes" or "LLMs highlights"

---

## 5. MISSING CONTENT - QUANTITATIVE COMPARISONS

### Location: Section V. RESULTS AND DISCUSSION

#### Issue: No baseline comparisons mentioned
**Action:** Add a new subsection (e.g., "C. Baseline Comparison" or expand existing section) that includes:

1. **Comparison with other LLMs:**
   - Add table or text comparing Qwen 1.7B vs GPT-3.5/4 vs LLaMA on same task
   - Include metrics: Compilation Success Rate, Formatting Compliance, Content Preservation

2. **Ablation Study:**
   - Add comparison: With LoRA vs Without LoRA (full fine-tuning)
   - Show impact of LoRA on performance metrics

3. **Hyperparameter Analysis:**
   - Discuss impact of different LoRA ranks (r values tested)
   - Impact of learning rate variations
   - Training epochs and convergence

**If experiments weren't conducted:**
- Add a subsection acknowledging this limitation
- Provide qualitative justification for choosing Qwen 1.7B with LoRA
- Note this as future work

---

## 6. MISSING FIGURES

### Location: Multiple sections reference figures that don't exist

#### Figure 1: Flow of the system
**Location:** Section III.A "Flow of the System"
- **Current:** "Figure 1 : Flow of the system" (mentioned but no figure)
- **Action:** Create and insert flowchart showing: Upload → Segmentation → LLM Formatting → Compilation → PDF Generation → Metadata Extraction → Approval Workflow

#### Figure 2: System Architecture
**Location:** Section IV.A "System Architecture"
- **Current:** "Figure 2 : System Architecture" (mentioned but no figure)
- **Action:** Create and insert architecture diagram showing: Frontend (React) → Backend (Python) → Qwen LLM → Typst Compiler → Gemini API → Database (Firestore)

#### Figure 3: Report generation for various.doc inputs
**Location:** Section V.A "Automated Report Generation"
- **Current:** "Figure 3: Report generation for various.doc inputs of varying content" (mentioned but no figure)
- **Action:** Create and insert screenshot or example showing input .doc and output PDF side-by-side

#### Figure 4: No-due Approval Dashboard
**Location:** Section V.B "Digital No-Due Workflow"
- **Current:** "Figure 4: No-due Approval Dashboard" (mentioned but no figure)
- **Action:** Create and insert screenshot of the approval dashboard interface

**All figures need:**
- Proper IEEE formatting
- Clear captions
- Proper referencing in text

---

## 7. TENSE CONSISTENCY ISSUES

### Location: Throughout paper

#### Issue: Mix of present and past tense
**Examples to fix:**

1. **Introduction section:**
   - "This paper presents..." (present - OK for introduction)
   - But later: "The solution employs..." (present - should be "employed" if describing completed work)

2. **Methodology section:**
   - "The module segments..." (present - should be "segments" for system description, but be consistent)

3. **Results section:**
   - "Students provided..." (past - correct)
   - "The system uniformly formatted..." (past - correct)
   - But: "The teachers can reduce..." (present - should be "reduced" or "were able to reduce")

**Action:** 
- Use **past tense** for completed experiments and results
- Use **present tense** for general statements, system descriptions, and conclusions
- Review entire paper for consistency

---

## 8. REPETITIVE PHRASING

### Location: Multiple sections

#### Issue 1: Similar sentences about "formatting and approval"
**Action:** Consolidate and vary language

#### Issue 2: Repeated mention of "94% compilation success, 96% formatting compliance, 97% content preservation"
**Action:** Present once in detail, reference briefly elsewhere

---

## 9. TECHNICAL DEPTH ENHANCEMENTS

### Location: Section IV.B "Fine-Tuned Qwen Model with LoRA"

#### Issue: Limited hyperparameter details
**Current mentions:**
- Learning rate: 2 × 10^-4
- Rank r: mentioned but no specific values tested
- Alpha scaling factor: mentioned but not specified

**Action:** Add:
- Specific rank r values tested (e.g., r=8, r=16, r=32)
- Alpha values used
- Training epochs
- Batch size
- Why these values were chosen

### Location: Section IV.C "Dataset and Training"

#### Issue: Limited dataset details
**Current:** "120 to 150 carefully selected, excellent academic chapters"

**Action:** Add:
- Breakdown by domain/discipline
- Average chapter length (word count or pages)
- Token count statistics
- Data augmentation specifics

---

## 10. RESULTS SECTION ENHANCEMENTS

### Location: Section V.A "Automated Report Generation"

#### Issue: Missing statistical measures
**Current:** Only percentages given

**Action:** Add:
- Standard deviations for each metric
- Number of test samples
- Confidence intervals (if applicable)
- Discussion of failure cases (6% compilation failures, 4% formatting failures)

### Location: Section V.C "Efficiency Comparison"

#### Issue: Table formatting
**Current:** Table 1 exists but could be clearer

**Action:** Ensure proper IEEE table formatting with:
- Clear column headers
- Proper alignment
- Units specified
- Caption above table

---

## 11. ABSTRACT AND KEYWORDS

### Location: Beginning of paper

#### Issue: Keywords formatting
**Current:** "Key words: Digital Clearing, Report Generation, Academic Process Digitization, Automation of Documents, Typst Formatting, LORA Fine-Tuning, And Large Language Models."

**Action:** 
- Fix capitalization: "LoRA" not "LORA"
- Remove "And" (should be lowercase "and" or removed)
- Ensure IEEE keyword formatting

---

## SUMMARY CHECKLIST

### Critical (Must Fix):
- [ ] Remove duplicate references [3]/[6]/[9], [4]/[8], [1]/[10]
- [ ] Fix all 2025 dates to realistic years
- [ ] Remove duplicate paragraph in Literature Review
- [ ] Fix "Qwen 17B" → "Qwen 1.7B"
- [ ] Fix "formatedTypst" → "formatted Typst"
- [ ] Fix "LLMsTypstasizes" → "LLMs emphasizes"

### Important (Should Fix):
- [ ] Add quantitative comparisons section
- [ ] Create and insert all 4 missing figures
- [ ] Fix tense consistency throughout
- [ ] Add statistical measures to results

### Recommended (Improves Quality):
- [ ] Expand hyperparameter details
- [ ] Add dataset statistics
- [ ] Enhance error analysis
- [ ] Improve keyword formatting
