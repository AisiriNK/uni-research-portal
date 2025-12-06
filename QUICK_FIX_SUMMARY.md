# QUICK FIX SUMMARY - What to Replace and Where

## 🔴 CRITICAL FIXES (Do These First)

### 1. REFERENCES SECTION - Remove Duplicates

**Delete these entire reference entries:**
- **[6]** - Duplicate of [3] (both cite "Structuring the Output of Large Language Models")
- **[8]** - Duplicate of [4] (both cite "Elastic & Learnable Low-Rank Adaptation")
- **[9]** - Duplicate of [3] (same as [6])
- **[10]** - Duplicate of [1] (both cite LoRA paper by Hu et al.)

**After deletion, renumber remaining references sequentially.**

**Also fix:**
- Change all **2025** dates to **2023** or **2024** (verify actual publication years)
- Fix **[7]** - Add missing author names

---

### 2. LITERATURE REVIEW - Remove Duplicate Paragraph

**Find this paragraph (appears after reference [5]):**
```
When the downstream task involves strict adherence to external standards or a context that is remote, more recent fine-tuning systems with addition of model training over retrieved papers or references show benefits. Retrieval-augmented fine-tuning can eliminate hallucinations for required structure and bring context todocument conversion tasks, where format templates and examples play a critical role [6].
```

**Action:** DELETE this entire paragraph (it's a duplicate of the previous paragraph about [5])

---

### 3. FIX MODEL NAME INCONSISTENCY

**Find:**
```
Qwen 17B model
```

**Replace with:**
```
Qwen 1.7B model
```

**Location:** Literature Review section, near the end before "III. PROPOSED METHODOLOGY"

---

### 4. FIX TYPOS

**Find:** `formatedTypst`  
**Replace with:** `formatted Typst`

**Find:** `LLMsTypstasizes`  
**Replace with:** `LLMs emphasizes`

---

## 🟡 IMPORTANT FIXES (Do These Next)

### 5. ADD QUANTITATIVE COMPARISONS

**Location:** Add new subsection in Section V (Results) before "B. Digital No-Due Workflow"

**Add either:**
- **Option A:** Actual comparison results (if you have them) comparing Qwen vs GPT vs LLaMA, and LoRA vs full fine-tuning
- **Option B:** Acknowledgment of limitation: "While comprehensive baseline comparisons were not conducted due to resource constraints, future work will include..."

---

### 6. ADD STATISTICAL MEASURES

**Location:** Section V.A, expand the metrics section

**Current text:**
```
94% of the chapters compiled successfully...
96% average was achieved...
97% average result was...
```

**Add:**
- Sample sizes (e.g., "141 out of 150 chapters")
- Standard deviations
- Discussion of failure cases (what caused the 6% failures?)

---

### 7. CREATE MISSING FIGURES

You need to create and insert 4 figures:

1. **Figure 1** - Flow diagram (Section III.A)
2. **Figure 2** - System Architecture (Section IV.A)  
3. **Figure 3** - Report generation example (Section V.A)
4. **Figure 4** - Approval dashboard (Section V.B)

---

## 🟢 RECOMMENDED IMPROVEMENTS

### 8. EXPAND TECHNICAL DETAILS

**Location:** Section IV.B - Add specific LoRA hyperparameters:
- Rank r=8 (and mention you tested r=4, 8, 16, 32)
- Alpha scaling factor value
- Why these values were chosen

**Location:** Section IV.C - Expand dataset description:
- Breakdown by discipline
- Average chapter length
- Token statistics

---

### 9. FIX KEYWORDS

**Find:**
```
Key words: Digital Clearing, Report Generation, Academic Process Digitization, Automation of Documents, Typst Formatting, LORA Fine-Tuning, And Large Language Models.
```

**Replace with:**
```
Keywords: Digital Clearing, Report Generation, Academic Process Digitization, Document Automation, Typst Formatting, LoRA Fine-Tuning, Large Language Models.
```

(Remove "And", fix "LORA" to "LoRA", fix "Key words" to "Keywords")

---

### 10. FIX TENSE CONSISTENCY

**Find:** `The teachers can reduce...`  
**Replace with:** `The teachers were able to reduce...` (or `reduced`)

Review entire paper for consistent past tense in results section.

---

## 📋 CHECKLIST

### Critical (Must Fix):
- [ ] Delete duplicate references [6], [8], [9], [10]
- [ ] Fix all 2025 dates
- [ ] Remove duplicate paragraph in Literature Review
- [ ] Fix "Qwen 17B" → "Qwen 1.7B"
- [ ] Fix "formatedTypst" → "formatted Typst"
- [ ] Fix "LLMsTypstasizes" → "LLMs emphasizes"

### Important (Should Fix):
- [ ] Add quantitative comparisons or limitation acknowledgment
- [ ] Add statistical measures (SD, sample sizes)
- [ ] Create and insert all 4 figures

### Recommended (Improves Quality):
- [ ] Expand hyperparameter details
- [ ] Expand dataset description
- [ ] Fix keywords formatting
- [ ] Fix tense consistency

---

## 📍 WHERE TO FIND THINGS

**References Section:** End of paper, after "VIII. FUTURE WORK"

**Literature Review:** Section II, look for paragraph about retrieval-augmented fine-tuning (appears twice)

**Model Name:** Literature Review, near end, before "III. PROPOSED METHODOLOGY"

**Typos:** 
- "formatedTypst" - Introduction section
- "LLMsTypstasizes" - Literature Review, around reference [8]

**Results Section:** Section V, subsections A, B, C

**Keywords:** Beginning of paper, after abstract
