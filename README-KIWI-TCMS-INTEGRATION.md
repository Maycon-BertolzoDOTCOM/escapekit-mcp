# Kiwi TCMS CI/CD Integration

[![Kiwi TCMS](https://img.shields.io/badge/Kiwi%20TCMS-Integrated-green)](https://kiwitcms.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Configured-blue)](https://github.com/features/actions)
[![GitLab CI](https://img.shields.io/badge/GitLab%20CI-Configured-orange)](https://about.gitlab.com/stages-devops-lifecycle/continuous-integration)
[![Railway](https://img.shields.io/badge/Railway-Ready-purple)](https://railway.app/)

## 🚀 Quick Start (5 minutes)

Configure automated test result uploads to Kiwi TCMS in just 5 minutes:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit with your Kiwi TCMS credentials
# KIWI_URL=https://your-kiwi-tcms.com
# KIWI_USERNAME=your-api-user
# KIWI_PASSWORD=your-api-password

# 3. Test locally with dry-run
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run
```

## ✨ Features

- **Multi-Platform Support**: GitHub Actions, GitLab CI, Local execution
- **Multi-Framework**: Vitest, Mocha, and custom JSON formats
- **Reliable Uploads**: Automatic retry with exponential backoff (3 attempts)
- **Validation Mode**: Dry-run to test before uploading
- **Batch Processing**: Optimized for large test suites
- **Security-First**: Environment variable validation, HTTPS enforcement
- **Railway Ready**: Pre-configured for Railway deployments
- **Comprehensive Docs**: Quick start, security best practices, troubleshooting

## 📖 Documentation

### Getting Started
- **[Quick Start Guide](docs/ci-cd-quickstart.md)** - Get up and running in 5 minutes
- **[Integration Guide](docs/ci-cd.md)** - Detailed setup instructions
- **[Railway Integration](docs/railway-integration.md)** - Deploy to Railway

### Advanced Topics
- **[Security Best Practices](docs/security-best-practices.md)** - Protect your credentials
- **Troubleshooting** - Common issues and solutions

## 🔧 Configuration

### Environment Variables

Required:
```bash
KIWI_URL=https://your-kiwi-tcms-instance.com
KIWI_USERNAME=your-api-username
KIWI_PASSWORD=your-api-password
```

Optional:
```bash
KIWI_PRODUCT_ID=123          # Product ID in Kiwi TCMS
KIWI_TEST_PLAN_ID=456       # Test Plan ID in Kiwi TCMS
```

## 🛠️ Usage

### Local Execution

```bash
# Validate configuration
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run

# Upload test results
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --verbose
```

### GitHub Actions

Configure secrets in repository settings:
- `KIWI_URL`
- `KIWI_USERNAME`
- `KIWI_PASSWORD`
- `KIWI_PRODUCT_ID` (optional)
- `KIWI_TEST_PLAN_ID` (optional)

The workflow (`.github/workflows/kiwi-tcms.yml`) automatically:
1. Runs your tests
2. Uploads results to Kiwi TCMS
3. Stores test artifacts

### GitLab CI

Configure CI/CD variables in project settings:
- `KIWI_URL`
- `KIWI_USERNAME`
- `KIWI_PASSWORD`
- `KIWI_PRODUCT_ID` (optional)
- `KIWI_TEST_PLAN_ID` (optional)

The pipeline (`.gitlab-ci.yml`) includes:
- Test job with artifact generation
- Upload job to Kiwi TCMS
- Report job for test summaries

### Railway Deployment

Deploy to Railway with automatic test result uploads:

```bash
# Deploy and upload test results
./scripts/deploy-to-railway.sh
```

See [Railway Integration Guide](docs/railway-integration.md) for details.

## 📊 Supported Test Frameworks

| Framework | Format | Example Command |
|-----------|---------|----------------|
| Vitest | JSON | `--framework vitest` |
| Mocha | XML/xunit | `--framework mocha` |
| Custom | JSON | `--framework custom` |

## 🔒 Security

- ✅ Never commit credentials (use `.env` and `.gitignore`)
- ✅ Use dedicated service accounts with minimal permissions
- ✅ Rotate credentials regularly (Dev: 90d, Staging: 60d, Prod: 30d)
- ✅ Enforce HTTPS and SSL certificate validation
- ✅ Implement rate limiting
- ✅ Sanitize test results before upload

See [Security Best Practices](docs/security-best-practices.md) for detailed guidelines.

## 📈 Monitoring

After setup, view test results in Kiwi TCMS:
1. Navigate to your Product → Test Plan
2. View Test Runs with detailed results
3. Track trends over time with dashboards

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication failed | Verify `KIWI_URL`, `KIWI_USERNAME`, `KIWI_PASSWORD` |
| File not found | Ensure test results path is correct |
| Framework error | Verify `--framework` matches your test runner |
| Upload timeout | Check network connectivity and Kiwi TCMS availability |

For more help, see [Integration Guide - Troubleshooting](docs/ci-cd.md#troubleshooting).

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This integration is provided as-is for use with Kiwi TCMS and your projects.

## 🔗 Resources

- [Kiwi TCMS Documentation](https://kiwitcms.readthedocs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [Railway Documentation](https://docs.railway.app/)

## ?? Support

For issues and questions:
1. Check the [Troubleshooting Guide](docs/ci-cd.md#troubleshooting)
2. Review [Security Best Practices](docs/security-best-practices.md)
3. Open an issue in the repository

---

**Status**: ✅ Production Ready (with manual verification)

**Last Updated**: March 16, 2025
