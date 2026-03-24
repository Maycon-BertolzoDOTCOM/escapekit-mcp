# Polyfill Injector Enhancement Tasks

- [x] 1. Implement BundlerType and detectBundler method
    - 1.1: Define BundlerType type at top of file
    - 1.2: Implement detectBundler method with Promise.all checks
    - 1.3: Add helper methods hasFile and hasDirectory
    - 1.4: Test detection priority (nextjs > vite > webpack)

- [x] 2. Implement Vite integration
    - 2.1: Create integrateVite method
    - 2.2: Check multiple entry points
    - 2.3: Prevent duplicate imports
    - 2.4: Handle missing entry points

- [x] 3. Implement Webpack integration
    - 3.1: Create integrateWebpack method
    - 3.2: Handle both .js and .ts config files
    - 3.3: Transform string and array entry points
    - 3.4: Throw descriptive error for missing config

- [x] 4. Implement Next.js integration
    - 4.1: Create integrateNextjs method
    - 4.2: Handle Pages Router (_app.tsx)
    - 4.3: Handle App Router (layout.tsx)
    - 4.4: Support co-existing routers
    - 4.5: Create minimal components when missing

- [x] 5. Integrate with existing fix method
    - 5.1: Call detectBundler after current steps
    - 5.2: Add integrateWithBundler dispatcher
    - 5.3: Handle unknown bundler case
    - 5.4: Wrap integrations in try/catch
    - 5.5: Preserve existing early returns

- [x] 6. Create unit tests
    - 6.1: Setup test file with fs mocks
    - 6.2: Test bundler detection scenarios
    - 6.3: Test Vite integration cases
    - 6.4: Test Webpack integration cases
    - 6.5: Test Next.js integration cases
    - 6.6: Test unknown bundler handling
    - 6.7: Verify existing behavior preservation
    - 6.8: Test idempotency

- [x] 7. Verify and fix type errors
    - 7.1: Run type checker on PolyfillInjector
    - 7.2: Fix any new type errors
    - 7.3: Verify AutoFixEngine compatibility
