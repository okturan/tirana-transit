# Security policy

## Supported version

Security fixes are made on the `main` branch and flow to the application
published on GitHub Pages. Historical data snapshots remain available for
reproducibility, but only the current converter, application, and deployment
workflow are supported.

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting form](https://github.com/okturan/tirana-transit/security/advisories/new)
instead of opening a public issue. Include the affected URL or pipeline step,
the input needed to reproduce the issue, the environment you tested, and the
security impact.

Relevant reports include:

- script or markup injection through GTFS fields, route metadata, URL state, or
  rendered map content;
- unsafe archive handling, path traversal, or unexpected file writes in the
  GTFS conversion and feed-checking pipeline;
- a dependency, GitHub Actions, or GitHub Pages deployment weakness;
- exposure of information beyond the public transit dataset bundled with the
  repository.

Incorrect schedules, missing stops, map geometry errors, and stale municipality
data are data-quality bugs unless they cross a security boundary. The upstream
GTFS source and GitHub Pages platform are outside this project's control, but a
repository workflow that handles either unsafely is in scope.

Use a reduced synthetic feed wherever possible. Do not attach credentials,
personal travel information, or destructive payloads. The maintainer will
coordinate validation, remediation, and disclosure through the private
advisory.
