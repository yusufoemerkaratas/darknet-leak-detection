# Synthetic Quality Assessment Dataset

This folder contains fake, non-sensitive documents for exercising the Sprint 2
quality assessment workflow when real collector output is not available.

The files are intentionally marked with:

```json
"synthetic": true
```

Use this dataset only for demo and pipeline validation:

```bash
python analysis/evaluation/run_quality_assessment.py --demo --write
```

Do not present these results as real-world quality metrics. Final calibration
still requires at least 200 real parsed collector documents.
