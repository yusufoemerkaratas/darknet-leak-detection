# Pattern Test Dataset (Labeled)

This folder stores labeled test samples for pattern evaluation.

## Format

Each sample consists of two files with the same base name:

- `sample_001.txt` (raw text)
- `sample_001.yaml` (labels)

Example label file:

```
patterns:
  - email_password_colon
  - aws_api_key
  - database_dump
```

Only the `patterns` list is required.
