# EscapeKit GitHub Action

This action runs EscapeKit analysis and validation in your CI/CD pipeline.

## Usage

```yaml
steps:
  - uses: escapekit/escapekit-action@v1
    with:
      config-path: './path/to/config.json'
```

## Inputs

| Parameter     | Description                          | Required | Default                     |
|--------------|--------------------------------------|----------|----------------------------|
| `config-path` | Path to EscapeKit configuration file | ❌ No    | `./escapekit.config.json` |