# Security Best Practices for Kiwi TCMS CI/CD Integration

## Credential Management

### 1. Never Commit Secrets

**❌ Don't do this:**
```bash
git add .env
git commit -m "Add credentials"
```

**✅ Do this:**
```bash
echo ".env" >> .gitignore
git rm --cached .env 2>/dev/null || true
git commit -m "Add .env to gitignore"
```

### 2. Use Dedicated Service Accounts

Create a dedicated API user in Kiwi TCMS with minimal permissions:
- Read access to Products and Test Plans
- Create/TestRun permissions only
- No admin or user management access

### 3. Rotate Credentials Regularly

**Recommended Schedule:**
- Development: Every 90 days
- Staging: Every 60 days
- Production: Every 30 days

**Automated Rotation Script:**
```bash
#!/bin/bash
# rotate-kiwi-creds.sh
NEW_PASSWORD=$(openssl rand -base64 32)
echo "KIWI_PASSWORD=$NEW_PASSWORD" > .env.new
mv .env.new .env
echo "Update Kiwi TCMS user password manually"
echo "Update CI/CD secrets with: $NEW_PASSWORD"
```

## CI/CD Security

### GitHub Actions

1. **Restrict Workflow Permissions:**
```yaml
permissions:
  contents: read
  pull-requests: write  # Only if using PR comments
```

2. **Use Environment Protection Rules:**
- Require manual approval for production uploads
- Separate secrets per environment (dev, staging, prod)

3. **Enable Secret Scanning:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### GitLab CI

1. **Mask CI/CD Variables:**
```yaml
variables:
  KIWI_URL: $KIWI_URL
  KIWI_USERNAME: $KIWI_USERNAME
  KIWI_PASSWORD: $KIWI_PASSWORD
```

2. **Use Protected Variables:**
- Mark variables as "Protected"
- Only accessible from protected branches (main, release/*)

3. **Environment-Specific Variables:**
- Separate variables for `staging` and `production` environments
- Use `only: [staging]` or `only: [production]` in job definitions

## API Security

### 1. Use HTTPS Always
```bash
# ❌ Insecure
KIWI_URL=http://kiwi-tcms.internal

# ✅ Secure
KIWI_URL=https://kiwi-tcms.example.com
```

### 2. Implement Rate Limiting
Configure the upload script to respect API limits:
```typescript
const MAX_REQUESTS_PER_MINUTE = 60;
const DELAY_MS = (60 * 1000) / MAX_REQUESTS_PER_MINUTE;
```

### 3. Validate SSL Certificates
Never disable SSL verification:
```bash
# ❌ Never do this
NODE_TLS_REJECT_UNAUTHORIZED=0 npx ts-node scripts/kiwi-upload.ts

# ✅ Use proper certificates
npx ts-node scripts/kiwi-upload.ts --validate-cert
```

## Data Protection

### 1. Sanitize Test Results
Remove sensitive data before upload:
```typescript
function sanitizeResults(results: any[]): any[] {
  return results.map(r => ({
    ...r,
    output: r.output.replace(/password:.*?@/g, 'password:***@'),
    output: r.output.replace(/Bearer [^\s]+/g, 'Bearer ***')
  }));
}
```

### 2. Encrypt at Rest
- Use encrypted secrets in CI/CD
- Consider encryption for test results stored in Kiwi TCMS

### 3. Access Logs
- Enable audit logging in Kiwi TCMS
- Monitor for unusual upload patterns
- Set up alerts for failed authentication attempts

## Network Security

### 1. Use VPNs for Private Instances
If Kiwi TCMS is on a private network:
```yaml
# GitHub Actions with VPN
- name: Connect to VPN
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.VPN_HOST }}
    username: ${{ secrets.VPN_USER }}
    key: ${{ secrets.VPN_KEY }}
```

### 2. IP Whitelisting
Restrict API access by IP:
```bash
# Kiwi TCMS Admin Settings
# Allowed IPs: GitHub Actions IP ranges, GitLab CI IP ranges
# See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses
```

## Monitoring and Alerts

### 1. Security Events to Monitor
- Failed authentication attempts (> 5 in 1 hour)
- Uploads from unknown IPs
- Unusual test failure patterns
- Large data transfers (> 10MB)

### 2. Alert Configuration
```yaml
# Example: PagerDuty integration
- name: Alert on upload failure
  if: failure()
  uses: peter-evans/pagerduty-actions@v2
  with:
    integration-key: ${{ secrets.PAGERDUTY_KEY }}
    dedup-key: kiwi-upload-failure
    event-action: trigger
```

## Compliance

### 1. GDPR Considerations
- Minimize personal data in test results
- Provide data deletion procedures
- Document data processing activities

### 2. SOC 2 / ISO 27001
- Maintain access control policies
- Regular security audits
- Penetration testing of upload endpoints

## Checklist

- [ ] `.env` in `.gitignore`
- [ ] Dedicated service account created
- [ ] Credentials rotated (last 30 days)
- [ ] HTTPS enforced
- [ ] SSL certificate validation enabled
- [ ] Rate limiting configured
- [ ] CI/CD secrets masked
- [ ] Protected variables enabled
- [ ] Audit logging enabled
- [ ] Security alerts configured
- [ ] VPN configured (if needed)
- [ ] IP whitelisting configured
- [ ] Test result sanitization implemented
- [ ] Compliance documentation updated

## Emergency Procedures

### Credential Compromise
1. Revoke compromised API key immediately
2. Rotate all related credentials
3. Review access logs for data exfiltration
4. Notify security team
5. Document incident

### Security Incident
1. Disable affected CI/CD workflows
2. Change Kiwi TCMS admin passwords
3. Rotate all service account credentials
4. Conduct post-incident review
5. Update security procedures

## Resources

- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops/)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [GitLab CI/CD Security](https://docs.gitlab.com/ee/ci/variables/)
- [Kiwi TCMS Security](https://kiwitcms.readthedocs.io/en/latest/administration.html#security)
