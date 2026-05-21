# AI Instructions for mg-mobile-app

## Build and Deployment Workflow
- This repository is a React application that is served via Streamlit using a built single-file HTML.
- **CRITICAL**: Whenever you modify the React source code (`src/` etc.), you MUST run `npm run build` to update the `dist/index.html` file.
- After running the build, commit all changes (including `dist/index.html`) and run `git push` to deploy the updates to the remote environment.
- Do NOT stop at modifying local files. Always complete the process: `npm run build` -> `git add .` -> `git commit` -> `git push`.
