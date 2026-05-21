Code Standards
To maintain a high‑quality codebase across the multi‑sport predictions platform, the following coding standards and best practices must be observed. They apply to all programming languages used in the project, with language‑specific guidance where appropriate.
1. General Principles
Consistency – Follow consistent naming conventions, indentation and formatting rules throughout the codebase. The project is TypeScript-only (no `.js`/`.jsx` files in `frontend/src/` or the backend modules). Use Prettier for formatting.
Readability – Write code that is easy to understand. Choose descriptive names for variables, functions and classes. Avoid overly clever constructs; favour clarity over brevity.
Modularity – Organise code into small, focused functions and classes. Each module should have a single responsibility and hide its internal details. Adhere to the SOLID principles (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion).
Documentation – Provide clear inline comments and high‑level documentation (JSDoc for TypeScript/JavaScript, docstrings for Python). Comment why a piece of code exists or makes certain decisions rather than what it does. Maintain up‑to‑date README files for each service, describing setup, usage and environment variables.
Error Handling – Handle exceptions gracefully and fail fast when encountering unexpected states. Do not swallow exceptions silently. Provide meaningful error messages and, where appropriate, propagate errors up the call stack with context.
Security – Validate and sanitise all user input. Use prepared statements or ORM parameter binding to prevent SQL injection. Store passwords and API keys securely (e.g., environment variables, secrets managers) and never in version control. Follow the principle of least privilege for database and network access.
Testing – Employ test‑driven development (TDD) where feasible. Write unit tests for individual functions and classes, integration tests for service interactions and end‑to‑end tests for critical user flows. Use tools like Jest (JavaScript/TypeScript) and PyTest (Python). Achieve and maintain high test coverage (80 % or higher) and run tests automatically in the CI pipeline.
Version Control – Use Git for source control. Write descriptive commit messages in the imperative mood (e.g., “Add booking code generator”). Group related changes into a single commit. Use branches for new features, bug fixes and experiments; merge into the main branch only via pull requests with code reviews.
Code Reviews – All changes must be peer‑reviewed. Reviewers should check for correctness, readability, adherence to standards and potential security issues. Use ESLint (TypeScript) to catch common mistakes before review.
2. TypeScript / JavaScript Standards
Type Safety – Use TypeScript over plain JavaScript to enforce type safety on both the server and client. Define interfaces and types for API responses, database models and external services.
ESLint Configuration – Adopt a strict ESLint configuration (e.g., airbnb-base or typescript-eslint) and integrate it into the CI pipeline. Warnings should be treated as errors.
Async/Await – Prefer async/await over promise chains for asynchronous code. Always handle rejected promises.
Imports – Use ES module syntax (import/export). Group imports logically: external modules first, then internal modules, then styles.
State Management – In the front‑end, use React's built-in `useState`/`useReducer`/`useContext` for component and shared state. Extract custom hooks where logic is reused across components. Avoid adding external state management libraries (Redux, Zustand) unless clearly justified by complexity.
UI Components – Design reusable, stateless UI components. Use styled components or a utility‑first CSS framework such as Tailwind CSS. Ensure accessibility (ARIA attributes, semantic HTML) and internationalisation support.
3. Python Standards (AI Service & Data Processing)
Note: There is no Python service currently implemented in this project. The entire stack is TypeScript (Next.js frontend + Fastify backend). The following guidelines apply if a Python AI/data service is added in the future.
PEP 8 Compliance – Follow the PEP 8 style guide for naming, indentation (4 spaces) and line lengths (maximum 88 characters when using Black). Use flake8 to enforce code quality.
Virtual Environments – Use virtual environments (venv or conda) to isolate dependencies. Pin dependency versions in a requirements.txt or pyproject.toml file.
Type Hints – Use Python type hints (PEP 484) and enforce them with a type checker such as mypy. This improves readability and catches type errors before runtime.
DataFrames and Vectorised Operations – For large data processing tasks, use pandas or polars DataFrames and avoid Python loops where vectorised operations are available. Document assumptions about data schema and shape.
Model Persistence – Store trained models in a versioned model registry (e.g., MLflow) rather than serialising arbitrary Python objects. Document the environment (Python version, library versions) that produced each model.
Reproducibility – Set random seeds for stochastic algorithms and document random number generation. Save training data hashes to detect when training inputs change.
4. Database and Query Guidelines
Raw SQL (no ORM) – This project uses the raw `pg` driver directly. There is no TypeORM, Prisma, Sequelize, or other ORM. Write SQL in repository files (`*.repository.ts`). Use parameterised queries (`$1, $2, ...`) to prevent SQL injection. Keep all database logic in the repository layer; the service layer must not build SQL strings.
Migrations – Schema changes go in numbered `.sql` files under `backend/src/migrations/`. Files are applied in alphabetical order by `npm run migrate`. Each migration must use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so it is safe to re-run. Prefix files with a zero-padded sequence number (`001_`, `002_`, etc.).
Indexing – Add appropriate indexes to frequently queried columns (e.g., user IDs, prediction IDs, timestamps). Monitor query performance and adjust indexes as needed.
Transactions – Use database transactions for operations that require atomicity (e.g., crediting a creator’s earnings and debiting the platform’s wallet). Handle rollbacks on failure.
5. Deployment and DevOps
Infrastructure as Code – Use tools like Terraform or AWS CloudFormation to define infrastructure. Keep configurations in version control.
CI/CD Pipeline – Set up a continuous integration pipeline (GitHub Actions, GitLab CI, Jenkins) that runs tests, linters, static analysis and security scans. Successful pipelines should automatically build and deploy to staging environments.
Containerization – Package services as Docker images. Use multi‑stage builds to reduce image size. Maintain minimal base images and keep them updated to patch vulnerabilities.
Secrets Management – Store secrets in a secure vault (e.g., AWS Secrets Manager, HashiCorp Vault). Avoid hard‑coding secrets in code or environment files committed to source control.
Monitoring – Instrument code with metrics (e.g., response times, error counts) and log structured events. Use log correlation IDs to trace requests across services.
By adhering to these standards, the development team will produce a robust, maintainable and secure codebase that can scale with the platform’s growth.